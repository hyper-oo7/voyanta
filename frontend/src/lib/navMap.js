// Centralized in-app navigation map used by all sidebar/topnav anchors.
// Single source of truth for routing between Voyanta screens.
const NAV_MAP = {
  'Dashboard': '/dashboard',
  'New Proposal': '/proposals/new',
  'Proposals': '/proposals/new',
  'Templates': '/proposals/preview',
  'Hotels': '/libraries/hotels',
  'Flights': '/libraries',
  'Activities': '/libraries/assets',
  'Libraries': '/libraries',
  'Hotel Library': '/libraries/hotels',
  'Assets Library': '/libraries/assets',
  'Cost Calculator': '/cost-calculator',
  'Branding': '/branding',
  'Agency Branding': '/branding',
  'Settings': '/branding',
  'Login': '/login',
  'Sign Up': '/login',
  'Sign In': '/dashboard',
  'Create an account': '/login',
  'Voyanta': '/dashboard',
  'Client Brief': '/proposals/brief',
  'Itinerary Generator': '/proposals/new',
  'Proposal Preview': '/proposals/preview',
  'Features': '/',
  'Solutions': '/',
  'Pricing': '/',
};

export default NAV_MAP;
