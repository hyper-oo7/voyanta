"""
Template rendering engine for proposals.
Converts structured proposal models into HTML using agency templates or branded default themes.
"""
import logging
from typing import Dict, Any, Optional, List
from src.services.supabase_client import get_supabase_client
from src.models.schemas import GeneratedProposal

logger = logging.getLogger(__name__)

def get_supabase():
    return get_supabase_client()

class TemplateRenderer:
    def __init__(self):
        pass

    def get_template(self, template_id: str, agency_id: str) -> Optional[Dict[str, Any]]:
        sb = get_supabase()
        if not sb:
            return None
        try:
            resp = sb.table("templates").select("*").eq("id", template_id).eq("agency_id", agency_id).single().execute()
            return resp.data
        except Exception as e:
            logger.warning(f"[TemplateRenderer] Could not fetch template {template_id}: {e}")
            return None
    
    def get_default_template(self, agency_id: str) -> Optional[Dict[str, Any]]:
        sb = get_supabase()
        if not sb:
            return None
        try:
            resp = sb.table("templates").select("*").eq("agency_id", agency_id).eq("is_default", True).single().execute()
            if resp.data:
                return resp.data
            resp = sb.table("templates").select("*").eq("agency_id", agency_id).limit(1).execute()
            return resp.data[0] if resp.data else None
        except Exception as e:
            logger.warning(f"[TemplateRenderer] Could not fetch default template for agency {agency_id}: {e}")
            return None

    def render(
        self,
        proposal: GeneratedProposal,
        template_id: Optional[str] = None,
        agency_id: str = "global",
        images: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        template = None
        if template_id:
            template = self.get_template(template_id, agency_id)
        if not template and agency_id:
            template = self.get_default_template(agency_id)
        
        replacements = self._build_replacements(proposal, images or [])

        if not template:
            logger.info(f"[TemplateRenderer] Using default built-in luxury layout for proposal '{proposal.title}'")
            default_html = self._build_default_layout(replacements)
            return {
                "html": default_html,
                "template_used": "Built-in Luxury Layout",
                "template_name": "Built-in Luxury Layout",
                "is_fallback": True,
            }
        
        html = template.get("html_content", "")
        for key, value in replacements.items():
            placeholder = f"{{{{{key}}}}}"
            html = html.replace(placeholder, str(value))
        
        logger.info(f"[TemplateRenderer] Rendered proposal '{proposal.title}' using template={template.get('id')}")
        
        return {
            "html": html,
            "template_used": template.get("id"),
            "template_name": template.get("name"),
            "is_fallback": False,
        }
    
    def _build_default_layout(self, r: Dict[str, str]) -> str:
        return f"""
        <div style="font-family: Inter, system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
            <div style="background: linear-gradient(135deg, #0f172a, #1e293b); color: #ffffff; padding: 40px 32px; border-radius: 16px; margin-bottom: 32px;">
                <span style="display: inline-block; background: rgba(255,255,255,0.15); padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">{r['destination']} · {r['duration_days']} Days</span>
                <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700;">{r['proposal_title']}</h1>
                <p style="margin: 0; font-size: 16px; color: #94a3b8;">{r['proposal_subtitle']}</p>
            </div>
            
            {r['images']}

            <div style="background: #f8fafc; padding: 24px; border-radius: 12px; margin-bottom: 32px; border-left: 4px solid #3b82f6;">
                <h3 style="margin-top:0; color:#0f172a;">Trip Overview</h3>
                <p style="margin-bottom:0; color:#475569;">{r['summary']}</p>
            </div>

            <h2 style="font-size: 20px; color: #0f172a; margin-bottom: 16px;">Day-by-Day Itinerary</h2>
            {r['day_plans']}

            <h2 style="font-size: 20px; color: #0f172a; margin-top: 32px; margin-bottom: 16px;">Estimated Investment</h2>
            {r['pricing_table']}

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 32px;">
                <div style="background: #f0fdf4; padding: 20px; border-radius: 12px; border: 1px solid #bbf7d0;">
                    <h3 style="margin-top:0; color: #166534; font-size: 16px;">✓ What's Included</h3>
                    <div style="color: #15803d; font-size: 14px;">{r['inclusions']}</div>
                </div>
                <div style="background: #fef2f2; padding: 20px; border-radius: 12px; border: 1px solid #fecaca;">
                    <h3 style="margin-top:0; color: #991b1b; font-size: 16px;">✕ Exclusions</h3>
                    <div style="color: #b91c1c; font-size: 14px;">{r['exclusions']}</div>
                </div>
            </div>

            {"<div style='margin-top:32px; padding:20px; background:#fffbeb; border-radius:12px; border:1px solid #fde68a;'><h3 style='margin-top:0; color:#92400e; font-size:15px;'>Terms & Conditions</h3><div style='font-size:13px; color:#b45309;'>" + r['terms'] + "</div></div>" if r['terms'] else ""}
        </div>
        """

    def _build_replacements(
        self,
        proposal: GeneratedProposal,
        images: List[str],
    ) -> Dict[str, str]:
        days_html = ""
        for day in proposal.day_plans:
            activities_tags = "".join(
                f'<span style="background:#f1f5f9;padding:4px 10px;border-radius:6px;font-size:13px;color:#334155;">{a}</span>'
                for a in day.activities
            )
            days_html += f"""
            <div class="day-card" style="margin-bottom:24px;padding:20px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;">
                <h3 style="margin:0 0 8px 0;color:#0f172a;font-size:17px;">Day {day.day_number}: {day.title}</h3>
                <p style="margin:0 0 12px 0;color:#475569;line-height:1.6;font-size:14px;">{day.description}</p>
                <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
                    {activities_tags}
                </div>
                {"<p style='margin:4px 0;font-size:13px;color:#64748b;'>🏨 Stay: " + day.hotel_name + "</p>" if day.hotel_name else ""}
                {"<p style='margin:4px 0;font-size:13px;color:#64748b;'>🚗 Transport: " + day.transport + "</p>" if day.transport else ""}
                {"<p style='margin:4px 0;font-size:13px;color:#64748b;'>🍽️ Meals: " + day.meals + "</p>" if day.meals else ""}
                {"<p style='margin:8px 0 0 0;font-size:13px;color:#92400e;background:#fef3c7;padding:8px 12px;border-radius:6px;'>💡 Tip: " + day.tips + "</p>" if day.tips else ""}
            </div>
            """
        
        pricing_html = "<table style='width:100%;border-collapse:collapse;margin:16px 0;'>"
        pricing_html += "<thead><tr style='background:#f8fafc;'><th style='padding:10px;text-align:left;border-bottom:1px solid #e2e8f0;font-size:13px;color:#475569;'>Category</th><th style='padding:10px;text-align:left;border-bottom:1px solid #e2e8f0;font-size:13px;color:#475569;'>Item</th><th style='padding:10px;text-align:right;border-bottom:1px solid #e2e8f0;font-size:13px;color:#475569;'>Cost (₹)</th></tr></thead><tbody>"
        total = 0
        for p in proposal.pricing:
            cost = p.cost_inr or 0
            total += cost
            pricing_html += f"""
            <tr>
                <td style="padding:10px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#334155;">{p.category}</td>
                <td style="padding:10px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#334155;">{p.item}{' <span style="color:#94a3b8;font-size:12px;">(' + p.notes + ')</span>' if p.notes else ''}</td>
                <td style="padding:10px;border-bottom:1px solid #f1f5f9;font-size:14px;text-align:right;font-weight:600;color:#0f172a;">₹{cost:,}</td>
            </tr>
            """
        pricing_html += f"""
            <tr style="background:#f8fafc;font-weight:700;">
                <td colspan="2" style="padding:12px 10px;font-size:15px;color:#0f172a;">Estimated Total</td>
                <td style="padding:12px 10px;text-align:right;font-size:15px;color:#0f172a;">₹{total:,}</td>
            </tr>
        </tbody></table>
        """
        
        images_html = ""
        for img in images[:6]:
            images_html += f'<img src="{img}" style="width:calc(50% - 6px);height:180px;object-fit:cover;border-radius:10px;" />'
        
        return {
            "proposal_title": proposal.title,
            "proposal_subtitle": proposal.subtitle or "",
            "destination": proposal.destination,
            "duration_days": str(proposal.duration_days),
            "summary": proposal.summary,
            "day_plans": days_html,
            "pricing_table": pricing_html,
            "inclusions": "<ul>" + "".join(f"<li>{i}</li>" for i in proposal.inclusions) + "</ul>",
            "exclusions": "<ul>" + "".join(f"<li>{e}</li>" for e in proposal.exclusions) + "</ul>",
            "terms": proposal.terms or "",
            "images": f'<div style="display:flex;flex-wrap:wrap;gap:12px;margin:20px 0;">{images_html}</div>' if images else "",
        }

template_renderer = TemplateRenderer()
