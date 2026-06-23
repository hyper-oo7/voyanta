# Voyanta · Travel OS — MVP Production Readiness Report

Date: Jan 2026

## Functional pages (UI + state + service layer wired)

| Page | Route | What works | Backend |
|---|---|---|---|
| Landing | `/` | All CTAs, smooth-scroll anchors, demo entry | — |
| Auth | `/login` | Sign Up, Sign In, Sign Out, Forgot password, Demo skip | `auth.users` |
| Dashboard | `/dashboard` | Stats, recent proposals, quick actions, sign-out | `proposals` |
| Proposals | `/proposals` | Full CRUD: View / Edit / Duplicate / Delete | `proposals` |
| New Proposal (brief) | `/proposals/brief` | Form persists a proposal record, sets it active | `proposals` |
| Proposal Builder | `/proposals/new?id=...` | Active proposal selector, items grouped by kind, apply-template, status change, **Export JSON** | `proposals`, `proposal_items`, `templates` |
| Hotels | `/libraries/hotels` | Import (.xlsx/.csv), dynamic table, search, sort, pagination, bulk-select, Add to Active Proposal, delete, suggested column mapping, saved field-mappings | `hotels`, `imports`, `field_mappings`, `proposal_items` |
| Flights | `/flights` | Same as Hotels **+** From/To/Date/Persons search-form filter (live API drop-in ready) | `flights` |
| Activities | `/activities` | Same as Hotels | `activities` |
| Templates | `/templates` | Import / list / delete + Apply-to-Proposal | `templates` |
| Cost Calculator | `/cost-calculator` | Reactive line-item editor (qty × unit_price), live subtotal, by-kind summary, add custom lines (transfer/visa/tax/margin/etc), **Export JSON** | `proposal_items` |
| Branding | `/branding` | UI only — Save Changes still placeholder | — |

## Placeholder pages (UI-only, no backend yet)

| Page | Status |
|---|---|
| `/proposals/preview` | Stitch HTML preview — no live data binding (export-prep returns the structured JSON instead) |
| `/libraries` | Hub UI only — superseded by direct module routes |
| `/branding` | Saving agency brand to `agencies` table not wired |

## Connected database tables (CRUD coverage)

| Table | Create | Read | Update | Delete | Notes |
|---|:-:|:-:|:-:|:-:|---|
| `agencies` | seed | ✓ | — | — | Seeded once from `schema.sql`. |
| `users` | — | ✓ | — | — | Mirrors `auth.users`; populated on signup later. |
| `clients` | — | — | — | — | Reserved (proposals currently store `client_name` inline). |
| `proposals` | ✓ | ✓ | ✓ | ✓ | Full UI flows. |
| `hotels` | ✓ (import) | ✓ | — | ✓ | Update via raw `update()` call available via service; UI exposes delete. |
| `flights` | ✓ (import) | ✓ | — | ✓ | Same. |
| `activities` | ✓ (import) | ✓ | — | ✓ | Same. |
| `templates` | ✓ (import) | ✓ | — | ✓ | Same. |
| `imports` | ✓ | indirectly | — | — | Recorded per upload with `raw_rows`, `mapping`, `imported_count`. |
| `field_mappings` | ✓ | ✓ | upsert | — | Default mapping per agency-resource auto-restored on next import. |
| `proposal_items` | ✓ | ✓ | ✓ | ✓ | Cost Calculator + Builder editors. |

## Dynamic Import Engine

Reusable across all 4 supplier modules. Pipeline:

1. Picker accepts `.xlsx` / `.csv` (PDF skipped per scope decision).
2. SheetJS / PapaParse parses → `{ columns, rows }` with auto-detected headers.
3. Heuristic suggester maps source columns to internal Travel OS fields using synonyms (e.g. `name|hotel|property|title` → `name`).
4. User can override every mapping via dropdown; unmapped columns are still preserved inside `raw` (jsonb).
5. On confirm: writes raw upload to `imports`, bulk-inserts records (with `raw` payload + agency scope), upserts the mapping into `field_mappings` for future uploads.
6. Toast: "Imported N {resource}".

## Dynamic Tables

`<DynamicTable />` auto-derives columns from the first record's keys, so:

- Upload a 5-column file → 5 columns shown.
- Upload a 50-column file → 50 columns shown (horizontal scroll).
- Hidden internal fields: `id`, `agency_id`, `created_at`, `updated_at`, `raw`, `created_by`.

Built-in: search, sortable headers (asc/desc), pagination (10/page), bulk-select, row-action slot, "Add to Active Proposal" bulk bar.

## Cost Calculator behaviour

- Reactive: any item added from Hotels / Flights / Activities pages, or any line added directly in the calculator (`+ Add line…` dropdown), instantly appears with editable qty + unit price. Subtotal recalculates live; per-kind aggregates shown as cards.
- Supports kinds: `hotel`, `flight`, `activity`, `transfer`, `visa`, `tax`, `margin`, `custom`.

## Export Preparation

`/proposals/new` and `/cost-calculator` both ship an **Export JSON** button that downloads a structured JSON envelope:

```json
{
  "schema_version": 1,
  "generated_at": "...",
  "agency_id": "...",
  "proposal":     { ... full row from proposals ... },
  "items_by_kind":{ "hotel":[...], "flight":[...], ... },
  "items":        [ ... flat list ... ],
  "totals":       { "subtotal": 123.45, "currency": "USD" }
}
```

This is the contract every future PDF / PPT / email generator should consume — no UI changes required when those are built.

## Remaining blockers (action required from you)

1. **Run `/app/supabase/schema_v2.sql` in Supabase Studio.** Without it:
   - The `imports`, `field_mappings`, `proposal_items` tables don't exist.
   - The `raw` jsonb column is missing on hotel/flight/activity/template tables.
   - **Crucially: RLS is currently enabled on the v1 tables, blocking anon writes** (verified — got `new row violates row-level security policy for table "proposals"` on insert). `schema_v2.sql` explicitly disables RLS on every table for early development.
2. After running v2, hard-refresh the app once. The 2 sample records per resource appear automatically.
3. Wire the **Branding page** Save Changes button to `agencies` table (P2).
4. Wire the **Live flight pricing API** into `FlightsPage.tsx` — replace the local `filterRows` callback with an async fetch using From/To/Date/Persons; the form, schema and Add-to-Proposal flow are already ready.
5. **Re-enable RLS** with agency-scoped policies before going live. The commented stub at the bottom of `schema.sql` shows the pattern; you'll want similar policies on every table.

## Verified end-to-end (manual walkthrough)

- Demo session entry → Dashboard chrome consistent across all module pages.
- Hotel / Flight / Activity / Templates pages all load with the **same** dashboard chrome and Stitch styling untouched.
- Flights page renders the From/To/Date/Persons toolbar above the dynamic table.
- Cost Calculator renders the empty-state messaging when no proposal is active and the line-item table when one is.
- Proposal Builder hub renders the empty/active states and quick-jump cards.
- (Pending v2 schema run): full create-proposal → import-hotels → add-to-proposal → cost-calc → export-JSON flow.
