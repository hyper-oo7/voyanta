# Voyanta · Travel OS — MVP

## Original problem statement (current phase)
Move from prototype to production-ready MVP. Build a dynamic import engine (Excel/CSV) for hotels/flights/activities/templates, generic dynamic tables, replace hardcoded Stitch content with database-driven assembly, build a reactive proposal builder + cost calculator, and prepare structured export JSON.

## Stack
React 18 + Vite 5 · React Router v6 · Tailwind via CDN (Stitch config preserved) · Supabase JS v2 · SheetJS + PapaParse · localStorage demo session

## Key files added in this phase
- `/app/supabase/schema_v2.sql` — RLS-disabled, raw jsonb on all resource tables, new `imports` / `field_mappings` / `proposal_items` tables, 2 sample records per resource.
- `src/services/parserService.js` — xlsx/csv parsing + synonym-based mapping suggester.
- `src/services/importService.js` — saves uploads to `imports` + bulk-inserts records + upserts `field_mappings`.
- `src/services/resourceService.js` — generic CRUD factory: `hotelsService`, `flightsService`, `activitiesService`, `templatesService`.
- `src/services/proposalItemService.js` — `proposal_items` CRUD + `buildProposalExport(id)` (structured JSON envelope for PDF/PPT/email generators).
- `src/components/ImportModal.jsx` — 3-stage upload modal (pick → map → confirm).
- `src/components/DynamicTable.jsx` — auto-column generation, search/sort/filter/pagination/bulk-select.
- `src/components/ResourceModulePage.jsx` — shared shell for Hotels/Flights/Activities/Templates.
- `src/context/ProposalBuilderContext.jsx` — single "active proposal id" persisted in localStorage.
- `src/pages/FlightsPage.jsx` — search form (From/To/Date/Persons) + dynamic table.
- `src/pages/TemplatesPage.jsx` — Templates module.
- Rewritten: `HotelLibraryPage`, `AssetsLibraryPage`, `CostCalculatorPage`, `AiItineraryGeneratorPage` (now Proposal Builder hub), `proposalService.js` (Supabase-only).

## What's implemented
- Dynamic import engine (xlsx + csv), arbitrary column counts, mapping memory.
- Dynamic tables with search/sort/filter/pagination/bulk-select.
- Hotels / Flights / Activities / Templates: import + browse + delete + add-to-active-proposal.
- Flights search form (filters local rows; ready for realtime API drop-in).
- Proposal Builder hub: active proposal selector, items grouped by kind, apply template, status change, export JSON.
- Cost Calculator: reactive line-items, qty × unit_price, by-kind aggregates, custom line types (transfer/visa/tax/margin), export JSON.
- All flows use Supabase exclusively (the localStorage demo store is now orphaned; demo session bypasses auth only).

## Backlog
- P0: Run `schema_v2.sql` to unblock writes (current Supabase project has RLS on; v2 disables it for early dev).
- P1: Replace flight `filterRows` with realtime API call.
- P1: Wire Branding Save Changes → `agencies` table.
- P1: Re-enable RLS with agency-scoped policies before production.
- P2: PDF / PPT / email generators consuming the export JSON envelope.
- P2: Clients table integration (proposals currently store `client_name` inline).
