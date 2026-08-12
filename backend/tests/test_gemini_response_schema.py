"""
Regression tests for the Pydantic -> Gemini `responseSchema` converter.

Gemini's generateContent rejects the JSON Schema Pydantic emits: `$defs`/`$ref`,
`allOf`, `title`, `default` and `additionalProperties` all come back as a 400
INVALID_ARGUMENT, which surfaced as "Failed to produce valid FinalProposalSchema
after 3 attempts".
"""

import pytest
from unittest.mock import patch

from src.models.proposal_schema import FinalProposalSchema
from src.services.ai_client import call_llm, to_gemini_response_schema

GEMINI_KEYS = {
    "type", "format", "description", "nullable", "enum", "items",
    "properties", "required", "propertyOrdering", "anyOf", "minItems", "maxItems",
}
GEMINI_TYPES = {"STRING", "NUMBER", "INTEGER", "BOOLEAN", "ARRAY", "OBJECT"}


def _walk(node, path="root"):
    """Yield (path, node) for every schema node, ignoring property *names*."""
    if not isinstance(node, dict):
        return
    yield path, node
    for name, sub in (node.get("properties") or {}).items():
        yield from _walk(sub, f"{path}.{name}")
    if "items" in node:
        yield from _walk(node["items"], f"{path}[]")
    for i, sub in enumerate(node.get("anyOf") or []):
        yield from _walk(sub, f"{path}|{i}")


@pytest.fixture
def gemini_schema():
    return to_gemini_response_schema(FinalProposalSchema.model_json_schema())


def test_no_unsupported_keywords_survive(gemini_schema):
    for path, node in _walk(gemini_schema):
        unsupported = set(node) - GEMINI_KEYS
        assert not unsupported, f"{path} carries unsupported keys: {unsupported}"


def test_types_are_valid_gemini_enums(gemini_schema):
    for path, node in _walk(gemini_schema):
        if "anyOf" in node:
            continue
        assert node.get("type") in GEMINI_TYPES, f"{path} has type {node.get('type')!r}"


def test_nested_models_are_inlined(gemini_schema):
    """`days` referenced ProposalDay via $ref; it must arrive fully expanded."""
    day = gemini_schema["properties"]["days"]["items"]
    assert day["type"] == "OBJECT"
    assert {"day_number", "title", "hotels", "activities", "transfers", "meals"} <= set(day["properties"])
    # Two levels deep — ProposalDay -> ProposalHotel.
    assert "price_per_night" in day["properties"]["hotels"]["items"]["properties"]


def test_field_aliases_are_preserved(gemini_schema):
    """Aliased fields keep their wire names so Pydantic can validate the reply."""
    transfer = gemini_schema["properties"]["days"]["items"]["properties"]["transfers"]["items"]
    assert {"type", "from"} <= set(transfer["properties"])
    assert "payment" in gemini_schema["properties"]["extra_sections"]["properties"]


def test_optional_becomes_nullable_not_a_null_union(gemini_schema):
    total_price = gemini_schema["properties"]["total_price"]
    assert total_price["type"] == "NUMBER"
    assert total_price["nullable"] is True
    assert "anyOf" not in total_price


def test_defaulted_fields_are_still_required(gemini_schema):
    """
    Gemini omits anything absent from `required`, so `days` (default_factory=list)
    came back missing and every itinerary extracted with zero days.
    """
    assert set(gemini_schema["required"]) == set(gemini_schema["properties"])
    assert "days" in gemini_schema["required"]
    day = gemini_schema["properties"]["days"]["items"]
    assert "activities" in day["required"]


def test_schema_without_properties_is_dropped():
    """Bare `{"type": "object"}` carries no structure; callers fall back to JSON mode."""
    assert to_gemini_response_schema({"type": "object"}) is None
    assert to_gemini_response_schema(None) is None


def test_recursive_reference_does_not_infinitely_expand():
    recursive = {
        "type": "object",
        "properties": {"child": {"$ref": "#/$defs/Node"}},
        "$defs": {
            "Node": {
                "type": "object",
                "properties": {"child": {"$ref": "#/$defs/Node"}},
            }
        },
    }
    out = to_gemini_response_schema(recursive)
    assert out["properties"]["child"]["properties"]["child"]["type"] == "STRING"


@pytest.mark.anyio
@patch("src.services.ai_client._post_http_call")
async def test_call_llm_sends_sanitized_schema(mock_post):
    mock_post.return_value = {"candidates": [{"content": {"parts": [{"text": "{}"}]}}]}

    with patch.dict("os.environ", {"GEMINI_API_KEY": "gemini-key"}, clear=False):
        await call_llm(
            prompt="extract",
            provider="gemini",
            response_schema=FinalProposalSchema.model_json_schema(),
        )

    config = mock_post.call_args[0][1]["generationConfig"]
    assert config["responseMimeType"] == "application/json"
    sent = config["responseSchema"]
    for _, node in _walk(sent):
        assert not set(node) - GEMINI_KEYS
