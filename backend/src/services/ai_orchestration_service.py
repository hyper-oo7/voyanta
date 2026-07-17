"""
ai_orchestration_service.py — AI Orchestration with Instructor & Pydantic
===========================================================================
Integrates Instructor and strict Pydantic models (FinalProposalSchema) to connect
the extraction pipeline output (DocumentIR) with the LLM prompt.
Guarantees strict JSON compliance with self-healing retries and semantic caching.
"""

import os
import json
import logging
from typing import Optional, Dict, Any, Union

from src.models.ir_schema import DocumentIR
from src.models.proposal_schema import FinalProposalSchema
from src.services.ai_client import call_llm
from src.services.cascading_ai_service import EXTRACTION_PROMPT_TEMPLATE, detect_currency_from_text

logger = logging.getLogger(__name__)

try:
    import instructor
    HAS_INSTRUCTOR = True
except ImportError:
    HAS_INSTRUCTOR = False
    instructor = None

try:
    from openai import AsyncOpenAI
    HAS_OPENAI_SDK = True
except ImportError:
    HAS_OPENAI_SDK = False
    AsyncOpenAI = None

try:
    import google.generativeai as genai
    HAS_GENAI_SDK = True
except ImportError:
    HAS_GENAI_SDK = False
    genai = None


async def orchestrate_proposal_extraction(
    extraction_input: Union[DocumentIR, str, Dict[str, Any]],
    destination_hint: str = "",
    agency_id: Optional[str] = None,
    provider: Optional[str] = None,
    max_retries: int = 3
) -> FinalProposalSchema:
    """
    Connects DocumentIR extraction output to the LLM prompt and enforces
    strict validation against FinalProposalSchema using Instructor.
    """
    # 1. Normalize input to text representation for the prompt
    if isinstance(extraction_input, DocumentIR):
        document_text = extraction_input.full_text
        doc_meta = extraction_input.metadata
    elif isinstance(extraction_input, dict):
        document_text = json.dumps(extraction_input, indent=2)
        doc_meta = {}
    else:
        document_text = str(extraction_input)
        doc_meta = {}

    detected_currency = detect_currency_from_text(document_text)
    prompt = EXTRACTION_PROMPT_TEMPLATE.format(document_text=document_text)

    api_key_gemini = os.environ.get("GEMINI_API_KEY")
    api_key_openai = os.environ.get("OPENAI_API_KEY")

    if not provider:
        provider = "gemini" if api_key_gemini else "openai"

    # Check semantic AI cache before running LLM
    cache_meta = {
        "agency_id": agency_id,
        "entity_type": "orchestrated_proposal",
        "prompt_version": "instructor_v2.0.0",
        "schema_version": "FinalProposalSchema_v1.0.0",
        "model": "gemini-2.5-flash" if provider == "gemini" else "gpt-4o-mini",
        "input_text": document_text
    }

    from src.services.ai_cache_service import get_cached_extraction, save_cached_extraction
    cached_json = await get_cached_extraction(
        agency_id=agency_id,
        model=cache_meta["model"],
        prompt_version=cache_meta["prompt_version"],
        schema_version=cache_meta["schema_version"],
        normalized_input=document_text
    )
    if cached_json:
        cached_model = FinalProposalSchema.model_validate(cached_json)
        setattr(cached_model, "model_used", cache_meta.get("model_used", cache_meta["model"]))
        return cached_model
    except Exception as cache_val_err:
        logger.warning(f"[AIOrchestration] Cached schema validation mismatch ({cache_val_err}); re-orchestrating.")

    # 2. Execute via Instructor if available and SDK is supported
    if HAS_INSTRUCTOR and provider == "openai" and HAS_OPENAI_SDK and api_key_openai:
        logger.info("[AIOrchestration] Using Instructor with AsyncOpenAI client...")
        try:
            client = instructor.from_openai(AsyncOpenAI(api_key=api_key_openai))
            proposal: FinalProposalSchema = await client.chat.completions.create(
                model="gpt-4o-mini",
                response_model=FinalProposalSchema,
                messages=[
                    {"role": "system", "content": "You are a faithful travel document extractor. Extract data exactly as written."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.0,
                max_retries=1
            )
            return _postprocess_proposal(proposal, destination_hint, detected_currency, cache_meta, document_text)
        except Exception as inst_err:
            logger.warning(f"[AIOrchestration] Instructor AsyncOpenAI execution failed ({inst_err}); trying fallback.")

    # Note: For Gemini (`provider == "gemini"`), we go straight to native call_llm + json_repair
    # in Step 3 below because native Gemini REST API (`generateContent`) is ~2x faster than the 
    # OpenAI compatibility endpoint proxy and handles large JSON structures without proxy timeouts.
    # 3. Fallback / Universal Execution loop with Pydantic self-healing validation
    logger.info("[AIOrchestration] Executing via unified call_llm with Pydantic self-healing validation loop...")
    schema_json = FinalProposalSchema.model_json_schema()
    current_prompt = prompt

    for attempt in range(1, max_retries + 1):
        try:
            raw_response = await call_llm(
                prompt=current_prompt,
                system_prompt="You MUST return strictly valid JSON matching the provided JSON schema. No extra text.",
                provider=provider,
                response_schema=schema_json,
                temperature=0.0,
                max_tokens=8192
            )

            # Extract clean JSON
            import re
            import json_repair
            clean_str = raw_response.strip()
            if not clean_str.startswith("{"):
                json_match = re.search(r'\{[\s\S]+\}', clean_str)
                if json_match:
                    clean_str = json_match.group()

            try:
                proposal = FinalProposalSchema.model_validate_json(clean_str)
            except Exception as val_err:
                try:
                    repaired_dict = json_repair.loads(clean_str)
                    if not isinstance(repaired_dict, dict):
                        repaired_dict = json_repair.loads(raw_response)
                    if isinstance(repaired_dict, dict):
                        proposal = FinalProposalSchema.model_validate(repaired_dict)
                        logger.info(f"[AIOrchestration] Successfully repaired and validated JSON on attempt {attempt}")
                        return _postprocess_proposal(proposal, destination_hint, detected_currency, cache_meta, document_text)
                except Exception as repair_err:
                    logger.warning(f"[AIOrchestration] json_repair validation failed on attempt {attempt}: {repair_err}")
                raise val_err

            return _postprocess_proposal(proposal, destination_hint, detected_currency, cache_meta, document_text)
        except Exception as val_err:
            if isinstance(val_err, RuntimeError) or "Neither GEMINI_API_KEY" in str(val_err):
                raise val_err
            logger.warning(f"[AIOrchestration] Validation error on attempt {attempt}/{max_retries}: {val_err}")
            if attempt == max_retries:
                raise RuntimeError(f"Failed to produce valid FinalProposalSchema after {max_retries} attempts: {val_err}") from val_err
            # Append error feedback for self-healing next attempt
            current_prompt += f"\n\nPREVIOUS ATTEMPT FAILED SCHEMA VALIDATION:\nError: {val_err}\nPlease correct the JSON output so it strictly satisfies FinalProposalSchema."

    raise RuntimeError("AI Orchestration failed unexpectedly.")


def _postprocess_proposal(
    proposal: FinalProposalSchema,
    destination_hint: str,
    detected_currency: str,
    cache_meta: Dict[str, Any],
    input_text: str
) -> FinalProposalSchema:
    """Enforce currency override, destination hint, and persist to semantic cache."""
    # Override currency if AI defaulted to USD/EUR incorrectly
    if proposal.currency == "USD" and detected_currency != "USD":
        proposal.currency = detected_currency

    if not proposal.destination and destination_hint:
        proposal.destination = destination_hint

    setattr(proposal, "model_used", cache_meta.get("model_used", cache_meta["model"]))

    # Save to semantic AI cache
    import asyncio
    try:
        from src.services.ai_cache_service import save_cached_extraction
        loop = asyncio.get_running_loop()
        loop.create_task(save_cached_extraction(
            agency_id=cache_meta.get("agency_id"),
            entity_type=cache_meta.get("entity_type"),
            entity_id=None,
            model=cache_meta.get("model", "gemini-2.5-flash"),
            prompt_version=cache_meta.get("prompt_version", "v1.0.0"),
            schema_version=cache_meta.get("schema_version", "v1.0.0"),
            normalized_input=input_text,
            output_json=proposal.model_dump(by_alias=True)
        ))
    except Exception as e:
        logger.debug(f"[AIOrchestration] Background cache save skipped: {e}")

    return proposal
