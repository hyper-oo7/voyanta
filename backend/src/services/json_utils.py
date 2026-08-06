"""
json_utils.py
=============
Shared, dependency-tolerant JSON parsing for LLM output.

LLMs routinely return JSON wrapped in prose or markdown fences, and truncate
mid-object when they hit an output-token ceiling. `loads_forgiving` walks a
ladder of recovery strategies and raises a single, descriptive error if every
one of them fails.

`json_repair` is an optional dependency here on purpose: previously the import
was wrapped in `try/except ImportError: pass` and the name was then called
unguarded, so a missing package surfaced as a confusing NameError.
"""
import json
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

try:  # optional dependency — see module docstring
    from json_repair import repair_json as _repair_json
except ImportError:  # pragma: no cover - depends on the deployed environment
    _repair_json = None
    logger.warning(
        "[json_utils] json-repair is not installed; truncated or malformed LLM "
        "JSON will not be recoverable. Install it with: pip install json-repair"
    )


class MalformedLLMJsonError(ValueError):
    """Raised when LLM output cannot be coerced into JSON by any strategy."""


def strip_code_fences(text: str) -> str:
    """Remove ```json ... ``` (or bare ```) fences an LLM may have added."""
    cleaned = (text or "").strip()
    if not cleaned.startswith("```"):
        return cleaned
    # Drop the opening fence line (```json / ```) and any trailing fence.
    cleaned = cleaned.split("\n", 1)[-1] if "\n" in cleaned else cleaned[3:]
    if "```" in cleaned:
        cleaned = cleaned.rsplit("```", 1)[0]
    return cleaned.strip()


def loads_forgiving(text: str) -> Any:
    """
    Parse `text` as JSON, tolerating markdown fences, surrounding prose and
    truncation. Raises MalformedLLMJsonError if nothing works.
    """
    if text is None or not str(text).strip():
        raise MalformedLLMJsonError("LLM returned empty content")

    raw = str(text)
    cleaned = strip_code_fences(raw)

    # 1. Straight parse.
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # 2. Largest {...} or [...] span, for responses padded with prose.
    for pattern in (r"\{[\s\S]*\}", r"\[[\s\S]*\]"):
        match = re.search(pattern, cleaned)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass

    # 3. json-repair, which can close objects truncated by an output-token cap.
    if _repair_json is not None:
        try:
            repaired = _repair_json(cleaned)
            if repaired:
                return json.loads(repaired)
        except Exception as exc:  # json_repair raises a variety of types
            logger.debug("[json_utils] json-repair could not fix the payload: %s", exc)

    preview = cleaned[:400]
    raise MalformedLLMJsonError(
        "LLM returned malformed JSON that could not be repaired. "
        f"First 400 chars: {preview!r}"
    )
