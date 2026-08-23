"""Coverage for the extracted-content cleaner.

The samples here are taken from real supplier PDFs already in the vault, since
those are the shapes that made exported proposals look unfinished.
"""
from src.services.content_polish import clean_text, de_shout, polish_package, to_paragraphs


class TestEncodingRepair:
    def test_pdf_dashes_become_ascii(self):
        # U+2010 non-breaking hyphen survives PDF extraction and renders as a box.
        assert "‐" not in clean_text("Himachal ‐ Shimla")
        assert clean_text("Himachal ‐ Shimla") == "Himachal - Shimla"

    def test_replacement_character_is_dropped(self):
        assert "�" not in clean_text("Package validity � dates")

    def test_smart_quotes_normalised(self):
        assert clean_text("“Dal Lake” and ‘Shikara’") == '"Dal Lake" and \'Shikara\''

    def test_spacing_artefacts_tidied(self):
        assert clean_text("Chandigarh . (6N7D)") == "Chandigarh. (6N7D)"


class TestSupplierNoiseRemoval:
    def test_phone_and_query_line_removed(self):
        raw = "For Queries Related To Weekend Trips Call Us At 7307309609"
        assert clean_text(raw) == ""

    def test_page_furniture_removed(self):
        assert clean_text("[Extracted Tables from Page 3]") == ""
        assert clean_text("Page 4 of 12") == ""

    def test_expired_validity_removed(self):
        raw = "Package validity - 01st-Oct to 31st-March- 2019 Except Long Weekends."
        assert clean_text(raw) == ""

    def test_supplier_disclaimer_removed(self):
        raw = "Note: This is just a proposal; we are not holding any rooms as of now."
        assert clean_text(raw) == ""

    def test_contact_details_removed(self):
        assert clean_text("Email us at sales@supplier.com") == ""
        assert clean_text("Visit www.supplier.example") == ""

    def test_real_itinerary_text_is_kept(self):
        raw = "Arrive Srinagar and transfer to your houseboat on Dal Lake."
        assert clean_text(raw) == raw


class TestDeShout:
    def test_shouted_route_is_sentence_cased(self):
        assert de_shout("DELHI - SHIMLA - MANALI") == "Delhi - Shimla - Manali"

    def test_known_acronyms_survive(self):
        assert de_shout("MAP AC") == "MAP AC"

    def test_single_capitalised_word_untouched(self):
        assert de_shout("Arrive SRINAGAR today") == "Arrive SRINAGAR today"


class TestParagraphing:
    def test_run_on_block_is_split(self):
        raw = (
            "Arrive Srinagar, where you will be met upon arrival. "
            "Enjoy lunch and relax. "
            "Later enjoy a shikara ride on Dal Lake. "
            "The evening is free for shopping. "
            "Dinner and overnight at the houseboat."
        )
        out = to_paragraphs(raw)
        assert out.count("\n\n") >= 1
        # No sentence may be lost in the reshaping.
        assert "shikara ride" in out and "overnight at the houseboat" in out

    def test_short_text_stays_one_paragraph(self):
        raw = "Arrive Srinagar. Transfer to the houseboat."
        assert "\n\n" not in to_paragraphs(raw)

    def test_existing_bullet_list_preserved(self):
        raw = "- Breakfast and dinner\n- Private cab\n- Driver allowance"
        assert to_paragraphs(raw) == raw

    def test_pdf_hard_wrap_is_rejoined(self):
        raw = "Morning pick up from airport and drive to\nShimla. Arrive and check in."
        assert "drive to Shimla" in clean_text(raw)


class TestPolishPackage:
    def test_cleans_every_client_facing_field(self):
        pkg = {
            "overview": "Fantastic Himachal ‐ Package validity - 2019 dates.",
            "days": [
                {
                    "title": "DELHI - SHIMLA (345 Kms)",
                    "description": "Morning pick up. Drive to Shimla. Check in at hotel. Evening free. Overnight stay.",
                }
            ],
            "extra_sections": {
                "important_notes": "Note: This is just a proposal; we are not holding any rooms.",
                "inclusions": "Breakfast ‐ Dinner",
            },
            "hotels": [{"name": "Snow Valley ‐ Resort", "price_per_night": 4500}],
        }
        out = polish_package(pkg)

        assert "‐" not in out["overview"]
        assert "Package validity" not in out["overview"]
        assert out["days"][0]["title"] == "Delhi - Shimla (345 Kms)"
        # An emptied section is dropped rather than left as a blank heading.
        assert "important_notes" not in out["extra_sections"]
        assert out["extra_sections"]["inclusions"] == "Breakfast - Dinner"
        assert out["hotels"][0]["name"] == "Snow Valley - Resort"
        # Structured values must not be touched.
        assert out["hotels"][0]["price_per_night"] == 4500

    def test_is_safe_on_junk_input(self):
        assert polish_package({}) == {}
        assert polish_package({"days": None, "overview": None})["overview"] == ""
        assert polish_package({"days": ["not a dict"]})["days"] == ["not a dict"]


class TestNeverRaises:
    def test_handles_non_string_input(self):
        assert clean_text(None) == ""
        assert clean_text(42) == "42"
        assert clean_text(["a", "b"]) == "a\nb"
        assert clean_text({"content": "nested"}) == "nested"
