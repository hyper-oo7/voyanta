import json
import pytest
from unittest.mock import MagicMock, patch

@pytest.mark.anyio
async def test_rebuild_style_profile():
    from src.services.proposal_style_service import rebuild_style_profile
    
    mock_sb = MagicMock()
    mock_table = MagicMock()
    mock_sb.table.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.neq.return_value = mock_table
    mock_table.order.return_value = mock_table
    mock_table.limit.return_value = mock_table
    
    # Mock return for proposals and vault packages
    mock_proposals = [
        {
            "id": "p-1",
            "name": "Luxury India Journey",
            "destination": "India",
            "brief": {"special_notes": "Welcome to your royal journey..."},
            "preferences": {
                "branding": {"highlights": "• Royal greeting\n• Palace stay"},
                "costing": {"pct_markup": 12.0, "fixed_markup": 150}
            }
        }
    ]
    mock_vault = [
        {
            "id": "vp-1",
            "destination": "Goa",
            "overview": "Immerse in sunny shores...",
            "extra_sections": {"inclusions": "Resort stay, spa", "exclusions": "Flights"}
        }
    ]
    
    mock_res_prop = MagicMock()
    mock_res_prop.data = mock_proposals
    
    mock_res_vault = MagicMock()
    mock_res_vault.data = mock_vault
    
    # Let the first execute return proposals, second return vault
    mock_table.execute.side_effect = [mock_res_prop, mock_res_vault, MagicMock()]
    
    # Mock LLM API call
    mock_llm_response = {
        "greeting_style": "Personalized and royal welcome.",
        "highlights_style": "Concise bullet points.",
        "tone": "Warm and formal",
        "section_order": ["overview", "itinerary"],
        "typical_inclusions_exclusions": "Concise lists",
        "typical_markup_range": "10-15%"
    }
    
    with patch("src.services.proposal_style_service.get_supabase_client", return_value=mock_sb), \
         patch("src.services.proposal_style_service.call_gemini_with_retry", return_value={
             "candidates": [{"content": {"parts": [{"text": json.dumps(mock_llm_response)}]}}]
         }) as mock_call, \
         patch.dict("os.environ", {"GEMINI_API_KEY": "test-key"}):
         
        profile = await rebuild_style_profile("agency-1")
        assert profile is not None
        assert profile["tone"] == "Warm and formal"
        assert profile["typical_markup_range"] == "10-15%"

@pytest.mark.anyio
async def test_auto_phrase_with_profile():
    from src.services.proposal_style_service import auto_phrase_with_profile
    
    mock_sb = MagicMock()
    mock_table = MagicMock()
    mock_sb.table.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    
    mock_agency_data = {
        "style_profile": {
            "greeting_style": "Warm & formal",
            "tone": "Executive luxury"
        }
    }
    mock_res = MagicMock()
    mock_res.data = mock_agency_data
    mock_table.maybeSingle.return_value = mock_table
    mock_table.execute.return_value = mock_res
    
    mock_llm_response = {
        "greeting": "Dear Raman, Welcome to custom Delhi trip...",
        "highlights": "• Red Fort private tour\n• Luxury chauffeured luxury transfers"
    }
    
    with patch("src.services.proposal_style_service.get_supabase_client", return_value=mock_sb), \
         patch("src.services.proposal_style_service.call_gemini_with_retry", return_value={
             "candidates": [{"content": {"parts": [{"text": json.dumps(mock_llm_response)}]}}]
         }), \
         patch.dict("os.environ", {"GEMINI_API_KEY": "test-key"}):
         
        draft = await auto_phrase_with_profile(
            agency_id="agency-1",
            client_name="Raman",
            destination="Delhi",
            tour_type="Heritage Tour"
        )
        assert draft is not None
        assert "Delhi" in draft["greeting"]
        assert "Red Fort" in draft["highlights"]


@pytest.mark.anyio
async def test_generate_outcome_insights_pending():
    from src.services.proposal_style_service import generate_outcome_insights
    
    mock_sb = MagicMock()
    mock_table = MagicMock()
    mock_sb.table.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.in_.return_value = mock_table
    
    # Return 3 mock proposals (under 5)
    mock_proposals = [{"id": f"p-{i}", "status": "Approved"} for i in range(3)]
    mock_res = MagicMock()
    mock_res.data = mock_proposals
    mock_table.execute.return_value = mock_res
    
    res = await generate_outcome_insights("agency-1", mock_sb)
    assert res["status"] == "pending"
    assert res["current"] == 3
    assert res["required"] == 5
    assert len(res["insights"]) == 0


@pytest.mark.anyio
async def test_generate_outcome_insights_success():
    from src.services.proposal_style_service import generate_outcome_insights
    
    mock_sb = MagicMock()
    mock_table = MagicMock()
    mock_sb.table.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.in_.return_value = mock_table
    
    # Build 55 proposals:
    # 35 using template 'classic' (25 Won/Approved, 10 Lost/Cancelled)
    # 20 using template 'beach' (5 Won/Approved, 15 Lost/Cancelled)
    # Total count = 55. Total Wins = 30. Overall Win Rate = 30 / 55 = 54.5%
    # Classic Win Rate = 25 / 35 = 71.4% (diff of +16.9% vs overall -> exceeds 15% better limit!)
    # Beach Win Rate = 5 / 20 = 25.0% (diff of -29.5% vs overall -> exceeds 15% worse limit!)
    mock_proposals = []
    for i in range(25):
        mock_proposals.append({
            "id": f"classic-w-{i}", "status": "Approved", "total_cost": 500,
            "preferences": {"branding": {"template_style": "classic"}}
        })
    for i in range(10):
        mock_proposals.append({
            "id": f"classic-l-{i}", "status": "Cancelled", "total_cost": 500,
            "preferences": {"branding": {"template_style": "classic"}}
        })
    for i in range(5):
        mock_proposals.append({
            "id": f"beach-w-{i}", "status": "Approved", "total_cost": 500,
            "preferences": {"branding": {"template_style": "beach"}}
        })
    for i in range(15):
        mock_proposals.append({
            "id": f"beach-l-{i}", "status": "Cancelled", "total_cost": 500,
            "preferences": {"branding": {"template_style": "beach"}}
        })
        
    mock_res = MagicMock()
    mock_res.data = mock_proposals
    mock_table.execute.return_value = mock_res
    
    res = await generate_outcome_insights("agency-1", mock_sb)
    assert res["status"] == "success"
    assert res["current"] == 55
    assert len(res["insights"]) > 0
    
    messages = [insight["message"] for insight in res["insights"]]
    assert any("Classic" in msg and "convert" in msg for msg in messages)
    assert any("Beach" in msg and "less often" in msg for msg in messages)


@pytest.mark.anyio
async def test_validate_itinerary_sequence_mock():
    from src.services.proposal_style_service import validate_itinerary_sequence
    
    mock_days = [
        {"day": 1, "title": "Arrival", "description": "Check in to Taj Hotel Delhi"},
        {"day": 2, "title": "Agra", "description": "Check in to Oberoi Amarvilas"},
        {"day": 3, "title": "Jaipur", "description": "Check in to Rambagh Palace"}
    ]
    
    with patch.dict("os.environ", {}, clear=True):
        flags = await validate_itinerary_sequence(mock_days)
        assert len(flags) == 1
        assert flags[0]["id"] == "hotel-switching"
        assert "fatigue" in flags[0]["message"]
