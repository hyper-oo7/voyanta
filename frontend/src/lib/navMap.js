// Central in-app navigation map: sidebar/topnav anchor labels & button labels
// → React Router routes. StitchPage uses this to intercept clicks coming from
// the Stitch HTML.

const NAV_MAP = {
  // ── Sidebar / top-nav ──────────────────────────────────────────────────
  'Dashboard': '/dashboard',
  'New Proposal': '/proposals/brief',
  'Proposals': '/proposals',
  'Templates': '/templates',
  'Hotels': '/libraries/hotels',
  'Flights': '/flights',
  'Activities': '/activities',
  'Libraries': '/libraries',
  'Hotel Library': '/libraries/hotels',
  'Assets Library': '/libraries/assets',
  'Cost Calculator': '/cost-calculator',
  'Branding': '/branding',
  'Agency Branding': '/branding',
  'Settings': '/branding',
  'Voyanta': '/dashboard',

  // ── Cross-page nav buttons ─────────────────────────────────────────────
  'Client Brief': '/proposals/brief',
  'Itinerary Generator': '/proposals/new',
  'Proposal Preview': '/proposals/preview',
  'View All': '/proposals',
  'Continue to Proposal': '/proposals/wizard',
  'Continue to Costing': '/cost-calculator',
  'Review & Send': '/proposals/preview',
  'Edit Mode': '/proposals/new',
  'Finalize AI Draft': '/proposals/preview',
  'Use Template': '/proposals/wizard',
  'Create New': '/proposals/wizard',

  // ── Landing page nav + auth CTAs ───────────────────────────────────────
  'Login': '/login',
  'Sign Up': '/login',
  'Sign In': '/dashboard',
  'Create an account': '/login',
  'Book a Demo': '/login',
  'Contact Sales': '/login',
  'Talk to an Expert': '/login',
  'Choose Starter': '/login',
  'Start 14-day Free Trial': '/login',
  'Get Started for Free': '/login',
};

// Hash anchors → in-page section IDs (for smooth scrolling on the landing).
// StitchPage uses this map to scroll to existing sections when an in-page
// anchor is clicked; if the section doesn't exist on the current page, it
// falls through to NAV_MAP / toast.
export const HASH_SECTION_MAP = {
  '#features':     'features',
  '#solutions':    'mockups',
  '#mockups':      'mockups',
  '#pricing':      'pricing',
  '#testimonials': 'testimonials',
  '#faq':          'faq',
};

// Button text labels that should show a "Coming soon" toast instead of dead
// clicks. Anything not in NAV_MAP and not in this list is silently ignored
// (e.g. material-symbol-only buttons like "notifications").
export const COMING_SOON_LABELS = new Set([
  'Share',
  'Share Link',
  'Export PDF',
  'Export PPT',
  'Save Changes',
  'Save Proposal',
  'Add Custom Property',
  'Load More Results',
  'Add to Itinerary',
  'Select for Proposal',
  'View Collections',
  'Upload Hotel Database',
  'Upload Activities Database',
  'View Details',
  'Regenerate',
  'Add Activity',
  'Reservations',
  'Replace Le Meurice',
  'Update Flight',
  'Swap Day 3 Dinner',
  'Edit Profile Preferences',
  'Explore Destination Pack',
  'Try Beta Feature',
  'Continue with Google',
  'Clear Selection',
]);

export default NAV_MAP;
