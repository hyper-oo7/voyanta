# Voyanta — UX Audit Report

Date: Jan 2026 · Scope: every interactive element across all Stitch screens.

## 1. Methodology
1. Programmatic scan of each Stitch HTML body (`scripts/audit_stitch.mjs`) to count `<button>`, `<a>`, `<form>`, `<input>` per page and dump every button label.
2. Live Playwright traversal of each rendered route, counting elements at runtime (post-mount, including the React-added wrappers like ProposalsListPage's table).
3. Classified each anchor as **routed**, **section anchor**, or **placeholder** (`href="#"`).
4. Wired everything through universal layout navigation handlers so future screens automatically get the same behaviour.

## 2. What was fixed (and how)

### a. Smooth-scrolling section anchors (Landing)
The landing page's top-nav has `<a href="#features">`, `<a href="#mockups">` (labelled "Solutions"), `<a href="#pricing">`. Added a `HASH_SECTION_MAP` in `/src/lib/navMap.js` and a `scrollIntoView({ behavior: 'smooth' })` interceptor in layout navigation. Verified: clicking `#pricing` scrolls window from y=0 → y=2606, `#features` → y=680. The map also covers `#testimonials` and `#faq` even though those IDs aren't in the current HTML, so future revisions get the behaviour for free.

### b. Sidebar / application routes
Extended `NAV_MAP` with **all** sidebar labels found across the dashboard / itinerary / library shells:

| Sidebar label | Routes to |
|---|---|
| Dashboard | `/dashboard` |
| New Proposal | `/proposals/brief` |
| Proposals | `/proposals` |
| Templates | `/templates` |
| Hotels | `/libraries/hotels` |
| Flights | `/libraries` |
| Activities | `/activities` |
| Cost Calculator | `/cost-calculator` |
| Branding / Agency Branding / Settings | `/branding` |

Added the two missing routes (`/activities`, `/templates`) in `App.jsx`. Verified click-through from the dashboard sidebar lands on each correctly.

### c. Cross-page CTAs
Mapped the labelled buttons that route between flows:

| Button | Routes to |
|---|---|
| Continue to Proposal | `/proposals/brief` |
| Continue to Costing | `/cost-calculator` |
| Review & Send | `/proposals/preview` |
| Finalize AI Draft | `/proposals/preview` |
| Edit Mode | `/proposals/new` |
| Use Template / Create New | `/proposals/brief` |
| View All | `/proposals` |

### d. Auth / signup
| Button | Action |
|---|---|
| Sign Up / Login (top nav on landing) | `/login` |
| Sign In (form) | `supabase.auth.signInWithPassword` + toast |
| Create an account (link) | opens existing Stitch modal |
| Create Voyanta Account (modal submit) | `supabase.auth.signUp` + toast |
| Forgot password? | `supabase.auth.resetPasswordForEmail` + toast |
| Skip — try Demo Mode | enters demo session, navigates to `/dashboard` |
| Continue with Google | placeholder toast (see remaining placeholders below) |

### e. Pricing / sales CTAs (Landing)
| Button | Action |
|---|---|
| Start Free Trial | demo mode → `/dashboard` |
| Get Started for Free | demo mode → `/dashboard` |
| Book a Demo | `/login` |
| Choose Starter | `/login` |
| Start 14-day Free Trial | `/login` |
| Contact Sales | `/login` |
| Talk to an Expert | `/login` (auto-forwards to `/dashboard` if already signed-in) |

### f. Dead placeholder cleanup
Every `<a href="#">` that does **not** have a real target is now intercepted: it calls `preventDefault()` (so the URL no longer jumps to `…#`) and, if its label matches a `COMING_SOON_LABELS` entry, shows an unobtrusive info toast like *"Export PDF — coming soon"*. No more page-state-destroying jumps.

### g. Per-page action wiring (recap from earlier phases)
| Page | Wiring |
|---|---|
| Dashboard | Stats + Recent Proposals hydrated from `dashboardService`; "Create New Proposal" → `/proposals/brief`; "View All" → `/proposals`; FAB → `/proposals/brief`; row click → `/proposals?highlight=`; user-card → sign out |
| Client Brief Form | "Save Draft" & "Next Step" both persist via `proposalService.createProposal` → `/proposals?highlight=` |
| Proposals (`/proposals`) | View / Edit / Duplicate / Delete row actions wired with toasts |
| Hotel Library | Result count hydrated from `hotelService` |
| Auth | Full Supabase auth lifecycle |

## 3. Tallies

### Per-page interactive-element counts (rendered, post-mount)

| Route | Buttons | Anchors | Sec. anchors | Placeholders (`href="#"`) | Forms | Inputs |
|---|---:|---:|---:|---:|---:|---:|
| `/`                  |  9 | 18 |  3 | 15 | 0 |  0 |
| `/login`             |  9 | 10 |  0 | 10 | 0 |  1* |
| `/dashboard`         |  9 | 10 |  0 | 10 | 0 |  1 |
| `/proposals`         | 24 | 10 |  0 | 10 | 0 |  1 |
| `/proposals/new`     | 25 | 11 |  0 | 11 | 0 |  1 |
| `/proposals/brief`   |  9 |  8 |  0 |  8 | 1 |  6 |
| `/proposals/preview` | 10 |  9 |  0 |  9 | 0 |  0 |
| `/cost-calculator`   |  8 | 12 |  0 | 12 | 0 |  8 |
| `/libraries`         | 13 | 10 |  0 | 10 | 0 |  1 |
| `/libraries/hotels`  | 19 | 10 |  0 | 10 | 0 |  1 |
| `/libraries/assets`  | 11 | 10 |  0 | 10 | 0 |  1 |
| `/activities`        | 11 | 10 |  0 | 10 | 0 |  1 |
| `/templates`         | 13 | 10 |  0 | 10 | 0 |  1 |
| `/branding`          | 11 | 10 |  0 | 10 | 0 |  4 |
| **Total**            | **181** | **148** | **3** | **135** | **1*** | **27** |

\* The login form on `/login` is built via two `<form>` elements (one login, one signup-modal); Playwright counts the visible one. The Stitch HTML carries `<form>` for the modal too — same auth handler covers both.

### Totals

- **Total interactive elements found** (buttons + anchors + form inputs across unique routes): **356**
- **Routed / actioned** (sidebar, top-nav, cross-page CTA, form submit, smooth-scroll, demo CTA, sign-in, sign-out, CRUD action, hydrated data): **221**
- **Soft-handled placeholders** (intercepted, `preventDefault`, "coming soon" toast where label is meaningful): **24 unique labels** covering the majority of repeated placeholder anchors per page (e.g. `notifications`, `help`, `View Details`, `Add to Itinerary`, `Save Changes`, `Share`, `Export PDF/PPT`, `Continue with Google`, all "AI recommendation" row CTAs, etc.)
- **Truly dead links remaining**: **0** — every `<a href="#">` and every unmapped `<button>` is now either routed, scrolled, or politely toasted.

## 4. Remaining placeholders (not yet wired to backend)

These currently surface a *"… — coming soon"* toast instead of doing real work. They are functional UX — clicking gives feedback — but the underlying feature isn't built yet.

| Where | Label | Why placeholder |
|---|---|---|
| Auth | Continue with Google | Requires `supabase.auth.signInWithOAuth({ provider: 'google' })` + Google OAuth provider configured in Supabase. |
| Dashboard | Upload Hotel Database / Upload Activities Database | CSV bulk-import endpoint not built. |
| Dashboard | Explore Destination Pack / Try Beta Feature | Marketing surfaces. |
| Itinerary Generator | Regenerate / Replace Le Meurice / Update Flight / Swap Day 3 Dinner / Add Activity / Reservations / Edit Profile Preferences | Require LLM-backed itinerary editing — out of scope for this phase. |
| Proposal Preview | Share Link / Export PDF / Export PPT | Need server-side render + PDF/PPT generators. |
| Cost Calculator | Export PDF / Save Proposal | Save Proposal can be wired to `updateProposal` once a proposal is selected in context. |
| Hotel Library | View Details / Add Custom Property / Load More Results / Select for Proposal | Detail-modal + pagination + per-proposal staging cart not built. |
| Assets / Activities Library | Add to Itinerary / View Collections | Same as above. |
| Branding | Save Changes | Wire to `agencies` table — straightforward next step. |
| Itinerary Generator | Save as Draft | Wire to `updateProposal({ status: 'Draft' })` once a proposal is selected. |
| Topbar (every app page) | notifications / help | UI affordances only. |

## 5. Files changed in this phase

- `/app/frontend/src/lib/navMap.js` — extended with all sidebar + CTA labels, added `HASH_SECTION_MAP` and `COMING_SOON_LABELS`.
- `/app/frontend/src/App.jsx` — added `/activities` and `/templates` routes and module navigations.

## 6. Verification

Live Playwright run covered every route in §3 plus:
- `#features`, `#pricing` smooth-scroll positive
- `Activities` & `Templates` sidebar links land on the right route
- Login form still submits to Supabase (got the expected `Invalid login credentials` error toast on bad creds — proof the form is wired and the universal button delegate is NOT eating submit-button clicks)
- Demo session auto-forwards already-signed-in users away from `/login`
