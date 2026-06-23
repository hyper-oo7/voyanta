# Voyanta · Travel OS — MVP

## Stack
React 18 + Vite 5 · React Router v6 · Tailwind via CDN · Supabase JS v2 · SheetJS + PapaParse · localStorage demo session.

## Primary workflow: Proposal Wizard (`/proposals/wizard`)
Seven connected steps with shared progress bar + Previous / Save Draft / Continue-to-X footer:

| # | Step | What it does |
|---|---|---|
| 1 | Client Info | Customer name, country code (India +91 default), phone, email, destination, dates, adults, children, budget, special notes — saved into `proposals` row + `brief` jsonb. |
| 2 | Hotels | Browses imported `hotels` (DynamicTable: search/sort/filter/pagination/bulk-select). Bulk-add selected → `proposal_items` (kind=hotel). Selected items shown with delete. |
| 3 | Flights | Same pattern (kind=flight). |
| 4 | Activities | Same pattern (kind=activity). |
| 5 | Costing | Live editor over all `proposal_items` (qty × unit_price, live subtotal, per-kind totals). + Add line for transfer / visa / tax / margin / custom. |
| 6 | Branding | Agency name, logo URL, address, contact email/phone, website, FB/IG/LinkedIn. Persisted into `proposals.preferences.branding`. |
| 7 | Preview / Generate | Branded preview with items grouped by kind, total, **Export JSON** (downloads structured envelope), placeholder PDF / PPT buttons. |

## Other behaviour
- **Edit Proposal**: `/proposals` row Edit-icon → wizard step 1 with all data loaded. Row click or View-icon → wizard step 7 (full content visible).
- **Delete items** at every step (selected hotels/flights/activities + cost lines) via per-item trash icon.
- **Legacy redirects**: `/proposals/new` and `/proposals/brief` → `/proposals/wizard`.
- **Inventory pages still standalone** for browsing/imports: `/libraries/hotels`, `/flights`, `/activities`, `/templates`, `/cost-calculator`. They share the dashboard chrome and the same DynamicTable + ImportModal.

## DB tables (CRUD coverage)
| Table | Wired by |
|---|---|
| `agencies` | seeded |
| `proposals` | wizard, list page, dashboard, services |
| `hotels`/`flights`/`activities`/`templates` | resource pages + import engine |
| `imports`, `field_mappings` | import engine |
| `proposal_items` | wizard steps 2-5 + cost calculator + builder |

## What's left
- Wire **Generate PDF / Generate PPT** consumers of the export-JSON envelope.
- Replace flight `filterRows` with a realtime-API call (form is ready).
- Some user-imported hotel rows have malformed `currency` (e.g. "Available") — the wizard now sanitises currency against ISO 4217 and falls back to the proposal's currency, but a one-time data fix in Supabase + a stricter import-mapping suggester would be cleaner.
- Re-enable RLS with agency-scoped policies before going live.
