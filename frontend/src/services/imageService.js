const CURATED_IMAGES = {
  destinations: {
    'manali': [
      'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&q=80&w=2000', // Hadimba Pine Forest
      'https://images.unsplash.com/photo-1605649487212-47bdab064df7?auto=format&fit=crop&q=80&w=2000', // Solang Valley Snow
      'https://images.unsplash.com/photo-1597074866923-dc0589150358?auto=format&fit=crop&q=80&w=2000', // Himachal Mountains
      'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&q=80&w=2000', // Beas River Valley
    ],
    'shimla': [
      'https://images.unsplash.com/photo-1597074866923-dc0589150358?auto=format&fit=crop&q=80&w=2000',
      'https://images.unsplash.com/photo-1605649487212-47bdab064df7?auto=format&fit=crop&q=80&w=2000',
    ],
    'kashmir': [
      'https://images.unsplash.com/photo-1595815771614-ade9d652a65d?auto=format&fit=crop&q=80&w=2000', // Dal Lake Shikara
      'https://images.unsplash.com/photo-1566837945700-30057527ade0?auto=format&fit=crop&q=80&w=2000', // Gulmarg Snow
    ],
    'srinagar': [
      'https://images.unsplash.com/photo-1595815771614-ade9d652a65d?auto=format&fit=crop&q=80&w=2000',
    ],
    'ladakh': [
      'https://images.unsplash.com/photo-1581793745862-99fde7fa73d2?auto=format&fit=crop&q=80&w=2000', // Pangong Lake
    ],
    'kerala': [
      'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&q=80&w=2000', // Houseboat Backwaters
    ],
    'goa': [
      'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&q=80&w=2000', // Palolem Beach Sunset
    ],
    'rajasthan': [
      'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&q=80&w=2000', // Hawa Mahal
    ],
    'jaipur': [
      'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&q=80&w=2000',
      'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&q=80&w=2000', // Amer Fort
    ],
    'udaipur': [
      'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&q=80&w=2000', // Lake Pichola
    ],
    'paris': [
      'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&q=80&w=2000',
      'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&q=80&w=2000',
    ],
    'switzerland': [
      'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?auto=format&fit=crop&q=80&w=2000',
      'https://images.unsplash.com/photo-1527668752968-14ce70a6c76a?auto=format&fit=crop&q=80&w=2000',
    ],
    'dubai': [
      'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&q=80&w=2000',
      'https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&q=80&w=2000',
    ],
    'bali': [
      'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&q=80&w=2000',
      'https://images.unsplash.com/photo-1555400038-63f5ba517a47?auto=format&fit=crop&q=80&w=2000',
    ],
    'maldives': [
      'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&q=80&w=2000',
    ],
    'tokyo': [
      'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&q=80&w=2000',
    ],
    'new york': [
      'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&q=80&w=2000',
    ]
  },
  tour_types: {
    'honeymoon': [
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=2000',
      'https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?auto=format&fit=crop&q=80&w=2000',
    ],
    'family': [
      'https://images.unsplash.com/photo-1542044896530-05d85be9b11a?auto=format&fit=crop&q=80&w=2000',
    ],
    'corporate': [
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=2000',
    ],
    'wellness': [
      'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&q=80&w=2000',
    ],
    'adventure': [
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=2000',
    ],
    'luxury': [
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=2000',
      'https://images.unsplash.com/photo-1542314831-c53cd3816002?auto=format&fit=crop&q=80&w=2000',
    ]
  },
  fallbacks: [
    'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&q=80&w=2000',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=2000',
    'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&q=80&w=2000',
  ]
};

const imageCache = new Map();

export async function fetchContextualImage(destination, tourType) {
  const cacheKey = `${destination}-${tourType}`.toLowerCase();
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey);
  }

  let selectedUrl = null;

  if (destination) {
    const destKey = destination.toLowerCase().trim();
    const match = Object.keys(CURATED_IMAGES.destinations).find(k => destKey.includes(k) || k.includes(destKey));
    if (match) {
      const images = CURATED_IMAGES.destinations[match];
      selectedUrl = images[Math.floor(Math.random() * images.length)];
    }
  }

  if (!selectedUrl && tourType) {
    const typeKey = tourType.toLowerCase().trim();
    if (CURATED_IMAGES.tour_types[typeKey]) {
      const images = CURATED_IMAGES.tour_types[typeKey];
      selectedUrl = images[Math.floor(Math.random() * images.length)];
    }
  }

  if (!selectedUrl) {
    selectedUrl = CURATED_IMAGES.fallbacks[Math.floor(Math.random() * CURATED_IMAGES.fallbacks.length)];
  }

  imageCache.set(cacheKey, selectedUrl);
  return selectedUrl;
}

export async function fetchSimilarImages(query = '', limit = 6) {
  if (!query) return CURATED_IMAGES.fallbacks.map((url, i) => ({ id: `sim_${i}`, url, thumb: url }));

  const qLower = query.toLowerCase().trim();

  // Try live API first
  try {
    const res = await fetch(`/api/public/images/search?query=${encodeURIComponent(query)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.results) && data.results.length > 0) {
        return data.results.slice(0, limit);
      }
    }
  } catch (e) {
    console.warn('Failed to fetch similar images from API:', e);
  }

  // Fallback to curated destinations if API fails or returns empty
  const destMatch = Object.keys(CURATED_IMAGES.destinations).find(k => qLower.includes(k) || k.includes(qLower));
  if (destMatch) {
    return CURATED_IMAGES.destinations[destMatch].slice(0, limit).map((url, i) => ({ id: `${destMatch}_${i}`, url, thumb: url }));
  }

  return CURATED_IMAGES.fallbacks.slice(0, limit).map((url, i) => ({ id: `fb_sim_${i}`, url, thumb: url }));
}

