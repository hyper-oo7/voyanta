/**
 * Universal Vibe Adaptation Engine (vibeEngine.js)
 * Provides zero-cost deterministic aesthetic formatting, section headings, 
 * badges, and layout styling across all Voyanta document templates.
 */

export const VIBE_CONFIGS = {
  maharaja: {
    name: 'Maharaja Regal',
    dayPrefix: (day) => `Royal Journey — Day ${day}`,
    sectionTitles: {
      accommodations: 'Palatial Stay & Accommodations',
      activities: 'Regal Experiences & Excursions',
      transfers: 'Royal Chauffeur & Logistics',
      meals: 'Royal Feasts & Dining'
    },
    badgeStyle: 'bg-amber-500/15 text-amber-900 dark:text-amber-300 border border-amber-500/40 font-serif tracking-wide',
    cardBorder: 'border-amber-500/30 shadow-xl shadow-amber-500/5 bg-gradient-to-br from-amber-50/30 via-white to-amber-50/10 dark:from-amber-950/20 dark:via-zinc-900 dark:to-amber-950/10',
    headerStyle: 'font-serif text-amber-900 dark:text-amber-200 border-b-2 border-amber-500/30 pb-2',
    subSectionBg: 'bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-xl p-4'
  },
  zen: {
    name: 'Zen Sanctuary',
    dayPrefix: (day) => `Mindful Waypoint — Day ${day}`,
    sectionTitles: {
      accommodations: 'Serene Sanctuary & Check-In',
      activities: 'Mindful Explorations',
      transfers: 'Tranquil Transit & Logistics',
      meals: 'Pure Culinary Nourishment'
    },
    badgeStyle: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 font-sans tracking-widest uppercase text-[11px]',
    cardBorder: 'border-emerald-500/20 shadow-md shadow-emerald-500/5 bg-gradient-to-b from-stone-50 via-white to-emerald-50/20 dark:from-stone-900 dark:via-zinc-900 dark:to-emerald-950/20',
    headerStyle: 'font-light tracking-wide text-emerald-900 dark:text-emerald-300 border-b border-emerald-500/20 pb-2',
    subSectionBg: 'bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/15 rounded-xl p-4'
  },
  editorial: {
    name: 'Editorial Luxury',
    dayPrefix: (day) => `Chapter ${day}`,
    sectionTitles: {
      accommodations: 'Curated Accommodations',
      activities: 'Private VIP Experiences',
      transfers: 'Executive Logistics',
      meals: 'Gastronomic Dining'
    },
    badgeStyle: 'bg-black text-white dark:bg-white dark:text-black font-mono text-[10px] uppercase tracking-widest px-2.5 py-1',
    cardBorder: 'border-black/20 dark:border-white/20 shadow-2xl bg-white dark:bg-zinc-950',
    headerStyle: 'font-serif font-black uppercase tracking-tighter text-black dark:text-white border-b-4 border-black dark:border-white pb-3',
    subSectionBg: 'bg-zinc-100 dark:bg-zinc-900 border-l-4 border-black dark:border-white p-4'
  },
  alpine: {
    name: 'Alpine Adventure',
    dayPrefix: (day) => `Expedition Day ${day}`,
    sectionTitles: {
      accommodations: 'Mountain Lodge & Chalets',
      activities: 'Alpine Pursuits & Trails',
      transfers: 'Expedition Transit',
      meals: 'Summit Dining & Après-Ski'
    },
    badgeStyle: 'bg-sky-500/15 text-sky-900 dark:text-sky-300 border border-sky-500/40 font-bold tracking-wider uppercase text-[11px]',
    cardBorder: 'border-sky-500/30 shadow-lg shadow-sky-500/5 bg-gradient-to-br from-sky-50/40 via-white to-slate-50 dark:from-sky-950/30 dark:via-slate-900 dark:to-zinc-900',
    headerStyle: 'font-extrabold uppercase tracking-tight text-sky-950 dark:text-sky-200 border-b-2 border-sky-500/30 pb-2',
    subSectionBg: 'bg-sky-500/5 dark:bg-sky-500/10 border border-sky-500/20 rounded-xl p-4'
  },
  safari: {
    name: 'Wilderness Safari',
    dayPrefix: (day) => `Wilderness Day ${day}`,
    sectionTitles: {
      accommodations: 'Luxury Tented Camp & Lodges',
      activities: 'Game Drives & Bush Walks',
      transfers: 'Bush Logistics & Air Charters',
      meals: 'Sundowners & Camp Dining'
    },
    badgeStyle: 'bg-amber-700/15 text-amber-900 dark:text-amber-300 border border-amber-700/40 font-bold tracking-widest uppercase text-[10px]',
    cardBorder: 'border-amber-800/30 shadow-lg shadow-amber-900/5 bg-gradient-to-br from-stone-100 via-stone-50 to-amber-50/20 dark:from-stone-900 dark:via-zinc-900 dark:to-amber-950/20',
    headerStyle: 'font-serif font-bold text-amber-950 dark:text-amber-200 border-b-2 border-amber-800/30 pb-2',
    subSectionBg: 'bg-amber-900/5 dark:bg-amber-900/15 border border-amber-800/20 rounded-xl p-4'
  },
  ecosanctuary: {
    name: 'Eco Sanctuary',
    dayPrefix: (day) => `Sanctuary Day ${day}`,
    sectionTitles: {
      accommodations: 'Sustainable Villa & Haven',
      activities: 'Immersive Eco Experiences',
      transfers: 'Clean Energy Logistics',
      meals: 'Organic Farm-to-Table Dining'
    },
    badgeStyle: 'bg-teal-500/15 text-teal-900 dark:text-teal-300 border border-teal-500/30 font-semibold tracking-wide text-[11px]',
    cardBorder: 'border-teal-500/30 shadow-lg shadow-teal-500/5 bg-gradient-to-br from-teal-50/30 via-white to-stone-50 dark:from-teal-950/20 dark:via-zinc-900 dark:to-stone-900',
    headerStyle: 'font-medium tracking-wide text-teal-900 dark:text-teal-200 border-b border-teal-500/30 pb-2',
    subSectionBg: 'bg-teal-500/5 dark:bg-teal-500/10 border border-teal-500/20 rounded-xl p-4'
  },
  cosmopolitan: {
    name: 'Cosmopolitan Chic',
    dayPrefix: (day) => `Day ${day} • The City`,
    sectionTitles: {
      accommodations: '5★ Metropolitan Hotel',
      activities: 'Curated City Highlights',
      transfers: 'Private Chauffeur Service',
      meals: 'Michelin & Rooftop Dining'
    },
    badgeStyle: 'bg-indigo-500/15 text-indigo-900 dark:text-indigo-300 border border-indigo-500/30 font-bold uppercase tracking-wider text-[10px]',
    cardBorder: 'border-indigo-500/30 shadow-xl shadow-indigo-500/5 bg-gradient-to-tr from-slate-50 via-white to-indigo-50/20 dark:from-slate-900 dark:via-zinc-900 dark:to-indigo-950/20',
    headerStyle: 'font-bold tracking-tight text-indigo-950 dark:text-indigo-200 border-b-2 border-indigo-500/30 pb-2',
    subSectionBg: 'bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4'
  },
  nordic: {
    name: 'Nordic Minimalist',
    dayPrefix: (day) => `Day ${day} // Nordic Way`,
    sectionTitles: {
      accommodations: 'Design Hotel & Fjord Cabins',
      activities: 'Nordic Explorations',
      transfers: 'Scenic Fjord & Rail Transit',
      meals: 'New Nordic Dining'
    },
    badgeStyle: 'bg-slate-500/15 text-slate-800 dark:text-slate-300 border border-slate-500/30 font-mono tracking-widest text-[10px]',
    cardBorder: 'border-slate-300 dark:border-slate-800 shadow-sm bg-white dark:bg-zinc-900',
    headerStyle: 'font-light tracking-widest uppercase text-slate-800 dark:text-slate-200 border-b border-slate-300 dark:border-slate-800 pb-2',
    subSectionBg: 'bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg p-4'
  },
  tropic: {
    name: 'Tropical Paradise',
    dayPrefix: (day) => `Island Day ${day}`,
    sectionTitles: {
      accommodations: 'Beachfront Resort & Villas',
      activities: 'Island & Marine Excursions',
      transfers: 'Speedboat & VIP Transfers',
      meals: 'Sunset Beachfront Dining'
    },
    badgeStyle: 'bg-cyan-500/15 text-cyan-900 dark:text-cyan-300 border border-cyan-500/30 font-bold tracking-wide text-[11px]',
    cardBorder: 'border-cyan-500/30 shadow-lg shadow-cyan-500/5 bg-gradient-to-br from-cyan-50/30 via-white to-amber-50/20 dark:from-cyan-950/20 dark:via-zinc-900 dark:to-amber-950/10',
    headerStyle: 'font-extrabold text-cyan-950 dark:text-cyan-200 border-b-2 border-cyan-500/30 pb-2',
    subSectionBg: 'bg-cyan-500/5 dark:bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4'
  },
  aegean: {
    name: 'Aegean Odyssey',
    dayPrefix: (day) => `Odyssey Day ${day}`,
    sectionTitles: {
      accommodations: 'Caldera & Cliffside Suites',
      activities: 'Aegean Yacht & Heritage Tours',
      transfers: 'Private Catamaran & Chauffeur',
      meals: 'Mediterranean Cliffside Dining'
    },
    badgeStyle: 'bg-blue-600/15 text-blue-900 dark:text-blue-300 border border-blue-600/30 font-serif tracking-wider text-[11px]',
    cardBorder: 'border-blue-600/30 shadow-lg shadow-blue-500/5 bg-gradient-to-b from-white via-blue-50/10 to-white dark:from-zinc-900 dark:via-blue-950/20 dark:to-zinc-900',
    headerStyle: 'font-serif font-bold text-blue-950 dark:text-blue-200 border-b-2 border-blue-600/30 pb-2',
    subSectionBg: 'bg-blue-600/5 dark:bg-blue-600/10 border border-blue-600/20 rounded-xl p-4'
  },
  desert: {
    name: 'Desert Oasis',
    dayPrefix: (day) => `Oasis Day ${day}`,
    sectionTitles: {
      accommodations: 'Luxury Dunes Resort & Camp',
      activities: 'Dune Safaris & Heritage Tours',
      transfers: '4x4 Private Desert Transit',
      meals: 'Bedouin Feast & Starlit Dining'
    },
    badgeStyle: 'bg-orange-500/15 text-orange-900 dark:text-orange-300 border border-orange-500/30 font-bold tracking-wider text-[11px]',
    cardBorder: 'border-orange-500/30 shadow-lg shadow-orange-500/5 bg-gradient-to-br from-orange-50/30 via-white to-amber-50/20 dark:from-orange-950/20 dark:via-zinc-900 dark:to-amber-950/10',
    headerStyle: 'font-serif font-bold text-orange-950 dark:text-orange-200 border-b-2 border-orange-500/30 pb-2',
    subSectionBg: 'bg-orange-500/5 dark:bg-orange-500/10 border border-orange-500/20 rounded-xl p-4'
  },
  base: {
    name: 'Standard Executive',
    dayPrefix: (day) => `Day ${day}`,
    sectionTitles: {
      accommodations: 'Accommodations & Check-In',
      activities: 'Private Experiences & Activities',
      transfers: 'VIP Transfers & Logistics',
      meals: 'Gourmet Dining & Meals'
    },
    badgeStyle: 'bg-primary/10 text-primary border border-primary/20 font-semibold text-xs px-2.5 py-1',
    cardBorder: 'border-outline-variant shadow-sm bg-surface dark:bg-surface-container',
    headerStyle: 'font-bold text-primary border-b border-outline-variant pb-2',
    subSectionBg: 'bg-surface-container-low border border-outline-variant/60 rounded-xl p-4'
  }
};

export function getVibeConfig(templateId) {
  if (!templateId) return VIBE_CONFIGS.base;
  const key = String(templateId).toLowerCase().trim();
  if (VIBE_CONFIGS[key]) return VIBE_CONFIGS[key];
  
  for (const [k, config] of Object.entries(VIBE_CONFIGS)) {
    if (key.includes(k)) return config;
  }
  return VIBE_CONFIGS.base;
}
