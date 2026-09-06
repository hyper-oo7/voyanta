"""
Proposal generation service using Gemini 2.5 Flash / GPT-4o with RAG context injection.
"""
import json
import logging
from typing import Dict, Any, Optional
from src.services.rag_engine import rag_engine
from src.services.ai_client import call_llm
from src.models.schemas import (
    GeneratedProposal, DayPlan, PricingBreakdown,
    ProposalGenerateRequest
)

logger = logging.getLogger(__name__)

class ProposalGenerator:
    def _build_system_prompt(self, agency_context: str = "") -> str:
        return f"""You are an expert travel advisor at Voyanta, a premium India-focused travel agency.
Your job is to write compelling, detailed travel proposals for Indian and international clients.

RULES:
- Write in a warm, professional tone that sells the experience
- Use Indian English conventions (₹ for currency, "lakhs" where appropriate)
- Be specific about hotels, activities, and transport — never vague
- Include practical tips relevant to Indian travel (weather, altitude, local customs)
- All pricing must be realistic for the Indian market
- Structure output as valid JSON matching the requested schema
- Ground your response in the provided SOURCE documents
- If SOURCE documents lack info, use your knowledge but flag it
- For Manali: mention Rohtang Pass (when open), Solang Valley, Hadimba Temple, Old Manali cafes, river rafting in Kullu, paragliding, Manikaran hot springs, Naggar Castle

{agency_context}
"""
    
    def _build_user_prompt(
        self,
        request: ProposalGenerateRequest,
        rag_context: str,
    ) -> str:
        budget_text = f"Budget: around ₹{request.budget_inr} total\n" if request.budget_inr else ""
        special = f"Special requests: {request.special_requests}\n" if request.special_requests else ""
        
        return f"""Create a detailed travel proposal based on the following:

CLIENT REQUEST:
- Destination: {request.destination}
- Duration: {request.duration_days} days
- Travelers: {request.travelers}
- Travel style: {request.travel_style}
{budget_text}{special}

RELEVANT PAST PROPOSALS & DOCUMENTS:
{rag_context}

OUTPUT FORMAT — Return ONLY valid JSON with this exact structure:
{{
  "title": "Catchy proposal title",
  "subtitle": "Short enticing subtitle",
  "destination": "{request.destination}",
  "duration_days": {request.duration_days},
  "summary": "2-3 paragraph overview of the trip experience",
  "day_plans": [
    {{
      "day_number": 1,
      "title": "Day title (e.g., Arrival & Local Exploration)",
      "description": "Detailed paragraph about the day",
      "activities": ["Activity 1", "Activity 2"],
      "meals": "Breakfast & Dinner included",
      "hotel_name": "Hotel name or 'Not specified'",
      "transport": "Transport details",
      "tips": "Practical tip for this day"
    }}
  ],
  "pricing": [
    {{
      "category": "Accommodation / Transport / Activities / Meals / Misc",
      "item": "Specific item name",
      "cost_inr": 4500,
      "notes": "Optional note"
    }}
  ],
  "inclusions": ["List of what's included"],
  "exclusions": ["List of what's NOT included"],
  "terms": "Payment terms, cancellation policy, etc."
}}

Make the proposal feel personalized and exciting. Use vivid descriptions.
"""

    async def generate_async(
        self,
        request: ProposalGenerateRequest,
        agency_context: str = "",
    ) -> GeneratedProposal:
        rag_result = rag_engine.run_rag(
            agency_id=request.agency_id,
            destination=request.destination,
            duration_days=request.duration_days,
            travelers=request.travelers,
            travel_style=request.travel_style,
            budget_inr=request.budget_inr,
            special_requests=request.special_requests,
        )
        
        logger.info(f"[ProposalGenerator] RAG context retrieved: {rag_result['chunk_count']} chunks")
        
        system_prompt = self._build_system_prompt(agency_context)
        user_prompt = self._build_user_prompt(request, rag_result["context"])
        
        raw_text = ""
        try:
            raw_text = await call_llm(
                prompt=user_prompt,
                system_prompt=system_prompt,
                temperature=0.7,
            )
            
            # Clean markdown code blocks if returned
            clean_json = raw_text.strip()
            if clean_json.startswith("```json"):
                clean_json = clean_json[7:]
            if clean_json.startswith("```"):
                clean_json = clean_json[3:]
            if clean_json.endswith("```"):
                clean_json = clean_json[:-3]
            clean_json = clean_json.strip()

            proposal_data = json.loads(clean_json)
            proposal = GeneratedProposal(**proposal_data)
            proposal.raw_markdown = self._format_raw_markdown(proposal)
            
            logger.info(f"[ProposalGenerator] Proposal generated successfully: '{proposal.title}'")
            return proposal
            
        except json.JSONDecodeError as e:
            logger.error(f"[ProposalGenerator] JSON parse failed: {e}. Raw: {raw_text[:300]}")
            # Fallback proposal generation if JSON parse failed
            return self._build_fallback_proposal(request, rag_result["context"])
        except Exception as e:
            logger.error(f"[ProposalGenerator] Proposal generation failed: {e}")
            return self._build_fallback_proposal(request, rag_result["context"])

    def generate(
        self,
        request: ProposalGenerateRequest,
        agency_context: str = "",
    ) -> GeneratedProposal:
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import nest_asyncio
                nest_asyncio.apply()
                return loop.run_until_complete(self.generate_async(request, agency_context))
            else:
                return loop.run_until_complete(self.generate_async(request, agency_context))
        except Exception:
            return asyncio.run(self.generate_async(request, agency_context))

    def _build_fallback_proposal(self, request: ProposalGenerateRequest, context: str) -> GeneratedProposal:
        days = []
        for d in range(1, request.duration_days + 1):
            days.append(DayPlan(
                day_number=d,
                title=f"Day {d}: Exploring {request.destination}",
                description=f"Enjoy a memorable day in {request.destination} with sightseeing and authentic local experiences.",
                activities=[f"Explore {request.destination} main attractions", "Local cultural walk"],
                meals="Breakfast & Dinner included",
                hotel_name="Premium 3-Star Resort",
                transport="Private Cab",
                tips="Carry warm clothes and camera."
            ))
        return GeneratedProposal(
            title=f"Unforgettable {request.destination} Getaway",
            subtitle=f"Exclusive {request.duration_days}-Day Itinerary for {request.travelers} Guests",
            destination=request.destination,
            duration_days=request.duration_days,
            summary=f"Welcome to your custom proposal for {request.destination}. Designed for a {request.travel_style} experience with full transport and stay.",
            day_plans=days,
            pricing=[
                PricingBreakdown(category="Accommodation", item=f"Hotel Stay ({request.duration_days} Nights)", cost_inr=35000),
                PricingBreakdown(category="Transport", item="Private Vehicle & Transfers", cost_inr=15000),
                PricingBreakdown(category="Activities", item="Guided Sightseeing & Passes", cost_inr=10000),
            ],
            inclusions=["Accommodation on MAP Basis", "Private AC Cab", "All Taxes & Driver Charges"],
            exclusions=["Flight/Train Fare", "Personal Expenses", "Emergency Insurance"],
            terms="50% advance payment to confirm booking. Free cancellation up to 7 days before departure.",
            images=[]
        )

    def _format_raw_markdown(self, proposal: GeneratedProposal) -> str:
        md = f"""# {proposal.title}
> {proposal.subtitle or ''}

## Trip Overview
{proposal.summary}

## Day-by-Day Itinerary
"""
        for day in proposal.day_plans:
            md += f"""\n### Day {day.day_number}: {day.title}
{day.description}

**Activities:** {', '.join(day.activities)}\n
"""
            if day.hotel_name:
                md += f"**Stay:** {day.hotel_name}\n"
            if day.transport:
                md += f"**Transport:** {day.transport}\n"
            if day.meals:
                md += f"**Meals:** {day.meals}\n"
            if day.tips:
                md += f"💡 *Tip:* {day.tips}\n"
        
        md += "\n## Pricing Breakdown\n"
        total = 0
        for p in proposal.pricing:
            cost = p.cost_inr or 0
            total += cost
            md += f"- **{p.category}** — {p.item}: ₹{cost:,}"
            if p.notes:
                md += f" ({p.notes})"
            md += "\n"
        md += f"\n**Estimated Total:** ₹{total:,}\n"
        
        md += "\n## Inclusions\n"
        for inc in proposal.inclusions:
            md += f"- {inc}\n"
        
        md += "\n## Exclusions\n"
        for exc in proposal.exclusions:
            md += f"- {exc}\n"
        
        if proposal.terms:
            md += f"\n## Terms & Conditions\n{proposal.terms}\n"
        
        return md

proposal_generator = ProposalGenerator()
