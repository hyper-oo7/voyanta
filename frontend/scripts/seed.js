import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const DEFAULT_AGENCY_ID = '00000000-0000-0000-0000-000000000001';

const DESTINATIONS = ['Japan', 'Europe', 'Dubai', 'Bali', 'Thailand', 'Vietnam', 'Singapore', 'Switzerland', 'Maldives', 'New York'];

const HOTELS = [
  { name: 'Aman Tokyo', location: 'Tokyo', country: 'Japan', category: 'Luxury', price_per_night: 85000, amenities: ['Spa', 'Pool', 'City View'], image_url: 'https://images.unsplash.com/photo-1542314831-c6a4d14dbce8?w=800' },
  { name: 'Hoshinoya Kyoto', location: 'Kyoto', country: 'Japan', category: 'Ryokan', price_per_night: 65000, amenities: ['River View', 'Traditional', 'Onsen'], image_url: 'https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?w=800' },
  { name: 'The Ritz-Carlton, Paris', location: 'Paris', country: 'Europe', category: '5 Star', price_per_night: 120000, amenities: ['Fine Dining', 'Spa', 'Central Location'], image_url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800' },
  { name: 'Hotel de Russie', location: 'Rome', country: 'Europe', category: 'Boutique', price_per_night: 95000, amenities: ['Garden', 'Spa', 'Historic'], image_url: 'https://images.unsplash.com/photo-1551882547-ff40c0d588fa?w=800' },
  { name: 'Burj Al Arab', location: 'Dubai', country: 'Dubai', category: '7 Star', price_per_night: 150000, amenities: ['Private Beach', 'Helipad', 'Butler Service'], image_url: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800' },
  { name: 'Atlantis The Palm', location: 'Dubai', country: 'Dubai', category: 'Resort', price_per_night: 85000, amenities: ['Water Park', 'Aquarium', 'Beachfront'], image_url: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800' },
  { name: 'Four Seasons Resort Bali at Sayan', location: 'Ubud', country: 'Bali', category: 'Resort', price_per_night: 75000, amenities: ['Jungle View', 'Spa', 'Yoga'], image_url: 'https://images.unsplash.com/photo-1535827841776-24afc1e255ac?w=800' },
  { name: 'The St. Regis Bali Resort', location: 'Nusa Dua', country: 'Bali', category: 'Luxury', price_per_night: 90000, amenities: ['Private Beach', 'Golf', 'Butler'], image_url: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=800' },
  { name: 'Mandarin Oriental, Bangkok', location: 'Bangkok', country: 'Thailand', category: 'Luxury', price_per_night: 60000, amenities: ['River View', 'Spa', 'Historic'], image_url: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=800' },
  { name: 'Soneva Kiri', location: 'Koh Kood', country: 'Thailand', category: 'Eco Resort', price_per_night: 110000, amenities: ['Private Pool', 'Eco-friendly', 'Beach'], image_url: 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800' },
  { name: 'Six Senses Ninh Van Bay', location: 'Nha Trang', country: 'Vietnam', category: 'Resort', price_per_night: 70000, amenities: ['Ocean View', 'Spa', 'Secluded'], image_url: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800' },
  { name: 'Sofitel Legend Metropole', location: 'Hanoi', country: 'Vietnam', category: 'Historic', price_per_night: 45000, amenities: ['Historic', 'Central Location', 'Pool'], image_url: 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800' },
  { name: 'Marina Bay Sands', location: 'Singapore', country: 'Singapore', category: 'Luxury', price_per_night: 80000, amenities: ['Infinity Pool', 'Casino', 'City View'], image_url: 'https://images.unsplash.com/photo-1565507158751-610ee9f55e09?w=800' },
  { name: 'Raffles Singapore', location: 'Singapore', country: 'Singapore', category: 'Historic', price_per_night: 95000, amenities: ['Historic', 'Butler', 'Spa'], image_url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800' },
  { name: 'The Dolder Grand', location: 'Zurich', country: 'Switzerland', category: 'Luxury', price_per_night: 130000, amenities: ['Alps View', 'Spa', 'Fine Dining'], image_url: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800' },
  { name: 'Badrutt\'s Palace Hotel', location: 'St. Moritz', country: 'Switzerland', category: 'Resort', price_per_night: 150000, amenities: ['Lake View', 'Skiing', 'Spa'], image_url: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800' },
  { name: 'Soneva Fushi', location: 'Baa Atoll', country: 'Maldives', category: 'Eco Resort', price_per_night: 200000, amenities: ['Private Villa', 'Scuba Diving', 'Beach'], image_url: 'https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=800' },
  { name: 'Cheval Blanc Randheli', location: 'Noonu Atoll', country: 'Maldives', category: 'Luxury', price_per_night: 250000, amenities: ['Overwater Villa', 'Butler', 'Spa'], image_url: 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800' },
  { name: 'The Plaza', location: 'New York', country: 'New York', category: 'Iconic', price_per_night: 110000, amenities: ['Central Park View', 'Historic', 'Spa'], image_url: 'https://images.unsplash.com/photo-1541335969501-c85288599be5?w=800' },
  { name: '1 Hotel Brooklyn Bridge', location: 'New York', country: 'New York', category: 'Eco Luxury', price_per_night: 85000, amenities: ['Skyline View', 'Rooftop Pool', 'Eco-friendly'], image_url: 'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=800' }
].map(h => ({ ...h, agency_id: DEFAULT_AGENCY_ID }));

const ACTIVITIES = [
  { name: 'Mt. Fuji Day Tour', location: 'Tokyo', type: 'Tour', duration_hours: 8, price: 15000, image_url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800' },
  { name: 'Sushi Making Masterclass', location: 'Tokyo', type: 'Experience', duration_hours: 4, price: 8500, image_url: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800' },
  { name: 'Kyoto Temples Walk', location: 'Kyoto', type: 'Tour', duration_hours: 4, price: 6000, image_url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800' },
  { name: 'Geisha District Evening', location: 'Kyoto', type: 'Experience', duration_hours: 3, price: 12000, image_url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800' },
  { name: 'Louvre Museum VIP Tour', location: 'Paris', type: 'Tour', duration_hours: 4, price: 11000, image_url: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800' },
  { name: 'Seine River Dinner Cruise', location: 'Paris', type: 'Experience', duration_hours: 3, price: 18000, image_url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800' },
  { name: 'Colosseum Underground', location: 'Rome', type: 'Tour', duration_hours: 3, price: 9500, image_url: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800' },
  { name: 'Vatican Early Access', location: 'Rome', type: 'Tour', duration_hours: 3, price: 14000, image_url: 'https://images.unsplash.com/photo-1531572753322-ad063cecc140?w=800' },
  { name: 'Desert Safari & BBQ', location: 'Dubai', type: 'Adventure', duration_hours: 6, price: 8000, image_url: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?w=800' },
  { name: 'Burj Khalifa At The Top', location: 'Dubai', type: 'Tour', duration_hours: 2, price: 6500, image_url: 'https://images.unsplash.com/photo-1582672060624-cb86b86e8206?w=800' },
  { name: 'Helicopter City Tour', location: 'Dubai', type: 'Experience', duration_hours: 1, price: 25000, image_url: 'https://images.unsplash.com/photo-1512632578888-169bbbc64f33?w=800' },
  { name: 'Marina Dhow Cruise', location: 'Dubai', type: 'Tour', duration_hours: 3, price: 5000, image_url: 'https://images.unsplash.com/photo-1526495124232-a04e1849168c?w=800' },
  { name: 'Ubud Monkey Forest Walk', location: 'Bali', type: 'Tour', duration_hours: 4, price: 3500, image_url: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800' },
  { name: 'Mount Batur Sunrise Trek', location: 'Bali', type: 'Adventure', duration_hours: 5, price: 7500, image_url: 'https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=800' },
  { name: 'Nusa Penida Island Tour', location: 'Bali', type: 'Tour', duration_hours: 8, price: 9000, image_url: 'https://images.unsplash.com/photo-1577717903315-1691ae25ab3f?w=800' },
  { name: 'Balinese Cooking Class', location: 'Bali', type: 'Experience', duration_hours: 4, price: 4500, image_url: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800' },
  { name: 'Grand Palace & Temples', location: 'Bangkok', type: 'Tour', duration_hours: 4, price: 4000, image_url: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=800' },
  { name: 'Floating Market Tour', location: 'Bangkok', type: 'Tour', duration_hours: 4, price: 5500, image_url: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=800' },
  { name: 'Phi Phi Island Speedboat', location: 'Phuket', type: 'Tour', duration_hours: 8, price: 8500, image_url: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=800' },
  { name: 'Elephant Sanctuary Visit', location: 'Chiang Mai', type: 'Experience', duration_hours: 8, price: 11000, image_url: 'https://images.unsplash.com/photo-1588614959060-4d144f28b207?w=800' },
  { name: 'Halong Bay Day Cruise', location: 'Vietnam', type: 'Tour', duration_hours: 8, price: 9500, image_url: 'https://images.unsplash.com/photo-1528127269322-539801943592?w=800' },
  { name: 'Hoi An Lantern Making', location: 'Vietnam', type: 'Experience', duration_hours: 3, price: 3000, image_url: 'https://images.unsplash.com/photo-1560938661-2e63964ff059?w=800' },
  { name: 'Cu Chi Tunnels Tour', location: 'Vietnam', type: 'Tour', duration_hours: 4, price: 4500, image_url: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800' },
  { name: 'Mekong Delta Discovery', location: 'Vietnam', type: 'Tour', duration_hours: 8, price: 7000, image_url: 'https://images.unsplash.com/photo-1504221507732-5246c045949b?w=800' },
  { name: 'Gardens by the Bay', location: 'Singapore', type: 'Tour', duration_hours: 4, price: 3500, image_url: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800' },
  { name: 'Universal Studios Pass', location: 'Singapore', type: 'Experience', duration_hours: 8, price: 8500, image_url: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?w=800' },
  { name: 'Night Safari Experience', location: 'Singapore', type: 'Tour', duration_hours: 3, price: 5000, image_url: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800' },
  { name: 'Sentosa Island Cable Car', location: 'Singapore', type: 'Experience', duration_hours: 4, price: 2500, image_url: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800' },
  { name: 'Jungfraujoch Top of Europe', location: 'Switzerland', type: 'Tour', duration_hours: 8, price: 22000, image_url: 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?w=800' },
  { name: 'Glacier Express Journey', location: 'Switzerland', type: 'Experience', duration_hours: 8, price: 18000, image_url: 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?w=800' },
  { name: 'Lake Lucerne Cruise', location: 'Switzerland', type: 'Tour', duration_hours: 4, price: 8000, image_url: 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?w=800' },
  { name: 'Swiss Chocolate Tasting', location: 'Switzerland', type: 'Experience', duration_hours: 3, price: 5500, image_url: 'https://images.unsplash.com/photo-1548843282-37841bb2fcd3?w=800' },
  { name: 'Sunset Dolphin Cruise', location: 'Maldives', type: 'Tour', duration_hours: 3, price: 9500, image_url: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=800' },
  { name: 'Snorkeling with Manta Rays', location: 'Maldives', type: 'Adventure', duration_hours: 4, price: 12000, image_url: 'https://images.unsplash.com/photo-1582967788606-a171c1080cb0?w=800' },
  { name: 'Private Sandbank Picnic', location: 'Maldives', type: 'Experience', duration_hours: 4, price: 18000, image_url: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=800' },
  { name: 'Submarine Tour', location: 'Maldives', type: 'Tour', duration_hours: 3, price: 15000, image_url: 'https://images.unsplash.com/photo-1582967788606-a171c1080cb0?w=800' },
  { name: 'Statue of Liberty Cruise', location: 'New York', type: 'Tour', duration_hours: 4, price: 4500, image_url: 'https://images.unsplash.com/photo-1496442226666-8d4d0e2815cb?w=800' },
  { name: 'Broadway Show Ticket', location: 'New York', type: 'Experience', duration_hours: 4, price: 12000, image_url: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?w=800' },
  { name: 'Central Park Bike Tour', location: 'New York', type: 'Tour', duration_hours: 4, price: 5500, image_url: 'https://images.unsplash.com/photo-1522083111301-a4faed5576a8?w=800' },
  { name: 'Top of the Rock Observation', location: 'New York', type: 'Experience', duration_hours: 3, price: 4800, image_url: 'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=800' }
].map(a => ({ ...a, agency_id: DEFAULT_AGENCY_ID }));

const FLIGHTS = [
  { airline: 'Emirates', flight_no: 'EK 501', origin: 'BOM', destination: 'DXB', duration: '3h 30m', cost: 18000, class: 'Economy' },
  { airline: 'Singapore Airlines', flight_no: 'SQ 421', origin: 'DEL', destination: 'SIN', duration: '5h 45m', cost: 22000, class: 'Economy' },
  { airline: 'Japan Airlines', flight_no: 'JL 030', origin: 'DEL', destination: 'NRT', duration: '8h 00m', cost: 45000, class: 'Economy' },
  { airline: 'Air France', flight_no: 'AF 225', origin: 'BOM', destination: 'CDG', duration: '9h 15m', cost: 38000, class: 'Economy' },
  { airline: 'Swiss International', flight_no: 'LX 147', origin: 'DEL', destination: 'ZRH', duration: '8h 30m', cost: 41000, class: 'Economy' },
  { airline: 'Thai Airways', flight_no: 'TG 316', origin: 'CCU', destination: 'BKK', duration: '2h 30m', cost: 15000, class: 'Economy' },
  { airline: 'VietJet Air', flight_no: 'VJ 896', origin: 'DEL', destination: 'SGN', duration: '4h 50m', cost: 14500, class: 'Economy' },
  { airline: 'Maldivian', flight_no: 'Q2 710', origin: 'TRV', destination: 'MLE', duration: '1h 30m', cost: 16000, class: 'Economy' },
  { airline: 'United Airlines', flight_no: 'UA 83', origin: 'DEL', destination: 'EWR', duration: '15h 20m', cost: 75000, class: 'Economy' },
  { airline: 'Garuda Indonesia', flight_no: 'GA 815', origin: 'BOM', destination: 'DPS', duration: '9h 40m', cost: 28000, class: 'Economy' }
].map(f => ({ ...f, agency_id: DEFAULT_AGENCY_ID }));

const ITINERARIES = [
  {
    name: 'Essence of Japan', destination: 'Japan', description: 'Experience the perfect blend of ancient traditions and ultra-modern cityscapes across Tokyo and Kyoto.', duration: 7, cover_image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800',
    blocks: [
      { day_number: 1, title: 'Arrival in Tokyo', description: 'Arrive at Narita. Transfer to hotel and evening at leisure in Shinjuku.', block_type: 'day' },
      { day_number: 2, title: 'Tokyo Exploration', description: 'Full day exploring Meiji Shrine, Shibuya Crossing, and Senso-ji Temple.', block_type: 'day' },
      { day_number: 3, title: 'Mt. Fuji Day Trip', description: 'Take the bullet train to Hakone for breathtaking views of Mt. Fuji.', block_type: 'day' },
      { day_number: 4, title: 'Bullet Train to Kyoto', description: 'Travel to Kyoto. Afternoon visit to the Golden Pavilion (Kinkaku-ji).', block_type: 'day' },
      { day_number: 5, title: 'Kyoto Traditions', description: 'Fushimi Inari Shrine in the morning, followed by a tea ceremony in Gion.', block_type: 'day' },
      { day_number: 6, title: 'Nara Deer Park', description: 'Day trip to Nara to meet the friendly deer and see the Giant Buddha.', block_type: 'day' },
      { day_number: 7, title: 'Departure', description: 'Transfer to Kansai International Airport for departure.', block_type: 'day' }
    ]
  },
  {
    name: 'Classic Europe', destination: 'Europe', description: 'A romantic journey through the iconic capitals of Paris and Rome.', duration: 8, cover_image: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800',
    blocks: [
      { day_number: 1, title: 'Bonjour Paris', description: 'Arrive in Paris. Check-in and evening walk along the Seine.', block_type: 'day' },
      { day_number: 2, title: 'Eiffel & Louvre', description: 'Morning visit to the Louvre, afternoon at the Eiffel Tower.', block_type: 'day' },
      { day_number: 3, title: 'Versailles Palace', description: 'Day trip to the opulent Palace of Versailles.', block_type: 'day' },
      { day_number: 4, title: 'Flight to Rome', description: 'Fly to Rome. Afternoon visit to the Trevi Fountain and Spanish Steps.', block_type: 'day' },
      { day_number: 5, title: 'Ancient Rome', description: 'Guided tour of the Colosseum and Roman Forum.', block_type: 'day' },
      { day_number: 6, title: 'Vatican City', description: 'Early access to the Vatican Museums and Sistine Chapel.', block_type: 'day' },
      { day_number: 7, title: 'Tuscan Day Trip', description: 'Day trip to Florence to see Michelangelo\'s David.', block_type: 'day' },
      { day_number: 8, title: 'Arrivederci', description: 'Departure from Rome.', block_type: 'day' }
    ]
  },
  {
    name: 'Dubai Luxury Escape', destination: 'Dubai', description: 'Experience the glitz, glamour, and desert thrills of Dubai.', duration: 5, cover_image: 'https://images.unsplash.com/photo-1512632578888-169bbbc64f33?w=800',
    blocks: [
      { day_number: 1, title: 'Welcome to Dubai', description: 'Arrive and check in to your luxury beach resort.', block_type: 'day' },
      { day_number: 2, title: 'City of Gold', description: 'Visit the Dubai Mall and go to the top of the Burj Khalifa.', block_type: 'day' },
      { day_number: 3, title: 'Desert Safari', description: 'Afternoon dune bashing followed by a Bedouin-style BBQ dinner.', block_type: 'day' },
      { day_number: 4, title: 'Marina & Cruise', description: 'Relax at the beach, then enjoy a Dhow Cruise dinner in the Marina.', block_type: 'day' },
      { day_number: 5, title: 'Departure', description: 'Last minute shopping and transfer to DXB airport.', block_type: 'day' }
    ]
  },
  {
    name: 'Bali Island Paradise', destination: 'Bali', description: 'Discover the spiritual heart and stunning beaches of the Island of the Gods.', duration: 7, cover_image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800',
    blocks: [
      { day_number: 1, title: 'Arrival in Ubud', description: 'Transfer to Ubud and relax in your jungle villa.', block_type: 'day' },
      { day_number: 2, title: 'Ubud Culture', description: 'Visit the Monkey Forest and Tegalalang Rice Terraces.', block_type: 'day' },
      { day_number: 3, title: 'Temple Tour', description: 'Explore Tirta Empul and the majestic Ulun Danu Beratan.', block_type: 'day' },
      { day_number: 4, title: 'Move to Seminyak', description: 'Transfer to the coast. Sunset at Tanah Lot temple.', block_type: 'day' },
      { day_number: 5, title: 'Beach Club Day', description: 'Relax at a luxury beach club in Seminyak or Canggu.', block_type: 'day' },
      { day_number: 6, title: 'Nusa Penida', description: 'Day trip to Nusa Penida to see Kelingking Beach.', block_type: 'day' },
      { day_number: 7, title: 'Departure', description: 'Transfer to Denpasar airport.', block_type: 'day' }
    ]
  },
  {
    name: 'Amazing Thailand', destination: 'Thailand', description: 'From the bustling streets of Bangkok to the serene islands of the south.', duration: 8, cover_image: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=800',
    blocks: [
      { day_number: 1, title: 'Arrival in Bangkok', description: 'Check-in and evening street food tour.', block_type: 'day' },
      { day_number: 2, title: 'Grand Palace', description: 'Visit the Grand Palace and Wat Pho.', block_type: 'day' },
      { day_number: 3, title: 'Floating Market', description: 'Early morning trip to Damnoen Saduak floating market.', block_type: 'day' },
      { day_number: 4, title: 'Fly to Phuket', description: 'Transfer to the islands and relax on the beach.', block_type: 'day' },
      { day_number: 5, title: 'Phi Phi Islands', description: 'Full day speedboat tour of the Phi Phi Islands.', block_type: 'day' },
      { day_number: 6, title: 'Elephant Sanctuary', description: 'Ethical visit to an elephant sanctuary.', block_type: 'day' },
      { day_number: 7, title: 'Phang Nga Bay', description: 'Cruise through Phang Nga Bay and see James Bond Island.', block_type: 'day' },
      { day_number: 8, title: 'Departure', description: 'Transfer to Phuket airport.', block_type: 'day' }
    ]
  },
  {
    name: 'Vietnam Discovery', destination: 'Vietnam', description: 'Journey from the historic capital of Hanoi to the dynamic streets of Saigon.', duration: 8, cover_image: 'https://images.unsplash.com/photo-1528127269322-539801943592?w=800',
    blocks: [
      { day_number: 1, title: 'Hanoi Arrival', description: 'Explore the Old Quarter and enjoy a water puppet show.', block_type: 'day' },
      { day_number: 2, title: 'Halong Bay Cruise', description: 'Overnight luxury cruise through the limestone karsts of Halong Bay.', block_type: 'day' },
      { day_number: 3, title: 'Return & Fly to Hoi An', description: 'Disembark cruise and fly to Da Nang/Hoi An.', block_type: 'day' },
      { day_number: 4, title: 'Hoi An Ancient Town', description: 'Walking tour and lantern making class.', block_type: 'day' },
      { day_number: 5, title: 'Ba Na Hills', description: 'Day trip to the Golden Bridge held by giant stone hands.', block_type: 'day' },
      { day_number: 6, title: 'Fly to Ho Chi Minh City', description: 'Fly south and take a Vespa food tour in the evening.', block_type: 'day' },
      { day_number: 7, title: 'Cu Chi Tunnels & Mekong', description: 'Explore the historic tunnels and cruise the Mekong Delta.', block_type: 'day' },
      { day_number: 8, title: 'Departure', description: 'Transfer to SGN airport.', block_type: 'day' }
    ]
  },
  {
    name: 'Singapore City Break', destination: 'Singapore', description: 'A quick getaway to experience the futuristic marvels of Singapore.', duration: 4, cover_image: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800',
    blocks: [
      { day_number: 1, title: 'Arrival & Marina Bay', description: 'Check-in and evening at Gardens by the Bay.', block_type: 'day' },
      { day_number: 2, title: 'Sentosa Island', description: 'Full day of fun at Universal Studios and the beach.', block_type: 'day' },
      { day_number: 3, title: 'Culture & Safari', description: 'Explore Chinatown and Little India, followed by the Night Safari.', block_type: 'day' },
      { day_number: 4, title: 'Departure', description: 'Visit the Jewel at Changi Airport before flying home.', block_type: 'day' }
    ]
  },
  {
    name: 'Swiss Alps Adventure', destination: 'Switzerland', description: 'Breathtaking alpine scenery, scenic trains, and pristine lakes.', duration: 7, cover_image: 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?w=800',
    blocks: [
      { day_number: 1, title: 'Zurich Arrival', description: 'Arrive in Zurich and explore the Old Town.', block_type: 'day' },
      { day_number: 2, title: 'Lucerne', description: 'Train to Lucerne, Chapel Bridge, and Lake cruise.', block_type: 'day' },
      { day_number: 3, title: 'Mt. Titlis', description: 'Ascend Mt. Titlis on the rotating cable car.', block_type: 'day' },
      { day_number: 4, title: 'Interlaken', description: 'Travel to Interlaken, the adventure capital.', block_type: 'day' },
      { day_number: 5, title: 'Jungfraujoch', description: 'Full day trip to the Top of Europe.', block_type: 'day' },
      { day_number: 6, title: 'Glacier Express', description: 'Scenic train journey to Zermatt.', block_type: 'day' },
      { day_number: 7, title: 'Departure', description: 'View the Matterhorn and transfer to the airport.', block_type: 'day' }
    ]
  },
  {
    name: 'Maldives Romantic Getaway', destination: 'Maldives', description: 'The ultimate overwater luxury experience in the Indian Ocean.', duration: 5, cover_image: 'https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=800',
    blocks: [
      { day_number: 1, title: 'Seaplane Arrival', description: 'Arrive in Male and take a scenic seaplane to your resort.', block_type: 'day' },
      { day_number: 2, title: 'Snorkeling', description: 'Morning snorkeling excursion with sea turtles.', block_type: 'day' },
      { day_number: 3, title: 'Spa & Sunset Cruise', description: 'Couples massage followed by a sunset dolphin cruise.', block_type: 'day' },
      { day_number: 4, title: 'Private Sandbank', description: 'Romantic private picnic on a secluded sandbank.', block_type: 'day' },
      { day_number: 5, title: 'Departure', description: 'Seaplane back to Male for departure.', block_type: 'day' }
    ]
  },
  {
    name: 'New York City Highlights', destination: 'New York', description: 'Experience the energy of the Big Apple in a few action-packed days.', duration: 5, cover_image: 'https://images.unsplash.com/photo-1496442226666-8d4d0e2815cb?w=800',
    blocks: [
      { day_number: 1, title: 'Times Square', description: 'Arrive and soak in the bright lights of Times Square.', block_type: 'day' },
      { day_number: 2, title: 'Statue & Wall Street', description: 'Statue of Liberty cruise and Financial District walking tour.', block_type: 'day' },
      { day_number: 3, title: 'Central Park & Museums', description: 'Bike tour of Central Park and visit to the MET.', block_type: 'day' },
      { day_number: 4, title: 'Top of the Rock & Broadway', description: 'Sunset city views and an evening Broadway show.', block_type: 'day' },
      { day_number: 5, title: 'Departure', description: 'Shopping on 5th Avenue before heading to JFK.', block_type: 'day' }
    ]
  }
].map(i => ({ ...i, agency_id: DEFAULT_AGENCY_ID }));


async function seed() {
  console.log('Starting seed process...');

  console.log('Clearing existing data...');
  await supabase.from('proposal_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('proposals').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('itinerary_blocks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('itineraries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('hotels').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('activities').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('flights').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('Inserting Hotels...');
  const { error: hErr } = await supabase.from('hotels').insert(HOTELS);
  if (hErr) console.error('Error inserting hotels:', hErr);

  console.log('Inserting Activities...');
  const { error: aErr } = await supabase.from('activities').insert(ACTIVITIES);
  if (aErr) console.error('Error inserting activities:', aErr);

  console.log('Inserting Flights...');
  const { error: fErr } = await supabase.from('flights').insert(FLIGHTS);
  if (fErr) console.error('Error inserting flights:', fErr);

  console.log('Inserting Itineraries...');
  for (const it of ITINERARIES) {
    const { blocks, ...itData } = it;
    const { data: insertedIt, error: iErr } = await supabase.from('itineraries').insert(itData).select('id').single();
    if (iErr) {
      console.error('Error inserting itinerary:', it.name, iErr);
      continue;
    }
    const blocksWithId = blocks.map(b => ({ ...b, itinerary_id: insertedIt.id }));
    const { error: bErr } = await supabase.from('itinerary_blocks').insert(blocksWithId);
    if (bErr) console.error('Error inserting blocks for', it.name, bErr);
  }

  console.log('Seeding complete!');
  process.exit(0);
}

seed();
