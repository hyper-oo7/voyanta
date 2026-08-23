"""
content_polish.py
=================
Turns raw supplier-PDF text into copy an agency can send to a client unedited.

Extracted text arrives carrying everything the supplier put in their brochure:
mojibake from the PDF's encoding, the supplier's own phone number, validity
windows that expired years ago, shouted route lines, and whole itineraries
flattened into a single run-on paragraph. Dropping that straight into a proposal
is what made exported documents look unfinished.

Everything here is deterministic — no model call, no network, no failure mode.
It cannot invent facts, so it only removes and reshapes: fix the encoding, drop
the supplier's marketing furniture, restore sentence case, and group sentences
into paragraphs. That is the part that must always work; generating richer prose
is a separate, optional step layered on top.
"""
import logging
import re
import unicodedata
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Typographic characters that survive PDF extraction badly. Mapped to plain
# ASCII so the same string renders identically in the app, a PDF and an email.
_CHAR_FIXES = {
    "‐": "-", "‑": "-", "‒": "-", "–": "-", "—": " - ",
    "―": "-", "−": "-",
    "‘": "'", "’": "'", "‚": "'", "‛": "'",
    "“": '"', "”": '"', "„": '"', "‟": '"',
    "•": "-", "‣": "-", "●": "-", "▪": "-", "·": "-",
    " ": " ", " ": " ", " ": " ", " ": " ", "﻿": "",
    "…": "...",
    "�": "",   # the replacement char — a byte that never decoded
}

# Lines that belong to the supplier, not to the agency's client.
_NOISE_PATTERNS = [
    re.compile(r"\bcall\s+us\b.*", re.I),
    re.compile(r"\bfor\s+(?:any\s+)?quer(?:y|ies)\b.*", re.I),
    re.compile(r"\bcontact\s+(?:us|no|number)\b.*", re.I),
    re.compile(r"\bwhats\s?app\b.*", re.I),
    re.compile(r"\b(?:mob|mobile|phone|tel|ph)\s*[:.]?\s*\+?\d[\d\s\-()]{7,}", re.I),
    re.compile(r"\bhttps?://\S+", re.I),
    re.compile(r"\bwww\.\S+", re.I),
    re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.]+\b"),
    # Bare phone numbers (>=9 digits) left on a line of their own.
    re.compile(r"^\s*\+?\d[\d\s\-()]{8,}\s*$"),
    # The supplier's own quote disclaimers.
    re.compile(r"\bthis\s+is\s+just\s+a\s+proposal\b.*", re.I),
    re.compile(r"\bsubject\s+to\s+availability\b.*", re.I),
    re.compile(r"\bwe\s+are\s+not\s+holding\s+any\s+rooms\b.*", re.I),
    # Expired commercial windows: "Package validity - 01st-Oct to 31st-March-2019"
    re.compile(r"\bpackage\s+validity\b.*", re.I),
    re.compile(r"\bvalid(?:ity)?\s*(?:till|until|upto|up\s+to)\b.*", re.I),
    re.compile(r"\brates?\s+valid\b.*", re.I),
    # Page furniture from the source document.
    re.compile(r"^\s*page\s+\d+\s*(?:of\s+\d+)?\s*$", re.I),
    re.compile(r"^\s*\[?extracted\s+tables?\s+from\s+page\s+\d+\]?\s*$", re.I),
]

# Sentence boundary that tolerates "Rs. 4,500" and "1.5 hrs" without splitting.
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+(?=[A-Z(])")

# A line that continues the previous one rather than starting a new block: PDF
# extraction hard-wraps mid-sentence, so unwrapping is needed before paragraphs.
_LIST_ITEM = re.compile(r"^\s*(?:[-*•]|\d+[.)])\s+")
_CONTINUES = re.compile(r"[a-z0-9,;:\-(]$")
_STARTS_LOWER = re.compile(r"^[a-z]")

_ACRONYMS = {
    "AC", "CP", "MAP", "AP", "EP", "GST", "PAN", "ID", "VIP", "TBD", "DVD",
    "SUV", "AM", "PM", "KM", "KMS", "HRS", "USD", "INR", "EUR", "GBP", "N", "D",
}


def _apply_char_fixes(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    for bad, good in _CHAR_FIXES.items():
        text = text.replace(bad, good)
    # Any remaining control characters other than newline/tab.
    return "".join(ch for ch in text if ch == "\n" or ch == "\t" or unicodedata.category(ch)[0] != "C")


def _is_noise(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return False
    for pattern in _NOISE_PATTERNS:
        if pattern.search(stripped):
            return True
    return False


def _strip_noise(line: str) -> str:
    """Remove a trailing noise fragment but keep the useful head of the line."""
    out = line
    for pattern in _NOISE_PATTERNS:
        out = pattern.sub("", out)
    return out


def desho_ut(text: str) -> str:  # pragma: no cover - alias guard
    return de_shout(text)


def de_shout(text: str) -> str:
    """
    Restore sentence case for shouted runs like 'DELHI - SHIMLA - MANALI'.

    Only touches runs of two or more all-caps words so genuine acronyms and
    single tokens (CP, MAP, 6N7D) survive untouched.
    """
    def fix_word(word: str) -> str:
        core = re.sub(r"[^A-Za-z]", "", word)
        if not core or core in _ACRONYMS or len(core) <= 1:
            return word
        if word.isupper():
            return word[:1] + word[1:].lower()
        return word

    def fix_run(match: re.Match) -> str:
        # Preserve whatever separators joined the run (spaces, dashes, slashes).
        return re.sub(r"[A-Za-z][A-Za-z'&.]*", lambda w: fix_word(w.group(0)), match.group(0))

    # Two or more shouted words, which may be joined by " - ", " / ", ", " etc.
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
        # A bullet or numbered item always starts its own line, however the
        # previous one ended — otherwise a clean list collapses into a blob.
        starts_item = bool(_LIST_ITEM.match(stripped))
        prev_is_item = bool(out and out[-1] and _LIST_ITEM.match(out[-1]))
        if (
            out
            and out[-1]
            and not starts_item
            and not prev_is_item
            and (_CONTINUES.search(out[-1]) or _STARTS_LOWER.match(stripped))
        ):
            out[-1] = f"{out[-1]} {stripped}"
        else:
            out.append(stripped)
    return out


def clean_text(value: Any) -> str:
    """
    Normalise one field of extracted text. Safe on any input, including None,
    numbers and nested lists, and never raises.
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
        lines = _unwrap(text.split("\n"))

        kept: List[str] = []
        for line in lines:
            if _is_noise(line):
                salvaged = _strip_noise(line).strip(" -–—:;,")
                # Keep the useful remainder only if it still reads as content.
                if len(salvaged) > 25:
                    kept.append(salvaged)
                continue
            kept.append(line)

        text = "\n".join(kept)
        text = de_shout(text)

        # Tidy spacing artefacts: " ." , "  ", " ,"
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\s+([.,;:!?])", r"\1", text)
        text = re.sub(r"\(\s+", "(", text)
        text = re.sub(r"\s+\)", ")", text)
        text = re.sub(r"-{2,}", "-", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()
    except Exception as exc:  # pragma: no cover - defensive
        logger.debug(f"[ContentPolish] clean_text fell back to raw input: {exc}")
        return value.strip()


def to_paragraphs(value: Any, sentences_per_paragraph: int = 3) -> str:
    """
    Group a run-on block into paragraphs separated by a blank line.

    Existing blank-line structure is respected; only stretches that are already
    one long block get regrouped, so hand-written copy is left alone.
    """
    text = clean_text(value)
    if not text:
        return ""

    blocks = [b.strip() for b in re.split(r"\n\s*\n", text) if b.strip()]
    out: List[str] = []

    for block in blocks:
        # A bullet/numbered list is already structured — leave it as-is.
        if re.match(r"^\s*(?:[-*]|\d+[.)])\s+", block) or "\n" in block:
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
    Clean every client-facing string on an extracted package, in place.

    Structured values (prices, counts, ids) are untouched — this only reshapes
    prose, so it is safe to run on any package regardless of source.
    """
    if not isinstance(package, dict):
        return package

    try:
        # Only reshape fields the package actually carries — never introduce a
        # key, so a caller can tell "absent" apart from "empty after cleaning".
        if "overview" in package:
            package["overview"] = to_paragraphs(package.get("overview"))

        days = package.get("days")
        if isinstance(days, list):
            for day in days:
                if not isinstance(day, dict):
                    continue
                title = clean_text(day.get("title"))
                # Titles read as headings, so keep them on one line.
                day["title"] = re.sub(r"\s*\n\s*", " - ", title)
                day["description"] = to_paragraphs(day.get("description"))
                for key in ("sub_destination", "schedule"):
                    if day.get(key):
                        day[key] = clean_text(day[key])

        sections = package.get("extra_sections")
        if isinstance(sections, dict):
            cleaned_sections: Dict[str, Any] = {}
            for key, raw in sections.items():
                text = to_paragraphs(raw)
                if text:
                    cleaned_sections[key] = text
            package["extra_sections"] = cleaned_sections

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
