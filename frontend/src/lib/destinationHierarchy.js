// Voyanta Dynamic Region-to-City Hierarchy & Vault Seeding Engine

const INITIAL_HIERARCHY = {
  meghalaya: ['shillong', 'cherrapunji', 'sohra', 'dawki', 'mawlynnong', 'umiam', 'guwahati', 'jowai', 'meghalaya', 'northeast', 'nohkalikai', 'kamakhya'],
  kashmir: ['srinagar', 'gulmarg', 'pahalgam', 'sonamarg', 'dal lake', 'kashmir'],
  kerala: ['munnar', 'alleppey', 'kochi', 'thekkady', 'kovalam', 'wayanad', 'kerala'],
  rajasthan: ['jaipur', 'udaipur', 'jodhpur', 'jaisalmer', 'pushkar', 'rajasthan'],
  himachal: ['shimla', 'manali', 'dharamshala', 'dalhousie', 'spiti', 'himachal'],
  uttarakhand: ['rishikesh', 'mussoorie', 'nainital', 'jim corbett', 'auli', 'uttarakhand']
};

export const INDIA_SUB_DESTINATIONS = {
  varanasi: [
    { id: 'v1', name: 'Dashashwamedh Ghat', type: 'attraction', short_description: 'Sacred ghat famous for daily evening Ganga Aarti' },
    { id: 'v2', name: 'Kashi Vishwanath Corridor', type: 'temple', short_description: 'Golden spire temple complex dedicated to Lord Shiva' },
    { id: 'v3', name: 'Assi Ghat', type: 'attraction', short_description: 'Subah-e-Banaras morning yoga and ghat sunrise boat rides' },
    { id: 'v4', name: 'Sarnath', type: 'spiritual', short_description: 'Sacred Buddhist site where Lord Buddha delivered first sermon' },
    { id: 'v5', name: 'Manikarnika Ghat', type: 'attraction', short_description: 'Historic ancient burning ghat along holy Ganges' }
  ],
  meghalaya: [
    { id: 'm1', name: 'Shillong', type: 'town', short_description: 'Scotland of the East, Ward’s Lake, Elephant Falls & cafes' },
    { id: 'm2', name: 'Cherrapunji', type: 'hill_station', short_description: 'Nohkalikai Waterfalls, Mawsmai Cave & Seven Sisters Falls' },
    { id: 'm3', name: 'Dawki', type: 'town', short_description: 'Crystal-clear Umngot River floating boat rides' },
    { id: 'm4', name: 'Mawlynnong', type: 'attraction', short_description: 'Cleanest village in Asia with living root bridges' },
    { id: 'm5', name: 'Nongriat', type: 'attraction', short_description: 'Famous 250-year-old Double Decker Living Root Bridge' },
    { id: 'm6', name: 'Mawsynram', type: 'village', short_description: 'Wettest place on earth with pristine caves' },
    { id: 'm7', name: 'Jowai', type: 'town', short_description: 'Krang Suri Waterfalls & Nartiang Monoliths' },
    { id: 'm8', name: 'Garo Hills', type: 'wildlife_park', short_description: 'Nokrek & Balpakram National Parks' }
  ],
  delhi: [
    { id: 'd1', name: 'Old Delhi', type: 'town', short_description: 'Chandni Chowk, Jama Masjid & heritage street food' },
    { id: 'd2', name: 'Meena Bazaar', type: 'shopping', short_description: 'Traditional attire, embroidery & handicrafts bazaar' },
    { id: 'd3', name: 'New Delhi', type: 'town', short_description: 'India Gate, Rashtrapati Bhavan & Central Vista' },
    { id: 'd4', name: 'South Delhi', type: 'town', short_description: 'Qutub Minar, Lotus Temple & Hauz Khas Village' }
  ],
  kerala: [
    { id: 'k1', name: 'Munnar', type: 'hill_station', short_description: 'Rolling tea estates and Eravikulam National Park' },
    { id: 'k2', name: 'Alleppey', type: 'town', short_description: 'Vembanad Lake luxury private houseboat backwater cruises' },
    { id: 'k3', name: 'Wayanad', type: 'hill_station', short_description: 'Edakkal Caves, Chembra Peak & spice plantations' },
    { id: 'k4', name: 'Thekkady', type: 'wildlife_park', short_description: 'Periyar Tiger Reserve boat safari' },
    { id: 'k5', name: 'Kovalam', type: 'beach', short_description: 'Lighthouse Beach & crescent coastal shores' }
  ],
  rajasthan: [
    { id: 'r1', name: 'Jaipur', type: 'town', short_description: 'Pink City featuring Amber Fort, Hawa Mahal & City Palace' },
    { id: 'r2', name: 'Udaipur', type: 'town', short_description: 'City of Lakes with Lake Pichola boat cruises' },
    { id: 'r3', name: 'Jaisalmer', type: 'town', short_description: 'Golden City desert fort & Thar sand dunes camel safari' },
    { id: 'r4', name: 'Jodhpur', type: 'town', short_description: 'Blue City featuring Mehrangarh Fort & Jaswant Thada' },
    { id: 'r5', name: 'Pushkar', type: 'spiritual', short_description: 'Sacred Brahma Temple & holy lake ghats' }
  ],
  ladakh: [
    { id: 'l1', name: 'Leh', type: 'town', short_description: 'Shanti Stupa, Leh Palace & Thiksey Monastery' },
    { id: 'l2', name: 'Nubra Valley', type: 'valley', short_description: 'Khardung La Pass & Hunder double-humped camel safari' },
    { id: 'l3', name: 'Pangong Tso', type: 'attraction', short_description: 'High-altitude turquoise salt lake' }
  ],
  kashmir: [
    { id: 'ks1', name: 'Srinagar', type: 'town', short_description: 'Dal Lake Shikara rides & Mughal Gardens' },
    { id: 'ks2', name: 'Gulmarg', type: 'hill_station', short_description: 'World’s highest gondola cable car & ski slopes' },
    { id: 'ks3', name: 'Pahalgam', type: 'valley', short_description: 'Betaab Valley, Aru Valley & Lidder River' },
    { id: 'ks4', name: 'Sonamarg', type: 'valley', short_description: 'Meadow of Gold & Thajiwas Glacier' }
  ],
  himachal: [
    { id: 'h1', name: 'Shimla', type: 'hill_station', short_description: 'Mall Road, Jakhu Temple & Ridge promenade' },
    { id: 'h2', name: 'Manali', type: 'hill_station', short_description: 'Solang Valley adventure sports & Rohtang Pass' },
    { id: 'h3', name: 'Dharamshala', type: 'hill_station', short_description: 'McLeod Ganj, Dalai Lama Temple & Triund Trek' }
  ],
  uttarakhand: [
    { id: 'u1', name: 'Rishikesh', type: 'spiritual', short_description: 'Yoga capital, Ganga river rafting & Triveni Ghat Aarti' },
    { id: 'u2', name: 'Mussoorie', type: 'hill_station', short_description: 'Kempty Falls, Gun Hill & Mall Road' },
    { id: 'u3', name: 'Nainital', type: 'hill_station', short_description: 'Naini Lake boating & Tiffin Top' }
  ]
};

export function getLocalSubDestinations(destName) {
  if (!destName) return [];
  const key = String(destName).toLowerCase().trim();
  for (const [k, list] of Object.entries(INDIA_SUB_DESTINATIONS)) {
    if (key.includes(k) || k.includes(key)) return list;
  }
  return [];
}

/**
 * Get all learned and initial hierarchy mappings
 */
export function getDestinationHierarchy() {
  try {
    const custom = JSON.parse(localStorage.getItem('voyanta_destination_hierarchy') || '{}');
    const merged = { ...INITIAL_HIERARCHY };
    for (const [key, list] of Object.entries(custom)) {
      const existing = merged[key] || [];
      const combined = Array.from(new Set([...existing, ...list]));
      merged[key] = combined;
    }
    return merged;
  } catch {
    return INITIAL_HIERARCHY;
  }
}

/**
 * Dynamically register new parent-child relationships as items/proposals are saved
 */
export function registerDestinationHierarchy(parentRegion, subDestList) {
  if (!parentRegion) return;
  const parentKey = parentRegion.toLowerCase().trim();
  if (!parentKey) return;

  const newTokens = (Array.isArray(subDestList) ? subDestList : [subDestList])
    .flatMap(s => String(s || '').split(/[-–,|/&()]/))
    .map(s => s.toLowerCase().trim())
    .filter(s => s.length > 2);

  if (newTokens.length === 0) return;

  try {
    const custom = JSON.parse(localStorage.getItem('voyanta_destination_hierarchy') || '{}');
    const existing = custom[parentKey] || [];
    const updated = Array.from(new Set([...existing, ...newTokens]));
    custom[parentKey] = updated;
    localStorage.setItem('voyanta_destination_hierarchy', JSON.stringify(custom));
  } catch {}
}

/**
 * Split multi-city titles like "Guwahati– Shillong (100 KM| 3 Hrs)" into candidate tokens
 */
export function extractLocationTokens(str) {
  if (!str || typeof str !== 'string') return [];
  // Remove parenthetical noise like (100 KM| 3 Hrs)
  const cleanedStr = str.replace(/\([^)]*\)/g, ' ');
  const rawParts = cleanedStr.split(/[-–,|/&\s]+/).map(p => p.toLowerCase().trim()).filter(Boolean);
  
  // Filter out common stop words
  const finalTokens = [];
  rawParts.forEach(p => {
    if (p.length > 2 && !['day', 'in', 'hrs', 'km', 'and', 'the', 'with', 'via', 'from'].includes(p)) {
      finalTokens.push(p);
    }
  });

  return Array.from(new Set(finalTokens));
}

/**
 * Returns candidate tokens for a given destination + subDestination
 */
export function getCandidateTokens(destinationStr, subDestinationStr) {
  const hierarchy = getDestinationHierarchy();
  const destLower = (destinationStr || '').toLowerCase().trim();
  const tokens = new Set();

  if (destLower) {
    tokens.add(destLower);
    extractLocationTokens(destLower).forEach(t => tokens.add(t));

    // Check if destLower matches any known region key or array value
    for (const [region, subList] of Object.entries(hierarchy)) {
      if (destLower.includes(region) || region.includes(destLower)) {
        subList.forEach(s => tokens.add(s));
      } else {
        const matchesSub = subList.some(s => destLower.includes(s) || s.includes(destLower));
        if (matchesSub) {
          tokens.add(region);
          subList.forEach(s => tokens.add(s));
        }
      }
    }
  }

  if (subDestinationStr) {
    extractLocationTokens(subDestinationStr).forEach(t => tokens.add(t));
  }

  return Array.from(tokens);
}

/**
 * Universal item location matcher
 */
export function isLocationMatch(item, destinationStr, subDestinationStr) {
  if (!destinationStr && !subDestinationStr) return true;

  const candidates = getCandidateTokens(destinationStr, subDestinationStr);
  if (candidates.length === 0) return true;

  const itemDest = (item.destination || item.location || '').toLowerCase().trim();
  const itemArea = (item.area || item.location || '').toLowerCase().trim();
  const itemName = (item.name || item.label || '').toLowerCase().trim();
  const itemCombined = `${itemDest} ${itemArea} ${itemName}`;

  return candidates.some(token => {
    if (token.length <= 2) return false;
    return itemCombined.includes(token) || token.includes(itemDest) || token.includes(itemArea);
  });
}

/**
 * Seed sample Meghalaya Vault data globally if missing
 */
export function seedMeghalayaGlobalVault() {
  try {
    const key = 'voyanta_vault_items';
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const hasMeghalaya = existing.some(i => 
      (i.destination || '').toLowerCase().includes('meghalaya') || 
      (i.destination || '').toLowerCase().includes('shillong')
    );

    if (hasMeghalaya) return;

    const sampleItems = [
      {
        id: 'seed_meg_h1',
        object_type: 'hotel',
        kind: 'hotel',
        name: 'La Castle Residency',
        destination: 'Shillong',
        area: 'Shillong',
        location: 'Police Bazaar, Shillong',
        category: 'Deluxe Hotel',
        star_rating: '4 Star',
        price: 4500,
        currency: 'INR',
        cover_image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
        is_active: true
      },
      {
        id: 'seed_meg_h2',
        object_type: 'hotel',
        kind: 'hotel',
        name: 'Ri Kynjai - Serenity by the Lake',
        destination: 'Shillong',
        area: 'Umiam',
        location: 'Umiam Lake, Meghalaya',
        category: 'Luxury Resort',
        star_rating: '5 Star',
        price: 12500,
        currency: 'INR',
        cover_image: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=800&q=80',
        is_active: true
      },
      {
        id: 'seed_meg_a1',
        object_type: 'activity',
        kind: 'activity',
        name: 'Kamakhya Temple Visit',
        destination: 'Guwahati',
        area: 'Guwahati',
        location: 'Nilachal Hills, Guwahati',
        duration_hours: '3',
        price: 500,
        currency: 'INR',
        image_url: 'https://images.unsplash.com/photo-1609828913664-85d52274cd3c?auto=format&fit=crop&w=800&q=80',
        is_active: true
      },
      {
        id: 'seed_meg_a2',
        object_type: 'activity',
        kind: 'activity',
        name: 'Umiam Lake (Barapani) Sunset View',
        destination: 'Shillong',
        area: 'Umiam',
        location: 'Umiam Lake, Meghalaya',
        duration_hours: '2',
        price: 300,
        currency: 'INR',
        image_url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
        is_active: true
      },
      {
        id: 'seed_meg_a3',
        object_type: 'activity',
        kind: 'activity',
        name: 'Police Bazaar Evening Stroll & Shopping',
        destination: 'Shillong',
        area: 'Shillong',
        location: 'Police Bazaar, Shillong',
        duration_hours: '2',
        price: 0,
        currency: 'INR',
        image_url: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=800&q=80',
        is_active: true
      },
      {
        id: 'seed_meg_a4',
        object_type: 'activity',
        kind: 'activity',
        name: 'Nohkalikai Falls & Cherrapunji Caves',
        destination: 'Cherrapunji',
        area: 'Cherrapunji',
        location: 'Sohra / Cherrapunji',
        duration_hours: '4',
        price: 800,
        currency: 'INR',
        image_url: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=800&q=80',
        is_active: true
      },
      {
        id: 'seed_meg_a5',
        object_type: 'activity',
        kind: 'activity',
        name: 'Dawki Crystal Clear River Boating (Umngot River)',
        destination: 'Dawki',
        area: 'Dawki',
        location: 'Dawki, Meghalaya',
        duration_hours: '3',
        price: 1200,
        currency: 'INR',
        image_url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80',
        is_active: true
      }
    ];

    localStorage.setItem(key, JSON.stringify([...sampleItems, ...existing]));
  } catch {}
}

// Auto-seed on load
seedMeghalayaGlobalVault();
