// Font catalogue used by Branding pages + TemplateRenderer.
// `value` is the canonical CSS font-family stack stored in branding state and
// passed straight into inline style attributes inside the template renderer.

export const FONT_CATALOG = [
  { key: 'cormorant',  label: 'Cormorant Garamond (serif)',  value: '"Cormorant Garamond", "Playfair Display", Georgia, serif' },
  { key: 'playfair',   label: 'Playfair Display (serif)',    value: '"Playfair Display", Georgia, serif' },
  { key: 'merriweather', label: 'Merriweather (serif)',      value: '"Merriweather", Georgia, serif' },
  { key: 'lora',       label: 'Lora (serif)',                value: '"Lora", Georgia, serif' },
  { key: 'eb-garamond', label: 'EB Garamond (serif)',        value: '"EB Garamond", Georgia, serif' },
  { key: 'libre-baskerville', label: 'Libre Baskerville (serif)', value: '"Libre Baskerville", Georgia, serif' },
  { key: 'dm-serif',   label: 'DM Serif Display (display)',  value: '"DM Serif Display", Georgia, serif' },
  { key: 'crimson',    label: 'Crimson Text (serif)',        value: '"Crimson Text", Georgia, serif' },
  { key: 'inter',      label: 'Inter (sans)',                value: '"Inter", system-ui, sans-serif' },
  { key: 'geist',      label: 'Geist (sans)',                value: '"Geist", "Inter", system-ui, sans-serif' },
  { key: 'montserrat', label: 'Montserrat (sans)',           value: '"Montserrat", system-ui, sans-serif' },
  { key: 'poppins',    label: 'Poppins (sans)',              value: '"Poppins", system-ui, sans-serif' },
  { key: 'roboto',     label: 'Roboto (sans)',               value: '"Roboto", system-ui, sans-serif' },
  { key: 'open-sans',  label: 'Open Sans (sans)',            value: '"Open Sans", system-ui, sans-serif' },
  { key: 'source-sans', label: 'Source Sans 3 (sans)',       value: '"Source Sans 3", system-ui, sans-serif' },
  { key: 'raleway',    label: 'Raleway (sans)',              value: '"Raleway", system-ui, sans-serif' },
];

// Default font per template style (used when branding.font_family is empty).
export const TEMPLATE_DEFAULT_FONT = {
  elegant: FONT_CATALOG[0].value, // Cormorant
  dark:    FONT_CATALOG[8].value, // Inter
  light:   FONT_CATALOG[8].value, // Inter
};

export function resolveFont(branding, style) {
  return (branding && branding.font_family) || TEMPLATE_DEFAULT_FONT[style] || FONT_CATALOG[0].value;
}
