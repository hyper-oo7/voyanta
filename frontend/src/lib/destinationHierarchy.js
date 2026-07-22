// Voyanta Dynamic Region-to-City Hierarchy & Vault Seeding Engine

const INITIAL_HIERARCHY = {
  meghalaya: ['shillong', 'cherrapunji', 'sohra', 'dawki', 'mawlynnong', 'umiam', 'guwahati', 'jowai', 'meghalaya', 'northeast', 'nohkalikai', 'kamakhya'],
  kashmir: ['srinagar', 'gulmarg', 'pahalgam', 'sonamarg', 'dal lake', 'kashmir'],
  kerala: ['munnar', 'alleppey', 'kochi', 'thekkady', 'kovalam', 'wayanad', 'kerala'],
  rajasthan: ['jaipur', 'udaipur', 'jodhpur', 'jaisalmer', 'pushkar', 'rajasthan'],
  himachal: ['shimla', 'manali', 'dharamshala', 'dalhousie', 'spiti', 'himachal'],
  uttarakhand: ['rishikesh', 'mussoorie', 'nainital', 'jim corbett', 'auli', 'uttarakhand']
};

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
