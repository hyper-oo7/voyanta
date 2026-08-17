"""
Semantic chunking for travel documents.
Splits unstructured travel document text into contextual sections, day-by-day blocks, pricing grids, and activity chunks.
"""
import re
import logging
from typing import List, Dict, Any
from src.core.config import get_settings

logger = logging.getLogger(__name__)

class TravelDocumentChunker:
    SECTION_PATTERNS = [
        r"Day\s*\d+",
        r"Itinerary",
        r"Day\s*wise\s*plan",
        r"Schedule",
        r"Hotel\s*[Dd]etails?",
        r"Accommodation",
        r"Inclusions",
        r"Exclusions",
        r"Pricing",
        r"Cost",
        r"Terms\s*&?\s*Conditions",
        r"Activities",
        r"Sightseeing",
        r"Transfer",
        r"Welcome\s*to",
        r"Arrival",
        r"Departure",
    ]
    
    def __init__(self, chunk_size: int = None, overlap: int = None):
        settings = get_settings()
        self.chunk_size = chunk_size or settings.CHUNK_SIZE
        self.overlap = overlap or settings.CHUNK_OVERLAP
        self.section_regex = re.compile(
            r"(^|\n)(" + "|".join(self.SECTION_PATTERNS) + r")[^\n]*",
            re.IGNORECASE
        )
    
    def chunk_text(self, text: str, metadata: Dict[str, Any]) -> List[Dict[str, Any]]:
        sections = self._split_by_sections(text)
        chunks = []
        for section in sections:
            section_chunks = self._chunk_section(section["text"], section["header"])
            for chunk_item in section_chunks:
                if isinstance(chunk_item, dict):
                    chunk_text_val = chunk_item.get("content", "").strip()
                    context_win = chunk_item.get("context_window", chunk_text_val).strip()
                else:
                    chunk_text_val = str(chunk_item).strip()
                    context_win = chunk_text_val

                chunk_meta = {
                    **metadata,
                    "section_title": section["header"],
                    "chunk_type": self._detect_chunk_type(section["header"], chunk_text_val),
                    "context_window": context_win,
                }
                chunks.append({
                    "content": chunk_text_val,
                    "metadata": chunk_meta,
                })
        logger.info(f"[Chunker] Document chunked: total_chunks={len(chunks)}, doc_name={metadata.get('document_name')}")
        return chunks
    
    def _split_by_sections(self, text: str) -> List[Dict[str, str]]:
        matches = list(self.section_regex.finditer(text))
        if not matches:
            return [{"header": "General", "text": text}]
        sections = []
        for i, match in enumerate(matches):
            start = match.start()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
            header = match.group(2).strip()
            section_text = text[start:end].strip()
            sections.append({"header": header, "text": section_text})
        return sections
    
    def _chunk_section(self, text: str, header: str) -> List[Dict[str, str]]:
        if len(text) <= self.chunk_size:
            return [{"content": text, "context_window": text}]
        if self._detect_chunk_type(header, text) == "pricing":
            return self._chunk_pricing(text)
        return self._chunk_by_sentences(text)
    
    def _chunk_by_sentences(self, text: str, window_size: int = 2) -> List[Dict[str, str]]:
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
        if not sentences:
            return [{"content": text, "context_window": text}]

        chunks = []
        current_chunk_sentences = []
        current_chunk_indices = []
        current_len = 0

        for idx, sentence in enumerate(sentences):
            sent_len = len(sentence)
            if current_len + sent_len > self.chunk_size and current_chunk_sentences:
                content = " ".join(current_chunk_sentences)
                min_idx = current_chunk_indices[0]
                max_idx = current_chunk_indices[-1]
                win_start = max(0, min_idx - window_size)
                win_end = min(len(sentences), max_idx + window_size + 1)
                context_window = " ".join(sentences[win_start:win_end])

                chunks.append({
                    "content": content,
                    "context_window": context_window
                })

                overlap_sentences = []
                overlap_indices = []
                overlap_len = 0
                for s, i in zip(reversed(current_chunk_sentences), reversed(current_chunk_indices)):
                    if overlap_len + len(s) > self.overlap:
                        break
                    overlap_sentences.insert(0, s)
                    overlap_indices.insert(0, i)
                    overlap_len += len(s)
                current_chunk_sentences = overlap_sentences
                current_chunk_indices = overlap_indices
                current_len = overlap_len

            current_chunk_sentences.append(sentence)
            current_chunk_indices.append(idx)
            current_len += sent_len

        if current_chunk_sentences:
            content = " ".join(current_chunk_sentences)
            min_idx = current_chunk_indices[0]
            max_idx = current_chunk_indices[-1]
            win_start = max(0, min_idx - window_size)
            win_end = min(len(sentences), max_idx + window_size + 1)
            context_window = " ".join(sentences[win_start:win_end])
            chunks.append({
                "content": content,
                "context_window": context_window
            })
        return chunks
    
    def _chunk_pricing(self, text: str) -> List[Dict[str, str]]:
        lines = [l for l in text.split("\n") if l.strip()]
        if not lines:
            return [{"content": text, "context_window": text}]

        chunks = []
        current = []
        current_len = 0
        for line in lines:
            line_len = len(line)
            if current_len + line_len > self.chunk_size and current:
                content = "\n".join(current)
                chunks.append({"content": content, "context_window": content})
                current = []
                current_len = 0
            current.append(line)
            current_len += line_len
        if current:
            content = "\n".join(current)
            chunks.append({"content": content, "context_window": content})
        return chunks
    
    def _detect_chunk_type(self, header: str, text: str) -> str:
        h = header.lower()
        t = text.lower()
        if any(w in h for w in ["price", "cost", "rate", "₹", "inr"]):
            return "pricing"
        if any(w in h for w in ["hotel", "accommodation", "resort", "stay"]):
            return "hotel"
        if any(w in h for w in ["activity", "sightseeing", "visit", "tour", "adventure"]):
            return "activity"
        if any(w in h for w in ["transfer", "transport", "flight", "train", "cab", "volvo"]):
            return "transport"
        if any(w in h for w in ["inclusion", "exclusion", "term", "condition"]):
            return "terms"
        if re.search(r"day\s*\d+", h):
            return "itinerary_day"
        if any(w in t for w in ["manali", "shimla", "goa", "kerala", "rajasthan", "kashmir", "ladakh"]):
            return "destination_info"
        return "general"
