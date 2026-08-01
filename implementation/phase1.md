# Phase 0: Data Model (Core Engine Specification)

## Overview
Phase 0 defines the core data structures that anchor Voyanta's generation, vault extraction, and proposal assembly pipeline. It replaces unstructured PDF-based storage with modular **Itinerary Blocks**, **Attraction Master Records**, and **Standardized Hotel/Transfer Schemas**.

---

## 1. Itinerary Block (Core Unit of Storage & Composition)
Replaces "PDF as unit of storage". Represents a single composable 1-day or multi-day trip segment extracted from supplier source PDFs or curated agency templates.

```json
{
  "block_id": "shillong_family_1day_003",
  "destination": "Shillong",
  "region": "Meghalaya",
  "duration_type": "1_day",
  "theme_tags": ["family", "budget"],
  "source_pdf": "agency_pdf_2023_014.pdf",
  "attractions_sequence": ["ward_lake", "police_bazaar", "elephant_falls"],
  "slot_map": {
    "morning": ["ward_lake"],
    "afternoon": ["police_bazaar"],
    "evening": ["elephant_falls"]
  },
  "hotel_used_in_source": "Hotel Pine Hill",
  "confidence": 0.87
}
```

### Key Schema Fields
- `block_id`: Unique slug identifier (e.g. `shillong_family_1day_003`)
- `destination`: Primary city/spot (e.g. `Shillong`)
- `region`: Geographical region or state (e.g. `Meghalaya`)
- `duration_type`: Granularity (`1_day`, `half_day`, `2_day`)
- `theme_tags`: Metadata tags for preference filtering (`family`, `budget`, `honeymoon`, `adventure`)
- `source_pdf`: Reference to source document in vault
- `attractions_sequence`: Ordered list of `attraction_id` entries
- `slot_map`: Time of day allocation (`morning`, `afternoon`, `evening`)
- `hotel_used_in_source`: Supplier/Source hotel baseline
- `confidence`: Extraction confidence score (0.0 to 1.0)

---

## 2. Attraction Master Record
Standardized knowledge graph node for individual points of interest, activities, and sightseeing spots.

```json
{
  "attraction_id": "ward_lake",
  "name": "Ward's Lake",
  "city": "Shillong",
  "duration_minutes": 60,
  "open_time": "08:00",
  "close_time": "17:00",
  "best_slot": ["morning"],
  "entry_fee": 20.0,
  "lat": 25.5744,
  "lng": 91.8825,
  "tags": ["nature", "family", "budget"]
}
```

### Key Schema Fields
- `attraction_id`: Unique identifier (e.g. `ward_lake`)
- `name`: Verbatim attraction name
- `city`: Parent destination city
- `duration_minutes`: Recommended visit duration in minutes
- `open_time`: Opening time in `HH:MM` format
- `close_time`: Closing time in `HH:MM` format
- `best_slot`: Preferred time slots (`morning`, `afternoon`, `evening`)
- `entry_fee`: Per-person entry cost in local currency
- `lat` / `lng`: Geographic coordinates for spatial routing & distance matrix
- `tags`: Category tags (`nature`, `family`, `budget`, `adventure`)

---

## 3. Standardized Hotels & Transfers
Standardized field names close to existing CSV rate cards to ensure consistent query filtering across search, assembly, and costing engines.

### Standardized Hotel
- `hotel_id`: Unique hotel slug/UUID
- `name`: Hotel name
- `location`: City or sub-destination area
- `star`: Category / Star rating (`3_star`, `4_star`, `5_star`, `heritage`, `boutique`)
- `price_min`: Baseline minimum B2B rate per room night
- `price_max`: Peak minimum/maximum B2B rate per room night
- `meal_plan`: Supported meal plans (`EP`, `CP`, `MAP`, `AP`)
- `amenities`: Array of feature tags (`pool`, `wifi`, `parking`, `pure_veg`, `spa`)

### Standardized Transfer
- `transfer_id`: Unique transfer option slug
- `location`: Route segment or city location
- `vehicle_type`: Vehicle category (`Sedan`, `SUV`, `Tempo Traveller`, `Luxury Bus`, `Private Yacht`)
- `capacity`: Maximum passenger capacity
- `price_min`: Base net minimum rate for vehicle/route
- `price_max`: Peak net maximum rate for vehicle/route
- `inclusions`: Included amenities/services (`toll_tax`, `parking`, `driver_bhatta`, `fuel`, `ac`)

---

## Next Steps
1. Pydantic backend models implemented in `backend/src/models/itinerary_block.py`.
2. Database migration created in `supabase/migrations/20260801000001_phase0_itinerary_blocks_and_attractions.sql`.
3. Test suite in `backend/tests/test_phase0_data_models.py`.
