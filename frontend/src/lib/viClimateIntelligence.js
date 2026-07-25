/**
 * viClimateIntelligence.js
 * Sophisticated climate-intelligent itinerary generation and caching helper.
 */

export const DESTINATION_CLIMATE = {
  meghalaya: {
    hot_months: [3, 4],
    monsoon_months: [4, 5, 6, 7, 8, 9], // May to October
    cool_months: [10, 11, 0, 1, 2], // November to March
    notes: 'Meghalaya & Shillong feature misty green hills, living root bridges, and cascading waterfalls. Monsoons (May–Oct) offer world-record waterfalls; carry light rain jackets/umbrellas. Winters (Nov–March) bring crisp, clear skies (10°C–20°C).'
  },
  shillong: {
    hot_months: [3, 4],
    monsoon_months: [4, 5, 6, 7, 8, 9],
    cool_months: [10, 11, 0, 1, 2],
    notes: 'Shillong is pleasant year-round (~15°C–24°C). Monsoons (May–Oct) bring dramatic rain and waterfall views. Winters (Nov–March) are cool and sunny, ideal for boat rides on Umium Lake.'
  },
  kashmir: {
    hot_months: [],
    cool_months: [9, 10, 11, 0, 1, 2],
    snow_months: [11, 0, 1, 2],
    notes: 'Kashmir is cool and pleasant even in summer (May–August, ~20°C). Strolling, lake boat rides, and valley walks are perfect year-round.'
  },
  rajasthan: {
    hot_months: [3, 4, 5, 6], // April to July
    cool_months: [9, 10, 11, 0, 1, 2],
    monsoon_months: [7, 8],
    notes: 'Rajasthan summers exceed 45°C. Avoid outdoor afternoon plans. Focus on early morning/dusk excursions, indoor palaces, and afternoon spa sessions.'
  },
  dubai: {
    hot_months: [4, 5, 6, 7, 8], // May to September
    cool_months: [10, 11, 0, 1, 2, 3],
    notes: 'Dubai summers are extremely hot (>40°C). Avoid afternoon outdoor walking. Suggest indoor shopping, AC museums, and evening desert safaris.'
  },
  kerala: {
    hot_months: [2, 3, 4], // March to May
    monsoon_months: [5, 6, 7, 8], // June to September
    cool_months: [9, 10, 11, 0, 1],
    notes: 'Kerala is warm/humid. Monsoons are beautiful for rain-walks and indoor Ayurvedic spa therapy. Avoid afternoon sun in April/May.'
  },
  goa: {
    hot_months: [2, 3, 4],
    monsoon_months: [5, 6, 7, 8],
    cool_months: [10, 11, 0, 1],
    notes: 'Goa is tropical. Midday beach strolls in summer are intense; recommend sunset beach visits and morning spice plantation visits.'
  },
  himachal: {
    hot_months: [],
    cool_months: [9, 10, 11, 0, 1, 2, 3],
    snow_months: [11, 0, 1, 2],
    notes: 'Himachal has pleasant summers. Winter trips require heavy woolens and may face snow-blocked passes.'
  },
  ladakh: {
    hot_months: [],
    cool_months: [9, 10, 11, 0, 1, 2, 3, 4],
    blocked_months: [10, 11, 0, 1, 2, 3, 4],
    notes: 'Ladakh is highly pleasant in summer (June–September) for walking. Roads/passes are blocked or frozen in winter.'
  },
  uttarakhand: {
    hot_months: [4, 5],
    monsoon_months: [6, 7, 8],
    cool_months: [10, 11, 0, 1, 2],
    snow_months: [11, 0, 1],
    notes: 'Uttarakhand has refreshing mountain summers. Monsoons (July–Sept) require landslide caution. Winters (Nov–Feb) offer serene snow vistas.'
  }
};

export function getClimateClassification(dest, startDateStr) {
  const normDest = (dest || '').toLowerCase().trim();
  let date = new Date(startDateStr);
  if (isNaN(date.getTime())) date = new Date();
  const month = date.getMonth(); // 0 = Jan, 11 = Dec
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const currentMonthName = monthNames[month];

  // Find matching destination profile
  let profile = null;
  let keyMatch = 'other';
  for (const [key, p] of Object.entries(DESTINATION_CLIMATE)) {
    if (normDest.includes(key) || key.includes(normDest)) {
      profile = p;
      keyMatch = key;
      break;
    }
  }

  if (!profile) {
    if (normDest.includes('megh') || normDest.includes('shillong') || normDest.includes('cherra') || normDest.includes('assam')) {
      profile = DESTINATION_CLIMATE.meghalaya;
      keyMatch = 'meghalaya';
    } else {
      profile = { hot_months: [4, 5, 6], cool_months: [10, 11, 0, 1], notes: `General pleasant travel climate.` };
    }
  }

  const isHot = profile.hot_months?.includes(month) || false;
  const isCool = profile.cool_months?.includes(month) || false;
  const isSnow = profile.snow_months?.includes(month) || false;
  const isMonsoon = profile.monsoon_months?.includes(month) || false;

  const seasonName = isSnow ? 'Winter / Snow Season' : (isMonsoon ? 'Monsoon Season' : (isHot ? 'Summer Season' : 'Pleasant Peak Season'));

  const advisories = [];
  advisories.push({
    rule_type: 'info',
    message: `Travel Window (${currentMonthName}): ${seasonName}. ${profile.notes}`
  });

  if (isMonsoon) {
    advisories.push({
      rule_type: 'prefer',
      message: `Monsoon Advisory for ${currentMonthName}: Carry light rain jackets and waterproof gear. Excellent season for cascading waterfalls, living root bridges, and lush river valleys.`
    });
  } else if (isHot) {
    advisories.push({
      rule_type: 'avoid',
      message: `Summer Heat Advisory for ${currentMonthName}: Midday temperatures can be warm. Schedule outdoor excursions for early morning/sunset and reserve afternoons for indoor rest or AC comfort.`
    });
  } else if (isSnow || isCool) {
    advisories.push({
      rule_type: 'prefer',
      message: `Winter / Cool Advisory for ${currentMonthName}: Crisp, clear skies. Pack warm layers/woolens for cool morning and evening strolls.`
    });
  }

  return {
    keyMatch,
    profileNotes: profile.notes || '',
    isHot,
    isCool,
    isSnow,
    isMonsoon,
    seasonName,
    advisories
  };
}

export function buildVIItinerary(dest, numDays, startDateStr) {
  const climate = getClimateClassification(dest, startDateStr);
  const days = [];

  for (let i = 1; i <= numDays; i++) {
    const isArrival = (i === 1);
    const isDeparture = (i === numDays);
    
    let title = '';
    let description = '';

    if (isArrival) {
      title = `Day 1: Premium Arrival & Check-in at ${dest}`;
      description = `Welcome to ${dest}! Private AC luxury vehicle transfer from the airport to your boutique 5-star hotel. Chilled refreshments served onboard. Spend the afternoon relaxing in your private villa suite before an exclusive welcome dinner at dusk.`;
    } else if (isDeparture) {
      title = `Day ${i}: Farewell & Luxury Transfer`;
      description = `Morning at leisure to enjoy the resort amenities, pool, or last-minute shopping. Chauffeur private transfer back to the airport for your onward journey.`;
    } else {
      // Intermediate days
      if (i === 2) {
        title = `Day 2: Bespoke Cultural & Heritage Immersion`;
        if (climate.isHot && climate.keyMatch !== 'kashmir') {
          description = `Rise early for a private 7:30 AM guided tour of ${dest}'s heritage sites before the afternoon heat peaks. Retreat to the hotel for a luxury indoor lunch. Spend the hot afternoon relaxing at the wellness spa. Reconvene at sunset for a scenic evening cruise.`;
        } else if (climate.isMonsoon) {
          description = `A curated exploration of local indoor galleries, historic palaces, and cultural museums. In the afternoon, enjoy an authentic culinary workshop and chef's tasting session, staying comfortably shielded from the monsoon showers.`;
        } else if (climate.isSnow) {
          description = `A cozy winter morning excursion to scenic spots. Afternoon hot-chocolate tasting or fireside tea, followed by a light tour of snow-draped landscapes with professional winter guides.`;
        } else {
          // Pleasant weather or Kashmir
          description = `A leisurely full-day guided exploration of ${dest}'s famous streets, markets, and historical architecture. Enjoy an afternoon stroll along the scenic vistas and a delightful outdoor garden lunch.`;
        }
      } else if (i === 3) {
        title = `Day 3: Nature Discovery & Scenic Viewpoints`;
        if (climate.isHot && climate.keyMatch !== 'kashmir') {
          description = `Embark on an early morning nature excursion to spectacular views. Return for midday rest inside the resort's temperature-controlled swimming pool. Indulge in an afternoon wine pairing session. In the evening, enjoy a private sunset dinner under the stars.`;
        } else if (climate.isMonsoon) {
          description = `Chauffeured scenic drive to capture lush mist-covered valleys and dramatic waterfall views. Afternoon Ayurvedic oil massage and herbal steam therapy session. Evening classical music or dance recital at the resort.`;
        } else {
          description = `Full-day excursion to the best scenic valleys and vantage points. A picnic lunch is prepared by our private chef at a breathtaking viewpoint. Afternoon stroll in the local coniferous forests and pine groves.`;
        }
      } else if (i === 4) {
        title = `Day 4: Artisan Encounters & Gastronomy`;
        if (climate.isHot && climate.keyMatch !== 'kashmir') {
          description = `Visit local artisan workshops and high-end boutiques in the cool morning hours. Spend the afternoon in an air-conditioned cooking masterclass or tasting premium local teas. Finish the day with a relaxing sunset yacht or evening rooftop dinner.`;
        } else {
          description = `Walk through local handicraft markets and traditional weaving centers. Meet master craftsmen for an interactive demonstration. Relish a traditional multi-course royal lunch. Evening at leisure for shopping or walking.`;
        }
      } else {
        // Day 5+ general templates
        title = `Day ${i}: Tailored Day at Leisure`;
        description = `Customized options for your final full day in ${dest}. Choose between a private wellness session, golf class, or bespoke helicopter tour. Afternoon relaxation followed by a celebratory champagne toast.`;
      }
    }

    days.push({
      id: `vi_gen_${i}_${Math.random().toString(36).slice(2, 6)}`,
      day: i,
      title,
      description,
      block_type: isArrival ? 'arrival' : (isDeparture ? 'departure' : 'day'),
      content: []
    });
  }

  return days;
}
