# Voyanta — Travel Concierge Platform (Stitch → React/Vite Port)

## Original problem statement
> Analyze all generated screens. Create a single React + Vite application using these existing designs. Do not redesign or restyle anything. Preserve the exact UI from Stitch. Create routing between pages and reusable components. Convert static mock data into dynamic structures that can later connect to Supabase.

## Tech stack
- React 18 + Vite 5 (supervisor runs `yarn start` → `vite --host 0.0.0.0 --port 3000`)
- React Router v6 for SPA navigation
- Tailwind via the Stitch-provided CDN config (preserved byte-for-byte in `index.html`)
- Material Symbols + Geist + Inter via Google Fonts
- Supabase scaffolded but optional (mocks used until env vars + package installed)

## Architecture
```
/app/frontend
├── index.html                     # Tailwind config + global styles from Stitch (#root: display:contents)
├── vite.config.js
├── scripts/extract_stitch.mjs     # one-shot script that ingested the 11 Stitch HTML pages
├── src/
│   ├── main.jsx                   # Vite entry + BrowserRouter
│   ├── App.jsx                    # all 11 routes
│   ├── components/StitchPage.jsx  # reusable wrapper: injects per-page <style>,
│   │                              # renders Stitch body HTML, intercepts <a>
│   │                              # clicks → React Router via central navMap
│   ├── lib/
│   │   ├── navMap.js              # label → in-app route map (Dashboard → /dashboard, …)
│   │   └── supabaseClient.js      # lazy supabase-js init; falls back to mocks
│   ├── pages/                     # one component per Stitch screen
│   │   └── _html/                 # auto-generated HTML payloads
│   ├── data/                      # mock data shaped to mirror future Supabase tables
│   │   ├── proposals.js           # proposals + dashboardSummary
│   │   ├── hotels.js
│   │   ├── assets.js              # activities/flights/transfers/dining
│   │   └── activity.js
│   └── services/                  # mock-or-Supabase service layer (identical API)
│       ├── dashboardService.js    # fetchDashboardSummary()
│       ├── proposalService.js     # fetchProposals(), fetchProposalById()
│       ├── hotelService.js        # fetchHotels({country, category})
│       └── assetService.js        # fetchAssets({type})
```

## Routes
| Path | Screen |
|------|--------|
| `/` | Landing page |
| `/login` | Authentication |
| `/dashboard` | Agent dashboard (hydrated from `dashboardService`) |
| `/proposals/new` | AI Itinerary Generator |
| `/proposals/brief` | Client Brief Form |
| `/proposals/preview` | Proposal Preview |
| `/cost-calculator` | Cost Calculator |
| `/libraries` | Libraries hub |
| `/libraries/hotels` | Hotel Library (hydrates result count from `hotelService`) |
| `/libraries/assets` | Assets Library |
| `/branding` | Agency Branding |

## How to connect Supabase later
1. `cd /app/frontend && yarn add @supabase/supabase-js`
2. Add to `/app/frontend/.env`:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
3. Create tables matching the shapes in `src/data/*.js` (column names already match).
4. Restart frontend. `getSupabase()` resolves to a real client and all service calls
   transparently switch from mocks to live data.

## What's implemented (Jan 2026)
- 11/11 Stitch screens ported with pixel-accurate fidelity
- **Supabase integration** (`@supabase/supabase-js` v2) with browser-side client at `/src/lib/supabaseClient.js`
- **Auth flows**: Sign Up, Sign In, Sign Out, Password Reset — wired into the existing Stitch login + signup-modal UI
- **Protected routes**: ProtectedRoute redirects unauthenticated users to `/login`
- **Demo Mode** (`VITE_DEMO_MODE=true`): "Try Demo" affordances on Landing and Login pages enter an in-memory Demo User session. Proposal CRUD persists in `localStorage` via `services/demoStore.js`
- **Proposals page** (`/proposals`): list with View, Edit, Duplicate, Delete actions
- **New Proposal flow**: Dashboard → "Create New Proposal" → Client Brief Form → on submit, persists a proposal and navigates to `/proposals?highlight=<id>`
- **Loading states + toasts**: `ToastContext` provides success/error/info toasts; auth buttons show inline spinners
- SQL schema at `/app/supabase/schema.sql` ready to paste into Supabase Studio (no RLS yet, per agreement)

## Backlog / next actions
- P1 — User runs `/app/supabase/schema.sql` in Supabase Studio to enable real backend
- P1 — Create at least one real Supabase user account; once done, document credentials in `/app/memory/test_credentials.md`
- P2 — Wire "Save Draft" and step-by-step persistence on the multi-step Client Brief Form
- P2 — Wire AI Itinerary Generator, Cost Calculator, Hotels, Activities pages to live Supabase tables (currently still showing Stitch-embedded sample content)
- P3 — Enable agency-scoped RLS policies (DDL stub already commented in schema.sql)
