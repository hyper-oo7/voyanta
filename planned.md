## 1. Architectural Vision & Intake Screen Specifications

### The 1-2 Minute Creation Breakthrough
Current proposal creation takes 15–30 minutes across a sequential 5-step wizard (Intake → Days → Costing → Branding → Preview). 
We are replacing the wizard with a **Single-Screen Intake Modal** followed by a **Single-Screen Editable Workspace Canvas ("Correct & Refine")**.

### Single-Screen Quick Intake Form (Captured in One Submit)
- **Client Details**: Client Name + Contact Info (Phone / Email).
- **Destination(s) with Instant Smart Autocomplete**:
  - Multi-select or free text with **0ms Local Memory Feasibility Lookup** (using `destinationHierarchy.js` & indexed distance matrix).
  - **Proactive Vault Recommendations**: When the agent types a destination (e.g. `Manali`), the UI immediately displays 1-click pills for **Suggested Feasible Additions** (e.g. `+ Solang Valley (14 km)`, `+ Kasol (75 km)`, `+ Sissu (40 km)`).
  - If a non-feasible pairing is selected (e.g. `Jaisalmer` with `Manali` for a 2-day trip), an instant warning pill appears (*"⚠️ Jaisalmer is 850 km away — min 7 days required"*), taking **0ms** without blocking submit or waiting for slow external APIs.
- **Client Preferences (Free Text)**: *"Wants a beach + hills mix"*, *"No trekking"*, *"Vegetarian food only"*. Passed into generation engine as soft constraint notes.
- **Duration (Days)**: Total trip duration.
- **Group Composition**:
  - Number of Adults.
  - Number of Kids + Ages (if any).
  - Elderly present? (60+) — Checkbox.
  - Group Type: `Friends` | `Couple` | `Family` | `Solo`.
- **Pace Selection**: `Slow` | `Medium` | `Fast` — Auto-suggested based on group composition (e.g. elderly/kids $\rightarrow$ `Slow`; young friends $\rightarrow$ `Fast`), agent can override.
- **Budget**: Budget per head OR total budget target.

---

### The 9-Step Generation Pipeline (On Submit)

```
[1. Intake Submitted] -> Resolve destinations to destination_id(s) via Layer-1 Global Lookup
         |
         v
[2. Feasibility Check] -> Check distance_cache for destination pairs (live fallback + global cache)
         |               If travel time > pace threshold -> Flag / Reject before submission
         v
[3. Query Modules] -> Search agency_day_modules (Layer 2) filtered by destination_id + group_type + pace_fit (fuzzy)
         |
         v
[4. Day Assembly] -> Sequence day-by-day itinerary; enforce pace caps (trim/split overloaded days)
         |
         v
[5. Weather/Metadata] -> Cross-ref destination_metadata (Layer 1) for travel month -> Inject weather & packing rules
         |
         v
[6. Cost Optimizer] -> Pull hotel_rates (Layer 2) + hotels_global (Layer 1) -> Apply full-budget margin (% or flat) + tax
         |
         v
[7. Agency Branding] -> Apply agency_branding + policy templates (inclusions, exclusions, payment terms)
         |
         v
[8. Output JSON] -> Single FinalProposalSchema JSON tagged by detail_level per block
         |
         v
[9. Unified Canvas] -> Agent lands immediately on single editable review screen (Web View + PDF View)
```

---

## 2. Deep Technical Solutions

### A. Full Budget Margin Engine & Costing Visibility Modes
- **Full Budget Margin Application**:
  - Subtotal $\text{Subtotal} = \text{Hotels} + \text{Transfers} + \text{Activities} + \text{Meals} + \text{Services}$.
  - Margin applies to the **entire trip budget**, not just hotels:
    - **Percentage Margin**: $\text{Gross Price} = \text{Subtotal} \times (1 + \frac{\text{Margin \%}}{100})$
    - **Flat Margin**: $\text{Gross Price} = \text{Subtotal} + \text{Flat Margin Amount}$
  - Tax (e.g., GST 5%) and Discounts apply to the resulting gross price.
- **Costing Visibility Toggles**:
  - **Itemized Mode**: Displays individual costs per hotel, transfer, and activity.
  - **Total Only Mode**: Masks all line-item pricing and renders a single, clean total cost (e.g. ₹35,000 / person).

### B. 96-Template Architecture Gallery (Replacing Cluttered Dropdowns)
- **Why a simple 96-item dropdown fails**: A select dropdown with 96 items is completely unnavigable.
- **Our Template Gallery Modal Solution**:
  1. **Canvas Toolbar Quick-Bar**: Displays the currently active template pill (e.g. `✦ Classic Luxury`) with a **"Browse 96 Layouts"** button and quick-chips for the agent's **Top 4 Recent / Favorite Templates**.
  2. **Template Architecture Gallery Modal**:
     - **Category Filtering**: 8 curated tabs (`All (96)`, `Luxury & Honeymoon`, `Modern Dark`, `Minimalist & Editorial`, `Adventure & Safari`, `Beach & Tropical`, `Corporate & MICE`, `Regional & Cultural`).
     - **Real-Time Search Bar**: Instant search by layout name or style tag (e.g. *"dark"*, *"safari"*, *"gold"*).
     - **Visual Cards**: Shows visual thumbnail preview, layout description, and "Best For" tags.
     - **1-Click Theme Swap**: Selecting a template updates `proposal.template_slug` and instantly re-renders the right-pane preview without touching any itinerary content.

### D. Zero-Waste AI Cost Strategy ($0.0015 -> $0.0001 per run)
- **Why LLMs get expensive**: Sending full past itineraries to an LLM to "rewrite" wastes 10,000+ input tokens per run.
- **Our Cost-Optimized Strategy**:
  1. **AI Prompt Parser (Gemini 2.5 Flash)**: Only parses user prompt into small JSON parameters (~200 tokens = **$0.00005**).
  2. **Deterministic Database Assembly**: Day module composition, price hydration, and rule enforcement are executed in Python/SQL using exact indexing and tag matching (**$0.00** AI cost).

### E. Weather Rules & Preference Filtering Engine
- **Weather Database (`destination_rules` table)**:
  - Indexed by `(destination, month)`.
  - Stores temperature bounds, rain probability, UV index, and automatic packing list additions (sunscreen, cottons, thermals, rainwear).
  - Integrates Open-Meteo free weather API for live forecasts in Web View.
- **Preference Tag Filters**:
  - Positive tags: `beach`, `water_sports`, `coastal`.
  - Negative tags: `no_trekking` (drops any day module tagged with hiking/steep climbs).
  - Dietary tags: `veg_only` (filters hotel meal plans to pure-veg or MAP-veg verified options).

---

## 3. Phase-by-Phase Execution Roadmap

### Phase 1: Database Schemas, Rate Parser & Day Module Engine (COMPLETED)
- [x] Create backend schemas for `day_modules`, `destination_rules`, `agency_hotel_rates`, and `distance_cache` (`backend/src/models/day_module_schema.py`).
- [x] Build Python PDF/CSV rate sheet parser (`backend/src/services/hotel_rate_parser.py`).
- [x] Build Full-Budget Pricing & Margin Engine (`backend/src/services/margin_service.py`) supporting % and flat margin calculations, tax, discounts, and itemized/total-only modes.
- [x] Build Multi-Tier Query Caching Engine (`backend/src/services/day_module_cache_service.py`) for sub-50ms day module, distance matrix, and rate lookups.
- [x] Build 1-Shot Assembly Engine (`backend/src/services/assembly_engine.py`) and FastAPI route `/api/v1/ai/assemble-1shot` in `ai_router.py`.
- [x] Verify Phase 1 with automated unit tests (`backend/tests/test_1shot_engine.py` - 5/5 tests passing).

### Phase 2: Travel Feasibility, Weather & Preference Engine (COMPLETED)
- [x] Implement distance matrix validator (`backend/src/services/travel_rules_service.py`) to prevent over-scheduling far destinations.
- [x] Implement Pace Calibration Engine (Fast, Medium, Slow activity caps & timing buffers).
- [x] Implement Weather Protection System (midday sun protection for high temps, seasonal gear auto-fill).
- [x] Implement Soft & Hard Preference Filters (`wants_beach`, `no_trekking`, `veg_only`).
- [x] Integrate Phase 2 rules into `assembly_engine.py` and verify with unit tests (`tests/test_phase2_rules.py` - 9/9 total tests passing).

### Phase 3: Ultra-Low Cost 1-Shot AI Router & Vault Hydration (COMPLETED)
- [x] Create `/api/v1/ai/assemble-1shot` endpoint in `ai_router.py`.
- [x] Implement ultra-efficient prompt parsing (~200 tokens) with natural language prompt support.
- [x] Connect Python assembly engine to merge day modules, vault rates, margin settings, and agency branding into a valid `FinalProposalSchema` (10/10 automated tests passing in 0.49s).

### Phase 4: Unified Workspace Canvas UI & Dual View Page (COMPLETED)
- [x] Integrate Canvas state, 1-shot API action, 96-template switcher, and full-budget margin config into Zustand (`frontend/src/store/proposalStore.js`).
- [x] Build `QuickIntakeModal.jsx` (30-second single-screen intake with instant 0ms feasibility validation and vault destination suggestions).
- [x] Build `TemplateGalleryModal.jsx` (Visual drawer for 96 layout templates with category tabs & 1-click theme swap).
- [x] Build `UnifiedItineraryCanvas.jsx` replacing 5-step wizard with single-page split canvas (Left: editable editor; Right: live Web View & high-contrast PDF print preview).
- [x] Map `/proposals/wizard` and `/proposals/canvas` routes in `App.jsx` to `UnifiedItineraryCanvas`.

---

## 4. Step-by-Step Antigravity Dictation Prompts

Use these exact prompts to direct Antigravity step-by-step:

### Dictation for Phase 1:
> "Antigravity, let's execute Phase 1 of `planned.md`. Create the database models for `day_modules`, `destination_rules`, and `agency_hotel_rates`. Then implement `hotel_rate_parser.py` to parse CSV/PDF rate sheets and `margin_service.py` to support % and flat margin calculations."

### Dictation for Phase 2:
> "Antigravity, let's execute Phase 2 of `planned.md`. Build `travel_rules_service.py` with sub-destination distance matrix checks, pace calibration (Fast, Medium, Slow activity caps), weather protection protocols, and preference filters for tags like `no_trekking` and `veg_only`."

### Dictation for Phase 3:
> "Antigravity, let's execute Phase 3 of `planned.md`. Implement the `/api/v1/ai/assemble-1shot` endpoint in `ai_router.py`. Ensure prompt parsing uses minimal LLM tokens, and assembly pulls deterministically from `day_modules` and `agency_hotel_rates`."

### Dictation for Phase 4:
> "Antigravity, let's execute Phase 4 of `planned.md`. Build `UnifiedItineraryCanvas.jsx` to replace `ProposalWizard.jsx`. Implement the single-screen split layout with Quick Intake modal, drag/swap day cards, editable margin controls, OpenStreetMap Leaflet map, and 1-click visual template switcher."

---
*End of Master Execution Plan (`planned.md`). Keep this file until all phases pass verification.*
