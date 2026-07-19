import io
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
import pandas as pd

logger = logging.getLogger(__name__)

def build_normalized_fields(data: Dict[str, Any], source_type: str) -> Dict[str, Any]:
    """
    Constructs the 'fields' dictionary mapping each path to its confidence metadata,
    doubt status, and doubt_reason for UI red wavy underlining.
    """
    fields = {}
    tracked_paths = [
        "destination", "sub_destinations", "duration_days", "total_price",
        "currency", "days", "hotels", "flights", "activities", "extra_sections"
    ]
    for path in tracked_paths:
        val = data.get(path)
        is_missing = val is None or val == "" or val == [] or val == {}
        
        doubtful = False
        doubt_reason = ""
        
        if is_missing:
            source = "missing"
            confidence = 0.0
            needs_review = True
            doubtful = True
            doubt_reason = f"Missing {path.replace('_', ' ')} from document."
        else:
            if path == "currency" and source_type == "pdf":
                source = "deterministic"
                confidence = 1.0
                needs_review = False
            else:
                source = "ai"
                confidence = 0.95
                needs_review = False
            
            if path == "total_price":
                if val is None or val == 0:
                    needs_review = True
                    doubtful = True
                    confidence = 0.4
                    doubt_reason = "Total price not explicitly stated or extracted as 0."
                elif isinstance(val, (int, float)) and val < 100:
                    needs_review = True
                    doubtful = True
                    confidence = 0.7
                    doubt_reason = f"Total price ({val}) appears unusually low for a package."
            elif path == "destination":
                if not val or len(str(val).strip()) < 3:
                    needs_review = True
                    doubtful = True
                    confidence = 0.6
                    doubt_reason = "Destination name is ambiguous or very short."
            elif path == "hotels":
                if isinstance(val, list):
                    if len(val) == 0:
                        raw_text = (data.get("_raw_text") or "").lower()
                        if any(kw in raw_text for kw in ["hotel", "resort", "stay", "accommodation", "premium hotel"]):
                            needs_review = True
                            doubtful = True
                            confidence = 0.3
                            doubt_reason = "No hotels extracted, but stay/accommodation references found."
                    else:
                        missing_prices = sum(1 for h in val if h.get("price_per_night") is None)
                        if missing_prices > 0:
                            needs_review = True
                            doubtful = True
                            confidence = round(max(0.7, 0.95 - (missing_prices * 0.05)), 2)
                            doubt_reason = f"{missing_prices} hotel(s) missing itemized night price."
            elif path == "days":
                if isinstance(val, list) and len(val) == 0:
                    needs_review = True
                    doubtful = True
                    confidence = 0.2
                    doubt_reason = "No itinerary days extracted from document."
                
        fields[path] = {
            "value": val,
            "confidence": confidence,
            "source": source,
            "needs_review": needs_review,
            "doubtful": doubtful,
            "doubt_reason": doubt_reason
        }
    return fields

def compile_normalized_package(extracted: Dict[str, Any], source_type: str, destination_hint: str = "", budget_hint: float = 0.0, currency_hint: str = "INR") -> Dict[str, Any]:
    """
    Combines extracted package fields with flat list conversions to produce the standard schema,
    computing exact overall_confidence_score across all fields.
    """
    days = extracted.get("days", [])
    hotels = []
    # 1. Initialize with top-level hotels from summary tables
    for h in extracted.get("hotels", []):
        if h and h.get("name") and h.get("name").strip():
            if h.get("name").strip().lower() not in [x.get("name").strip().lower() for x in hotels]:
                hotels.append(h)
                
    # 2. Add hotels from daily itineraries
    for d in days:
        for h in d.get("hotels", []):
            if h and h.get("name") and h.get("name").strip():
                if h.get("name").strip().lower() not in [x.get("name").strip().lower() for x in hotels]:
                    hotels.append(h)

    # 3. Auto-distribute summary hotels to individual days if the day has no hotels listed
    # but has a matching sub-destination.
    for d in days:
        if not d.get("hotels") or len(d.get("hotels")) == 0:
            day_sub = (d.get("sub_destination") or "").strip().lower()
            day_title = (d.get("title") or "").strip().lower()
            if day_sub or day_title:
                matching_hotels = []
                for h in hotels:
                    h_loc = (h.get("location") or "").strip().lower()
                    if h_loc and (h_loc in day_sub or h_loc in day_title or day_sub in h_loc):
                        matching_hotels.append(h)
                if matching_hotels:
                    d["hotels"] = matching_hotels
                    logger.info(f"[ImportService] Auto-distributed {len(matching_hotels)} hotel(s) to Day {d.get('day_number')} ({d.get('title')}) based on location match '{day_sub or day_title}'")

    activities = []
    flights = []
    
    for d in days:
        for act in d.get("activities", []):
            if act and act.get("name") and act.get("name") not in [x.get("name") for x in activities]:
                activities.append(act)
        for t in d.get("transfers", []):
            if t and ("flight" in t.get("type", "").lower() or "flight" in t.get("notes", "").lower()):
                flights.append({
                    "airline": t.get("notes") or t.get("type") or "Imported Airline",
                    "flight_no": t.get("vehicle") or "TBD",
                    "cost": t.get("price"),
                    "currency": extracted.get("currency", currency_hint)
                })
                
    normalized = {
        "source_type": source_type,
        "destination": extracted.get("destination") or destination_hint or extracted.get("detected_destination") or "",
        "sub_destinations": extracted.get("sub_destinations", []),
        "days": days,
        "hotels": hotels,
        "flights": flights,
        "activities": activities,
        "extra_sections": extracted.get("extra_sections") or {},
        
        # Keep top-level standard fields for backward compatibility
        "duration_days": extracted.get("duration_days") or len(days),
        "currency": extracted.get("currency") or currency_hint or "INR",
        "total_price": extracted.get("total_price") or (budget_hint if budget_hint > 0 else None),
        "overview": extracted.get("overview", ""),
        "cover_image_url": extracted.get("cover_image_url", "")
    }
    
    fields_dict = build_normalized_fields(normalized, source_type)
    normalized["fields"] = fields_dict
    
    # Calculate overall confidence score across primary fields
    conf_scores = [f_meta["confidence"] for f_meta in fields_dict.values()]
    overall_conf = round(sum(conf_scores) / len(conf_scores), 2) if conf_scores else 0.85
    normalized["overall_confidence_score"] = overall_conf
    normalized["confidence_score"] = overall_conf
    
    return normalized

class ImportExtractor(ABC):
    @abstractmethod
    async def extract(
        self,
        file_bytes: bytes,
        filename: str,
        destination_hint: str = "",
        budget_hint: float = 0.0,
        duration_hint: int = 0,
        currency_hint: str = "INR",
        agency_id: Optional[str] = None,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        pass

class PdfExtractor(ImportExtractor):
    async def extract(
        self,
        file_bytes: bytes,
        filename: str,
        destination_hint: str = "",
        budget_hint: float = 0.0,
        duration_hint: int = 0,
        currency_hint: str = "INR",
        agency_id: Optional[str] = None,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        import asyncio
        from src.services.pdf_vault_service import (
            save_temporary_pdf,
            extract_text_from_pdf,
            deterministic_pre_parse_and_compress,
            extract_images_and_link_spatially
        )
        
        # Disk write is fast, but let's run in thread to be safe
        storage_meta = await asyncio.to_thread(save_temporary_pdf, file_bytes, filename)
        file_path = storage_meta["file_path"]
        
        # 1. Text extraction (CPU-bound)
        extracted_text, extraction_metrics = await asyncio.to_thread(extract_text_from_pdf, file_path)
        raw_text = (f"Destination hint: {destination_hint}.\n" if destination_hint else "") + extracted_text
        
        # 2. Compress text (CPU-bound)
        compressed_text, compression_metrics = await asyncio.to_thread(deterministic_pre_parse_and_compress, raw_text)
        
        # 3. Extract images and link spatially (CPU-bound & network-bound uploads)
        images_list = await asyncio.to_thread(extract_images_and_link_spatially, file_path, agency_id)
        
        # 4. AI extraction
        from src.services.cascading_ai_service import extract_vault_package_from_text
        extracted = await extract_vault_package_from_text(
            full_text=compressed_text,
            destination_hint=destination_hint,
            images=images_list,
            agency_id=agency_id
        )
        
        # 5. Build schema
        normalized = compile_normalized_package(
            extracted=extracted,
            source_type="pdf",
            destination_hint=destination_hint,
            budget_hint=budget_hint,
            currency_hint=currency_hint
        )
        
        # Keep additional metadata references for router processing
        normalized["_storage_meta"] = storage_meta
        normalized["_compression_metrics"] = compression_metrics
        normalized["_raw_text"] = raw_text
        
        return normalized

class XlsxExtractor(ImportExtractor):
    async def extract(
        self,
        file_bytes: bytes,
        filename: str,
        destination_hint: str = "",
        budget_hint: float = 0.0,
        duration_hint: int = 0,
        currency_hint: str = "INR",
        agency_id: Optional[str] = None,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        # Parse all sheets of Excel file
        excel_file = pd.ExcelFile(io.BytesIO(file_bytes))
        text_parts = []
        for sheet_name in excel_file.sheet_names:
            df = excel_file.parse(sheet_name)
            df = df.dropna(how='all').dropna(axis=1, how='all')
            if not df.empty:
                text_parts.append(f"Sheet: {sheet_name}\n{df.to_string(index=False)}")
                
        full_text = "\n\n".join(text_parts)
        if not full_text.strip():
            raise ValueError("The Excel file appears to be empty.")
            
        # AI Extraction
        from src.services.cascading_ai_service import extract_vault_package_from_text
        extracted = await extract_vault_package_from_text(
            full_text=full_text,
            destination_hint=destination_hint,
            images=None,
            agency_id=agency_id
        )
        
        normalized = compile_normalized_package(
            extracted=extracted,
            source_type="xlsx",
            destination_hint=destination_hint,
            budget_hint=budget_hint,
            currency_hint=currency_hint
        )
        
        normalized["_raw_text"] = full_text
        return normalized

class CsvExtractor(ImportExtractor):
    async def extract(
        self,
        file_bytes: bytes,
        filename: str,
        destination_hint: str = "",
        budget_hint: float = 0.0,
        duration_hint: int = 0,
        currency_hint: str = "INR",
        agency_id: Optional[str] = None,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        # Parse CSV
        df = pd.read_csv(io.BytesIO(file_bytes))
        df = df.dropna(how='all').dropna(axis=1, how='all')
        if df.empty:
            raise ValueError("The CSV file appears to be empty.")
            
        full_text = df.to_string(index=False)
        
        # AI Extraction
        from src.services.cascading_ai_service import extract_vault_package_from_text
        extracted = await extract_vault_package_from_text(
            full_text=full_text,
            destination_hint=destination_hint,
            images=None,
            agency_id=agency_id
        )
        
        normalized = compile_normalized_package(
            extracted=extracted,
            source_type="csv",
            destination_hint=destination_hint,
            budget_hint=budget_hint,
            currency_hint=currency_hint
        )
        
        normalized["_raw_text"] = full_text
        return normalized
