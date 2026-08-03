// vaultSyncService.js
// Automatically syncs Vault packages, supplier PDFs, proposals, and itineraries
// into the master unified library for Hotels, Activities, Attractions & Destinations.

export function syncVaultAndProposalsToLibrary() {
  try {
    // 1. Read vault items from localStorage
    const vaultStr = localStorage.getItem('voyanta_vault_items') || '[]';
    let vaultPkgs = [];
    try { vaultPkgs = JSON.parse(vaultStr); } catch {}

    // 2. Read saved proposals from localStorage
    let proposals = [];
    try {
      const propKeys = Object.keys(localStorage).filter(k => k.startsWith('voyanta_proposal_'));
      proposals = propKeys.map(k => {
        try { return JSON.parse(localStorage.getItem(k)); } catch { return null; }
      }).filter(Boolean);
    } catch {}

    const combined = [...vaultPkgs, ...proposals];
    
    // 3. Sync all items to voyanta_unified_library
    const libraryStr = localStorage.getItem('voyanta_unified_library') || '[]';
    let library = [];
    try { 
      const parsed = JSON.parse(libraryStr);
      library = parsed.filter(item => item && (item.type === 'hotel' || item.type === 'activity'));
    } catch {}
    let updated = library.length !== (JSON.parse(libraryStr || '[]').length);

    combined.forEach(pkg => {
      if (!pkg) return;
      const parsed = (typeof pkg.parsed_data === 'string' ? JSON.parse(pkg.parsed_data) : pkg.parsed_data) || pkg || {};
      const hotels = parsed.hotels || pkg.hotels || [];
      const activities = parsed.activities || pkg.activities || [];
      const days = parsed.days || pkg.days || [];
      const dest = pkg.destination || parsed.destination || '';

      // Extract hotels from package and day itineraries
      hotels.forEach(h => {
        if (!h) return;
        const name = typeof h === 'string' ? h : h.name;
        if (!name) return;
        const id = h.id || `hotel_${pkg.id || name}_${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        if (!library.some(item => String(item.id) === String(id))) {
          library.push({
            id,
            name,
            type: 'hotel',
            location: (typeof h === 'object' && h.location) || dest || 'Imported Location',
            country: typeof h === 'object' ? h.country || '' : '',
            price_per_night: typeof h === 'object' ? Number(h.price_per_night || h.rate || h.price || 5000) : 5000,
            meal_type: typeof h === 'object' ? h.meal_type || h.meal_plan || 'CP (Breakfast)' : 'CP (Breakfast)',
            room_type: typeof h === 'object' ? h.room_type || 'Deluxe Room' : 'Deluxe Room',
            rating: typeof h === 'object' ? Number(h.rating || 4.5) : 4.5,
            category: typeof h === 'object' ? h.category || '4 Star' : '4 Star',
            amenities: typeof h === 'object' && Array.isArray(h.amenities) ? h.amenities : ['WiFi', 'Pool', 'Spa'],
            image_url: typeof h === 'object' && (h.image_url || h.cover_image) ? (h.image_url || h.cover_image) : 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800',
            currency: typeof h === 'object' ? h.currency || 'INR' : 'INR',
            source: 'vault'
          });
          updated = true;
        }
      });

      // Extract activities & attractions from package
      activities.forEach(act => {
        if (!act) return;
        const name = typeof act === 'string' ? act : act.name;
        if (!name) return;
        const id = act.id || `activity_${pkg.id || name}_${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        if (!library.some(item => String(item.id) === String(id))) {
          library.push({
            id,
            name,
            type: 'activity',
            location: (typeof act === 'object' && act.location) || dest || 'Imported Location',
            duration_hours: typeof act === 'object' ? Number(act.duration_hours || 4) : 4,
            price: typeof act === 'object' ? Number(act.price || act.rate || 3500) : 3500,
            currency: typeof act === 'object' ? act.currency || 'INR' : 'INR',
            description: typeof act === 'object' ? act.description || act.details || '' : '',
            image_url: typeof act === 'object' && (act.image_url || act.cover_image) ? (act.image_url || act.cover_image) : 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800',
            source: 'vault'
          });
          updated = true;
        }
      });

      // Extract day-by-day activities & attractions from proposal/itinerary days
      days.forEach(day => {
        if (!day) return;
        const dayActs = day.activities || [];
        const subDest = day.sub_destination || day.location || dest;
        dayActs.forEach(dAct => {
          const actName = typeof dAct === 'string' ? dAct : dAct.name;
          if (!actName) return;
          const id = `activity_day_${actName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
          if (!library.some(item => String(item.id) === String(id))) {
            library.push({
              id,
              name: actName,
              type: 'activity',
              location: subDest || dest || 'Imported Location',
              duration_hours: typeof dAct === 'object' ? Number(dAct.duration_hours || 3) : 3,
              price: typeof dAct === 'object' ? Number(dAct.price || 2500) : 2500,
              currency: typeof dAct === 'object' ? dAct.currency || 'INR' : 'INR',
              description: typeof dAct === 'object' ? dAct.description || '' : '',
              image_url: typeof dAct === 'object' && dAct.image_url ? dAct.image_url : 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800',
              source: 'itinerary'
            });
            updated = true;
          }
        });
      });
    });

    if (updated) {
      localStorage.setItem('voyanta_unified_library', JSON.stringify(library));
    }
  } catch (err) {
    console.warn('Failed to sync vault and proposals to library:', err);
  }
}
