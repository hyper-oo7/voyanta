"""
content_polish.py
=================
Turns raw supplier-PDF text into copy an agency can send to a client unedited.

Extracted text arrives carrying everything the supplier put in their brochure:
mojibake from the PDF's encoding, decorative titles exploded one glyph per line,
"[Page 4]" markers, the supplier's own phone number and bank account, validity
windows that expired years ago, and whole itineraries flattened into a single
run-on paragraph. Worse, the trailing pages — inclusions, exclusions, payment
terms, contact details — routinely get swept into the final day's description,
so the last day of an itinerary reads as the entire back half of the brochure.

Two jobs, then:

  1. Strip anything that is not client-facing content.
  2. Keep days to day content, and route trailing material to the section it
     belongs to.

Everything here is deterministic — no model call, no network, no failure mode.
It cannot invent facts, so it only removes, reshapes and re-files.
"""
import logging
import re
import unicodedata
from typing import Any, Dict, List, Tuple

logger = logging.getLogger(__name__)

# Typographic characters that survive PDF extraction badly. Mapped to plain
# ASCII so the same string renders identically in the app, a PDF and an email.
_CHAR_FIXES = {
    "‐": "-", "‑": "-", "‒": "-", "–": "-", "—": " - ",
    "―": "-", "−": "-",
    "‘": "'", "’": "'", "‚": "'", "‛": "'",
    "“": '"', "”": '"', "„": '"', "‟": '"',
    "•": "-", "‣": "-", "●": "-", "▪": "-", "·": "-",
    " ": " ", " ": " ", " ": " ", " ": " ", "﻿": "",
    "…": "...",
    "�": "",   # the replacement char — a byte that never decoded
}

# Lines that belong to the supplier's brochure, not to the agency's client.
_NOISE_PATTERNS = [
    re.compile(r"\bcall\s+us\b.*", re.I),
    re.compile(r"\bfor\s+(?:any\s+)?quer(?:y|ies)\b.*", re.I),
    re.compile(r"\bcontact\s+(?:us|no|number)\b.*", re.I),
    re.compile(r"\bwhats\s?app\b.*", re.I),
    re.compile(r"\b(?:mob|mobile|phone|tel|ph)\s*[:.]?\s*\+?\d[\d\s\-()]{7,}", re.I),
    re.compile(r"\bhttps?://\S+", re.I),
    re.compile(r"\bwww\.\S+", re.I),
    re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.]+\b"),
    re.compile(r"^\s*\+?\d[\d\s\-()]{8,}\s*$"),
    # The supplier's own quote disclaimers.
    re.compile(r"\bthis\s+is\s+just\s+a\s+proposal\b.*", re.I),
    re.compile(r"\bwe\s+are\s+not\s+holding\s+any\s+rooms\b.*", re.I),
    # NB: "subject to availability" is deliberately not listed. It reads as a
    # supplier disclaimer on its own line, but it is also a legitimate qualifier
    # inside an inclusion — "Train ticket (subject to availability)" — and
    # matching it there deleted the inclusion with it.
    # Commercial windows that expire and then read as wrong.
    re.compile(r"\bpackage\s+validity\b.*", re.I),
    re.compile(r"\bvalid(?:ity)?\s*(?:till|until|upto|up\s+to)\b.*", re.I),
    re.compile(r"\brates?\s+valid\b.*", re.I),
    # Page furniture injected by the extractor or present in the source.
    re.compile(r"^\s*page\s+\d+\s*(?:of\s+\d+)?\s*$", re.I),
    re.compile(r"^\s*\[?\s*extracted\s+tables?\s+from\s+page\s+\d+\s*\]?\s*$", re.I),
    re.compile(r"\[\s*page\s*\d+\s*\]", re.I),
    # Decorative brochure furniture carrying no itinerary information.
    re.compile(r"^\s*day\s*-?\s*wise\s+itinerary\s*$", re.I),
    re.compile(r"^\s*daywise\s+itinerary\s*$", re.I),
    re.compile(r"^\s*where\s+every\s+trip\s+starts\b.*", re.I),
    # Fragments of decorative headings that arrive one word per line.
    re.compile(r"^\s*sounds\s*$", re.I),
    re.compile(r"^\s*awesome[,!.]?\s*$", re.I),
    re.compile(r"^\s*click\s+here\b.*", re.I),
    # Lone decorative words left standing once their exploded run is dropped.
    re.compile(r"^\s*itinerary\s*$", re.I),
    re.compile(r"^\s*overview\s*$", re.I),
    re.compile(r"^\s*highlights?\s*$", re.I),
]

# The supplier's settlement and identity details. These must never reach a
# proposal the agency sends: it would put another company's bank account, UPI
# handle and social profile on their own quote.
_SUPPLIER_IDENTITY_PATTERNS = [
    re.compile(r"\baccount\s*(?:name|number|no\.?|type)\s*[:.]?.*", re.I),
    re.compile(r"\bbank\s*name\s*[:.]?.*", re.I),
    re.compile(r"\bifsc\s*(?:code)?\s*[:.]?.*", re.I),
    re.compile(r"\bupi\s*id\s*[:.]?.*", re.I),
    re.compile(r"\b[\w.-]+@(?:icici|okhdfcbank|oksbi|okaxis|paytm|ybl|apl|upi)\b", re.I),
    re.compile(r"\b(?:razorpay|payment\s+gate?way|phonepe)\b.*", re.I),
    re.compile(r"\bno\s+cost\s+emi\b.*", re.I),
    re.compile(r"^\s*\d\s*[).]\s*(?:by\s+)?(?:account\s+transfer|bank\s+transfer|upi|cash|cheque|card)\s*$", re.I),
    # A payment-method list, whether one per line or run together by unwrapping
    # ("Cash Bank Transfer UPI").
    re.compile(
        r"^\s*(?:cash|cheque|bank\s+transfer|upi|debit\s+card|credit\s+card)"
        r"(?:\s+(?:cash|cheque|bank\s+transfer|upi|debit\s+card|credit\s+card))*\s*$",
        re.I,
    ),
    re.compile(r"\bpayment\s+gate?way\s+charge\b.*", re.I),
    re.compile(r"\bwe\s+accept\s+payment\b.*", re.I),
    re.compile(r"\bfollowing\s+mode\s+of\s+payments?\b.*", re.I),
    re.compile(r"\b(?:private\s+limited|pvt\.?\s*ltd\.?|llp)\b.*", re.I),
    re.compile(r"^\s*@[\w.]+\s*$"),
]

# Headings that mark the end of day content and the start of a back-matter
# section. Matched on short standalone lines only, so a sentence that merely
# mentions "inclusions" is not treated as a heading.
_SECTION_HEADINGS: List[Tuple[re.Pattern, str]] = [
    (re.compile(r"^\W*(?:package\s+)?inclusions?\b", re.I), "inclusions"),
    (re.compile(r"^\W*(?:package\s+)?exclusions?\b", re.I), "exclusions"),
    (re.compile(r"^\W*(?:price|cost|package)\s+(?:includes?|excludes?)\b", re.I), "inclusions"),
    (re.compile(r"^\W*payment\s*(?:process|terms|methods?|policy|mode)?\b", re.I), "payment"),
    (re.compile(r"^\W*(?:terms\s*(?:and|&)\s*conditions|general\s+terms)\b", re.I), "terms_and_conditions"),
    (re.compile(r"^\W*cancellation\s*(?:policy|charges|terms)?\b", re.I), "cancellation_policy"),
    (re.compile(r"^\W*refund\s*(?:policy)?\b", re.I), "refund"),
    (re.compile(r"^\W*(?:package\s+costing|costing|tariff|price\s+details)\b", re.I), "package_costing"),
    (re.compile(r"^\W*(?:what\s+to\s+pack|things\s+to\s+carry|packing\s+list)\b", re.I), "what_to_pack"),
    (re.compile(r"^\W*visa\s*(?:guidelines|information|requirements|info)?\b", re.I), "visa_guidelines"),
    (re.compile(r"^\W*(?:important\s+notes?|please\s+note|general\s+notes?)\b", re.I), "important_notes"),
    (re.compile(r"^\W*(?:do'?s\s*(?:and|&)\s*don'?ts)\b", re.I), "dos_and_donts"),
    (re.compile(r"^\W*(?:office\s+address|contact\s+us|our\s+address)\b", re.I), "office_address"),
    (re.compile(r"^\W*(?:booking\s+(?:process|amount|policy))\b", re.I), "payment"),
    (re.compile(r"^\W*reserve\s+your\s+seat\b", re.I), "payment"),
    (re.compile(r"^\W*starting\s*@", re.I), "package_costing"),
    # Marketing headings that introduce the pricing page. Treated as headings
    # rather than noise so they switch section instead of vanishing and leaving
    # the price copy filed under whatever came before.
    (re.compile(r"^\W*how\s+much\s+do\s+i\s+pay\b", re.I), "package_costing"),
    (re.compile(r"^\W*sounds\s+awesome\b", re.I), "package_costing"),
]

_MAX_HEADING_LEN = 60

# Sentence boundary that tolerates "Rs. 4,500" and "1.5 hrs" without splitting.
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+(?=[A-Z(])")

_LIST_ITEM = re.compile(r"^\s*(?:[-*•]|\d+[.)])\s+")
# A line ending on any of these was cut mid-phrase by the PDF's wrap width.
_CONTINUES = re.compile(r"[a-z0-9,;:\-(&/+]$")
_STARTS_LOWER = re.compile(r"^[a-z]")

_ACRONYMS = {
    "AC", "CP", "MAP", "AP", "EP", "GST", "TCS", "PAN", "ID", "VIP", "TBD",
    "SUV", "AM", "PM", "KM", "KMS", "HRS", "USD", "INR", "EUR", "GBP", "EMI",
    "UPI", "IFSC", "N", "D",
}


# ── primitives ──────────────────────────────────────────────────────────────

def _apply_char_fixes(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    for bad, good in _CHAR_FIXES.items():
        text = text.replace(bad, good)
    return "".join(
        ch for ch in text
        if ch in "\n\t" or unicodedata.category(ch)[0] != "C"
    )


def _is_letterspaced(line: str) -> bool:
    """
    True for design headings set with wide letter-spacing, which extract as
    "O N A L L C R E D I T A N D D E B I T C A R D S". Word boundaries are
    unrecoverable and such lines are always decorative, so they are dropped
    rather than guessed at.
    """
    tokens = line.split()
    if len(tokens) < 6:
        return False
    singles = sum(1 for tok in tokens if len(tok) == 1 and tok.isalpha())
    return singles >= max(6, int(len(tokens) * 0.6))


def _drop_exploded_runs(lines: List[str]) -> List[str]:
    """
    Drop vertically exploded headings — one glyph per line, as produced by large
    letter-spaced titles ("D/A/Y/W/I/S/E"). Three or more consecutive
    single-character lines are never itinerary content.
    """
    out: List[str] = []
    run: List[str] = []

    def flush() -> None:
        if len(run) < 3:
            out.extend(run)
        run.clear()

    for line in lines:
        stripped = line.strip()
        if len(stripped) == 1 and stripped.isalpha():
            run.append(line)
        else:
            flush()
            out.append(line)
    flush()
    return out


def _is_noise(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return False
    if _is_letterspaced(stripped):
        return True
    for pattern in _NOISE_PATTERNS:
        if pattern.search(stripped):
            return True
    for pattern in _SUPPLIER_IDENTITY_PATTERNS:
        if pattern.search(stripped):
            return True
    return False


def _strip_noise(line: str) -> str:
    """Remove a noise fragment but keep the useful head of the line."""
    out = line
    for pattern in _NOISE_PATTERNS:
        out = pattern.sub("", out)
    for pattern in _SUPPLIER_IDENTITY_PATTERNS:
        out = pattern.sub("", out)
    return out


def de_shout(text: str) -> str:
    """
    Restore sentence case for shouted runs like 'DELHI - SHIMLA - MANALI'.

    Only runs of two or more all-caps words are touched, so genuine acronyms and
    single tokens (CP, MAP, 6N7D) survive untouched.
    """
    def fix_word(word: str) -> str:
        core = re.sub(r"[^A-Za-z]", "", word)
        if not core or core.upper() in _ACRONYMS or len(core) <= 1:
            return word
        if word.isupper():
            return word[:1] + word[1:].lower()
        return word

    def fix_run(match: re.Match) -> str:
        # Preserve whatever separators joined the run (spaces, dashes, slashes).
        return re.sub(r"[A-Za-z][A-Za-z'&.]*", lambda w: fix_word(w.group(0)), match.group(0))

    return re.sub(
        r"\b[A-Z][A-Z'&.]+(?:\s*[-/,&]\s*|\s+)(?:[A-Z][A-Z'&.]+(?:\s*[-/,&]\s*|\s+)?)+",
        fix_run,
        text,
    )


def _unwrap(lines: List[str]) -> List[str]:
    """Rejoin lines that a PDF hard-wrapped mid-sentence."""
    out: List[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            out.append("")
            continue
        starts_item = bool(_LIST_ITEM.match(stripped))
        prev_is_item = bool(out and out[-1] and _LIST_ITEM.match(out[-1]))
        # A section heading always starts its own line. Gluing "EXCLUSIONS" onto
        # the tail of the last inclusion hides the heading, and everything that
        # follows is then filed under the wrong section.
        starts_section = bool(match_section_heading(stripped))
        if (
            out
            and out[-1]
            and not starts_item
            and not prev_is_item
            and not starts_section
            and (_CONTINUES.search(out[-1]) or _STARTS_LOWER.match(stripped))
        ):
            # A line broken on a hyphen rejoins without a space, or "ocean-\n
            # facing" comes back as "ocean- facing".
            if out[-1].endswith("-"):
                out[-1] = f"{out[-1]}{stripped}"
            else:
                out[-1] = f"{out[-1]} {stripped}"
        else:
            out.append(stripped)
    return out


# ── public API ──────────────────────────────────────────────────────────────

def clean_text(value: Any) -> str:
    """
    Normalise one field of extracted text. Safe on any input, including None,
    numbers, lists and dicts, and never raises.
    """
    if value is None:
        return ""
    if isinstance(value, (list, tuple)):
        return "\n".join(filter(None, (clean_text(v) for v in value)))
    if isinstance(value, dict):
        return clean_text(value.get("content", ""))
    if not isinstance(value, str):
        return str(value).strip()

    try:
        text = _apply_char_fixes(value)
        # Exploded headings go first, or their glyphs get glued onto the end of
        # the preceding sentence by the unwrapper.
        lines = _drop_exploded_runs(text.split("\n"))
        lines = _unwrap(lines)

        kept: List[str] = []
        for line in lines:
            if _is_noise(line):
                salvaged = _strip_noise(line).strip(" -:;,")
                # Only keep a remainder when stripping genuinely removed a
                # fragment. Without this a whole-line reject that no pattern
                # rewrites — a letter-spaced heading, say — is re-added intact.
                if salvaged and salvaged != line.strip() and len(salvaged) > 25:
                    kept.append(salvaged)
                continue
            kept.append(line)

        text = "\n".join(kept)
        text = de_shout(text)

        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\s+([.,;:!?])", r"\1", text)
        text = re.sub(r"\(\s+", "(", text)
        text = re.sub(r"\s+\)", ")", text)
        text = re.sub(r"-{2,}", "-", text)
        # Stripping a parenthetical such as "(subject to availability)" leaves
        # the opening bracket stranded on the end of the line.
        text = re.sub(r"\(\s*(?=$|\n)", "", text)
        text = re.sub(r"(?:^|(?<=\n))\s*\)", "", text)
        text = re.sub(r"\(\s*\)", "", text)
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()
    except Exception as exc:  # pragma: no cover - defensive
        logger.debug(f"[ContentPolish] clean_text fell back to raw input: {exc}")
        return value.strip()


def match_section_heading(line: str) -> str:
    """Return the section key a short standalone heading names, else ''."""
    stripped = line.strip()
    if not stripped or len(stripped) > _MAX_HEADING_LEN:
        return ""
    # A heading is a label, not a sentence.
    if stripped.endswith((".", "!", "?")) and len(stripped.split()) > 6:
        return ""
    for pattern, key in _SECTION_HEADINGS:
        if pattern.search(stripped):
            return key
    return ""


def split_trailing_sections(value: Any) -> Tuple[str, Dict[str, str]]:
    """
    Separate day content from back-matter that followed it.

    Supplier PDFs run the itinerary straight into inclusions, exclusions,
    payment terms and contact pages, and the extractor hands the whole tail to
    the final day. Everything before the first section heading stays with the
    day; everything after is filed under the section it belongs to.

    Returns (day_text, {section_key: section_text}).
    """
    text = clean_text(value)
    if not text:
        return "", {}

    body: List[str] = []
    sections: Dict[str, List[str]] = {}
    current: str = ""

    for line in text.split("\n"):
        key = match_section_heading(line)
        if key:
            current = key
            sections.setdefault(current, [])
            continue
        if current:
            sections[current].append(line)
        else:
            body.append(line)

    cleaned_sections = {}
    for key, lines in sections.items():
        joined = "\n".join(lines).strip()
        if joined:
            cleaned_sections[key] = joined

    return "\n".join(body).strip(), cleaned_sections


# An address carries a number, a comma-separated locality, or a place word.
# Without any of those it is a strapline that landed in the wrong section —
# "A Smile And Ends With A Story", the tail of a brochure footer.
def _looks_like_address(text: str) -> bool:
    return (
        any(ch.isdigit() for ch in text)
        or "," in text
        or bool(re.search(r"\b(road|street|st\.|lane|avenue|floor|block|nagar|sector|plot|suite|pin|zip|city|state)\b", text, re.I))
    )


_SECTION_VALIDATORS = {
    "office_address": _looks_like_address,
}


def _is_meaningful_section(text: str, key: str = "") -> bool:
    """
    True when a section body carries content rather than an echo of its own
    heading or a leftover marketing line.

    The extractor regularly returns "Terms & Conditions" as the entire body of
    the terms section, and files a strapline ("...ends with a story") under
    office_address. Rendering those produces a heading with nothing under it,
    which reads worse in a client document than omitting the section.
    """
    if not text or len(text.strip()) < 12:
        return False
    lines = [ln for ln in (l.strip() for l in text.split("\n")) if ln]
    if not lines:
        return False
    # Every line is just a section heading.
    if all(match_section_heading(ln) for ln in lines):
        return False
    # Some sections can be sanity-checked against what they claim to hold. This
    # is deliberately narrow: a general "too short / no punctuation" rule also
    # rejected real content such as "All transfers in an air-conditioned
    # vehicle", so only sections with an unmistakable shape are validated.
    validator = _SECTION_VALIDATORS.get(key)
    if validator and not validator(text):
        return False
    return True


def to_paragraphs(value: Any, sentences_per_paragraph: int = 3) -> str:
    """
    Group a run-on block into paragraphs separated by a blank line.

    Existing blank-line structure and lists are respected; only stretches that
    are already one long block get regrouped, so hand-written copy is untouched.
    """
    text = clean_text(value)
    if not text:
        return ""

    blocks = [b.strip() for b in re.split(r"\n\s*\n", text) if b.strip()]
    out: List[str] = []

    for block in blocks:
        if _LIST_ITEM.match(block) or "\n" in block:
            out.append(block)
            continue

        sentences = _SENTENCE_SPLIT.split(block)
        if len(sentences) <= sentences_per_paragraph:
            out.append(block)
            continue

        for i in range(0, len(sentences), sentences_per_paragraph):
            out.append(" ".join(s.strip() for s in sentences[i:i + sentences_per_paragraph]))

    return "\n\n".join(out)


def polish_package(package: Dict[str, Any]) -> Dict[str, Any]:
    """
    Clean every client-facing string on an extracted package, in place, and move
    any back-matter that leaked into a day into its proper section.

    Structured values (prices, counts, ids) are untouched, and no key is
    introduced that the package did not already carry.
    """
    if not isinstance(package, dict):
        return package

    try:
        recovered: Dict[str, str] = {}

        if "overview" in package:
            body, spilled = split_trailing_sections(package.get("overview"))
            package["overview"] = to_paragraphs(body)
            recovered.update(spilled)

        days = package.get("days")
        if isinstance(days, list):
            for day in days:
                if not isinstance(day, dict):
                    continue

                title = clean_text(day.get("title"))
                # A title is a heading: keep it on one line and drop any
                # back-matter heading that was concatenated onto it.
                title = re.sub(r"\s*\n\s*", " - ", title)
                day["title"] = title

                body, spilled = split_trailing_sections(day.get("description"))
                day["description"] = to_paragraphs(body)
                for key, text in spilled.items():
                    # Earlier days win only if a later day adds nothing; joining
                    # keeps content from being silently dropped.
                    recovered[key] = f"{recovered[key]}\n{text}".strip() if key in recovered else text

                for key in ("sub_destination", "schedule"):
                    if day.get(key):
                        day[key] = clean_text(day[key])

        sections = package.get("extra_sections")
        if isinstance(sections, dict) or recovered:
            merged: Dict[str, Any] = {}
            for key, raw in (sections or {}).items():
                # The extractor often repeats the heading as the first line of
                # the body, and sometimes files content under the wrong key.
                # Re-splitting drops the echoed heading and re-routes the rest.
                body, spilled = split_trailing_sections(raw)
                for spill_key, spill_text in spilled.items():
                    if spill_key == key:
                        body = f"{body}\n{spill_text}".strip() if body else spill_text
                    elif not recovered.get(spill_key):
                        recovered[spill_key] = spill_text
                text = to_paragraphs(body)
                if _is_meaningful_section(text, key):
                    merged[key] = text
            # Content recovered from a day only fills a section that is missing
            # or empty — never overwrites what the extractor found directly.
            for key, text in recovered.items():
                if not merged.get(key):
                    polished = to_paragraphs(text)
                    if _is_meaningful_section(polished, key):
                        merged[key] = polished
            package["extra_sections"] = merged

        for list_key in ("inclusions", "exclusions"):
            items = package.get(list_key)
            if isinstance(items, list):
                package[list_key] = [t for t in (clean_text(i) for i in items) if t]
            elif isinstance(items, str):
                package[list_key] = clean_text(items)

        for entity_key in ("hotels", "activities"):
            entities = package.get(entity_key)
            if isinstance(entities, list):
                for entity in entities:
                    if not isinstance(entity, dict):
                        continue
                    for field in ("name", "location", "description", "details", "meal_plan", "category"):
                        if entity.get(field):
                            entity[field] = clean_text(entity[field])
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning(f"[ContentPolish] polish_package skipped after error: {exc}")

    return package
