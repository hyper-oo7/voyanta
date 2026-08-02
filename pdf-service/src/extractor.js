/**
 * Travel Named Entity Recognition (NER) extractor.
 * Pulls destinations, hotels, activities, dates, pricing, confirmation numbers, transport modes, and meal plans.
 */

export function extractTravelEntities(text) {
  const entities = {
    destinations: [],
    hotels: [],
    activities: [],
    dates: [],
    prices: [],
    confirmationNumbers: [],
    transportModes: [],
    mealPlans: [],
  };

  if (!text) return entities;

  const destinationPatterns = [
    /\b(manali|shimla|dharamshala|dalhousie|kasol|kasauli)\b/gi,
    /\b(goa|kerala|rajasthan|jaipur|udaipur|jodhpur|pushkar)\b/gi,
    /\b(leh|ladakh|srinagar|gulmarg|pahalgam)\b/gi,
    /\b(rishikesh|haridwar|nainital|mussoorie|auli)\b/gi,
    /\b(agra|varanasi|khajuraho|amritsar|chandigarh)\b/gi,
    /\b(andaman|lakshadweep|coorg|munnar|alleppey)\b/gi,
  ];
  destinationPatterns.forEach((regex) => {
    const matches = text.match(regex);
    if (matches) {
      entities.destinations.push(...matches.map((m) => m.trim()));
    }
  });
  entities.destinations = [...new Set(entities.destinations.map((d) => d.toLowerCase()))];

  const hotelRegex = /(?:hotel|resort|lodge|villa|homestay|guest house)\s+([A-Z][A-Za-z\s&]+?)(?=\n|\.|,|\d|\(|\))/gi;
  let match;
  while ((match = hotelRegex.exec(text)) !== null) {
    entities.hotels.push(match[1].trim());
  }
  entities.hotels = [...new Set(entities.hotels)].slice(0, 20);

  const activityPatterns = [
    /\b(paragliding|river rafting|trekking|skiing|camping|zorbing)\b/gi,
    /\b(sightseeing|temple visit|cable car|boat ride|cycling|hiking)\b/gi,
    /\b(spa|yoga|ayurveda|cooking class|village walk|sunset point)\b/gi,
  ];
  activityPatterns.forEach((regex) => {
    const matches = text.match(regex);
    if (matches) {
      entities.activities.push(...matches.map((m) => m.trim().toLowerCase()));
    }
  });
  entities.activities = [...new Set(entities.activities)];

  const dateRegex = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4})\b/gi;
  const dateMatches = text.match(dateRegex);
  if (dateMatches) entities.dates = dateMatches;

  const priceRegex = /(?:₹|rs\.?|inr)\s*[\d,]+(?:\.\d{2})?/gi;
  const priceMatches = text.match(priceRegex);
  if (priceMatches) {
    entities.prices = priceMatches.map((p) =>
      p.replace(/[^\d,]/g, "").replace(/,/g, "")
    ).filter((p) => parseInt(p, 10) > 100).slice(0, 20);
  }

  const confRegex = /\b(?:pnr|booking ref|confirmation|voucher)\s*[:#]?\s*([A-Z0-9]{4,})\b/gi;
  let confMatch;
  while ((confMatch = confRegex.exec(text)) !== null) {
    entities.confirmationNumbers.push(confMatch[1]);
  }

  const transportPatterns = [
    /\b(volvo|bus|train|flight|helicopter|cab|taxi|private car|shatabdi)\b/gi,
  ];
  transportPatterns.forEach((regex) => {
    const matches = text.match(regex);
    if (matches) {
      entities.transportModes.push(...matches.map((m) => m.trim().toLowerCase()));
    }
  });
  entities.transportModes = [...new Set(entities.transportModes)];

  const mealRegex = /\b(cp|map|ap|ep|bb|hb|fb)\b/gi;
  const mealMatches = text.match(mealRegex);
  if (mealMatches) {
    entities.mealPlans = [...new Set(mealMatches.map((m) => m.toUpperCase()))];
  }

  return entities;
}
