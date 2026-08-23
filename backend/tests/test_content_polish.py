"""Coverage for the extracted-content cleaner.

The samples here are taken from real supplier PDFs already in the vault, since
those are the shapes that made exported proposals look unfinished.
"""
from src.services.content_polish import (
    clean_text,
    de_shout,
    polish_package,
    split_trailing_sections,
    to_paragraphs,
)


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


class TestBrochureArtefacts:
    """Shapes taken from a real Sri Lanka supplier deck."""

    def test_bracketed_page_markers_removed(self):
        assert clean_text("[Page 4]\nArrive in Colombo.") == "Arrive in Colombo."

    def test_vertically_exploded_heading_removed(self):
        raw = "[Page 4]\nD\nA\nY\nW\nI\nS\nE\n\nITINERARY\n\nArrive in Colombo."
        assert clean_text(raw) == "Arrive in Colombo."

    def test_letterspaced_heading_removed(self):
        raw = "O N A L L C R E D I T A N D D E B I T C A R D S"
        assert clean_text(raw) == ""

    def test_short_capitalised_line_is_not_mistaken_for_letterspacing(self):
        assert clean_text("A B C") == "A B C"


class TestSupplierIdentityNeverLeaks:
    """A proposal must never carry another company's settlement details."""

    def test_bank_details_removed(self):
        raw = (
            "Account Name: RAAHGIR TRAVELS PRIVATE LIMITED\n"
            "Bank Name: ICICI Bank\n"
            "Account Number: 022405005030\n"
            "IFSC Code: ICIC0000224"
        )
        assert clean_text(raw) == ""

    def test_upi_and_gateway_removed(self):
        raw = "UPI ID: raahg02670.ibz@icici\nClick here to pay with Razorpay"
        assert clean_text(raw) == ""

    def test_social_handle_and_domain_removed(self):
        raw = "@desh.videsh.in\ninfo@deshvideshtravels.com\nwww.deshvideshtravels.com"
        assert clean_text(raw) == ""


class TestDaysKeepOnlyDayContent:
    def test_trailing_sections_are_split_off_the_day(self):
        day = (
            "DEPARTURE\n"
            "After breakfast, transfer to the airport for your departure.\n\n"
            "[Page 10]\nINCLUSION\n\n"
            "All transfers in an air-conditioned vehicle\n\n"
            "[Page 11]\nEXCLUSIONS\n\n"
            "Airfare and visa fees"
        )
        body, sections = split_trailing_sections(day)

        assert "transfer to the airport" in body
        assert "air-conditioned" not in body
        assert "Airfare" not in body
        assert "air-conditioned" in sections["inclusions"]
        assert "Airfare" in sections["exclusions"]

    def test_recovered_content_lands_in_extra_sections(self):
        pkg = {
            "days": [{
                "title": "DEPARTURE",
                "description": (
                    "After breakfast, transfer to the airport.\n\n"
                    "INCLUSION\n\nAll transfers in an air-conditioned vehicle"
                ),
            }],
            "extra_sections": {},
        }
        out = polish_package(pkg)
        assert out["days"][0]["description"] == "After breakfast, transfer to the airport."
        assert "air-conditioned" in out["extra_sections"]["inclusions"]

    def test_directly_extracted_section_is_not_overwritten(self):
        pkg = {
            "days": [{
                "title": "Day 8",
                "description": "Depart.\n\nINCLUSION\n\nRecovered text",
            }],
            "extra_sections": {"inclusions": "Authoritative text"},
        }
        out = polish_package(pkg)
        assert out["extra_sections"]["inclusions"] == "Authoritative text"

    def test_section_heading_is_never_glued_onto_the_previous_line(self):
        raw = "Train ticket (subject to availability)\n\nEXCLUSIONS\n\nAirfare"
        _, sections = split_trailing_sections(raw)
        assert "exclusions" in sections
        assert "Airfare" in sections["exclusions"]


class TestLegitimateContentSurvives:
    def test_availability_qualifier_is_kept(self):
        # A supplier disclaimer on its own line reads like noise, but the same
        # words qualify a real inclusion.
        assert clean_text("Train ticket (subject to availability)") == "Train ticket (subject to availability)"

    def test_ampersand_wrap_is_rejoined(self):
        raw = "Beverages, lunch & dinner throughout the tour (except dinner at Kandy &\nSigiriya)"
        assert clean_text(raw) == "Beverages, lunch & dinner throughout the tour (except dinner at Kandy & Sigiriya)"

    def test_blank_line_separated_items_stay_separate(self):
        raw = "Accommodation in Colombo\n\nAll transfers by vehicle\n\nEnglish-speaking guide"
        out = to_paragraphs(raw)
        assert out.count("\n\n") == 2
