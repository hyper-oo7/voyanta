// Country codes: India default + the requested set.
// `value` is unique (used as form value) — code is what we persist.
export const COUNTRY_CODES = [
  { value: 'IN', code: '+91',  label: 'India +91' },        // default
  { value: 'US', code: '+1',   label: 'USA +1' },
  { value: 'GB', code: '+44',  label: 'UK +44' },
  { value: 'AE', code: '+971', label: 'UAE +971' },
  { value: 'SG', code: '+65',  label: 'Singapore +65' },
  { value: 'AU', code: '+61',  label: 'Australia +61' },
  { value: 'CA', code: '+1',   label: 'Canada +1' },
  { value: 'DE', code: '+49',  label: 'Germany +49' },
  { value: 'FR', code: '+33',  label: 'France +33' },
  { value: 'CH', code: '+41',  label: 'Switzerland +41' },
];
export const DEFAULT_COUNTRY = 'IN';
