const CURATED_IMAGES = {
  destinations: {
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
    const match = Object.keys(CURATED_IMAGES.destinations).find(k => destKey.includes(k));
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
