-- Migration: 20260723000002_india_destination_knowledge_base.sql
-- Purpose: Create normalized tables for India Destination Knowledge Base, sub-destinations, activities, and global stock image catalog.

-- 1. DESTINATIONS TABLE
CREATE TABLE IF NOT EXISTS public.destinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    state_or_ut TEXT NOT NULL,
    region TEXT NOT NULL, -- e.g. 'North East', 'North India', 'South India', 'West India', 'Central India', 'East India', 'Islands'
    hero_image_url TEXT,
    overview TEXT,
    best_months INT[] DEFAULT '{1,2,3,4,5,6,7,8,9,10,11,12}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. SUB-DESTINATIONS TABLE
CREATE TABLE IF NOT EXISTS public.sub_destinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    destination_id UUID NOT NULL REFERENCES public.destinations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'town', -- 'hill_station', 'town', 'attraction', 'viewpoint', 'wildlife_park', 'beach', 'temple', 'valley'
    hero_image_url TEXT,
    short_description TEXT,
    best_time_to_visit TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_sub_dest_per_dest UNIQUE (destination_id, name)
);

-- 3. DESTINATION ACTIVITIES TABLE
CREATE TABLE IF NOT EXISTS public.destination_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sub_destination_id UUID NOT NULL REFERENCES public.sub_destinations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'Sightseeing', 'Adventure', 'Nature', 'Wildlife', 'Cultural', 'Spiritual', 'Food', 'Shopping', 'Water Sports', 'Trekking'
    estimated_duration_hours NUMERIC DEFAULT 2.0,
    ideal_time_of_day TEXT DEFAULT 'Morning', -- 'Morning', 'Afternoon', 'Sunset', 'Evening', 'Full Day'
    ideal_months INT[] DEFAULT '{1,2,3,4,5,6,7,8,9,10,11,12}',
    description TEXT,
    image_url TEXT,
    image_source TEXT DEFAULT 'stock', -- 'stock' or 'user'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES FOR FAST QUERYING
CREATE INDEX IF NOT EXISTS idx_destinations_search ON public.destinations (name, state_or_ut, region);
CREATE INDEX IF NOT EXISTS idx_sub_destinations_dest_id ON public.sub_destinations (destination_id);
CREATE INDEX IF NOT EXISTS idx_sub_destinations_name ON public.sub_destinations (name);
CREATE INDEX IF NOT EXISTS idx_destination_activities_sub_id ON public.destination_activities (sub_destination_id);
CREATE INDEX IF NOT EXISTS idx_destination_activities_category ON public.destination_activities (category);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destination_activities ENABLE ROW LEVEL SECURITY;

-- POLICIES (Allow authenticated users and service roles to read and update stock images)
DROP POLICY IF EXISTS "destinations_read_all" ON public.destinations;
CREATE POLICY "destinations_read_all" ON public.destinations FOR SELECT USING (true);
DROP POLICY IF EXISTS "destinations_write_all" ON public.destinations;
CREATE POLICY "destinations_write_all" ON public.destinations FOR ALL USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "sub_destinations_read_all" ON public.sub_destinations;
CREATE POLICY "sub_destinations_read_all" ON public.sub_destinations FOR SELECT USING (true);
DROP POLICY IF EXISTS "sub_destinations_write_all" ON public.sub_destinations;
CREATE POLICY "sub_destinations_write_all" ON public.sub_destinations FOR ALL USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "destination_activities_read_all" ON public.destination_activities;
CREATE POLICY "destination_activities_read_all" ON public.destination_activities FOR SELECT USING (true);
DROP POLICY IF EXISTS "destination_activities_write_all" ON public.destination_activities;
CREATE POLICY "destination_activities_write_all" ON public.destination_activities FOR ALL USING (auth.role() IN ('authenticated', 'service_role'));

GRANT SELECT, INSERT, UPDATE ON public.destinations TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.sub_destinations TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.destination_activities TO authenticated, service_role;

-- 4. SEED DATA FOR MEGHALAYA & MAJOR INDIAN STATES/UTS

-- MEGHALAYA
INSERT INTO public.destinations (id, name, state_or_ut, region, overview, best_months, hero_image_url) VALUES
('d1111111-1111-1111-1111-111111111111', 'Meghalaya', 'Meghalaya', 'North East', 'Abode of Clouds, famous for living root bridges, pristine crystal rivers, dramatic waterfalls, and misty pine valleys.', '{10,11,12,1,2,3,4,5}', 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=1200&q=80')
ON CONFLICT (name) DO UPDATE SET overview = EXCLUDED.overview, hero_image_url = EXCLUDED.hero_image_url;

-- Sub-destinations for Meghalaya
INSERT INTO public.sub_destinations (id, destination_id, name, type, short_description, best_time_to_visit, hero_image_url) VALUES
('s1111111-1111-1111-1111-111111111101', 'd1111111-1111-1111-1111-111111111111', 'Shillong', 'town', 'Scotland of the East, known for Ward’s Lake, Elephant Falls, and vibrant cafe culture.', 'Oct - May', 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=80'),
('s1111111-1111-1111-1111-111111111102', 'd1111111-1111-1111-1111-111111111111', 'Cherrapunji', 'hill_station', 'Sohra, famous for Nohkalikai Waterfalls, Mawsmai Cave, and Seven Sisters Falls.', 'Oct - May', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80'),
('s1111111-1111-1111-1111-111111111103', 'd1111111-1111-1111-1111-111111111111', 'Dawki', 'town', 'Border town famed for the crystal-clear Umngot River where boats appear to float in air.', 'Nov - April', 'https://images.unsplash.com/photo-1518684079-3c830dcef090?w=800&q=80'),
('s1111111-1111-1111-1111-111111111104', 'd1111111-1111-1111-1111-111111111111', 'Mawlynnong', 'attraction', 'Cleanest village in Asia with bamboo sky walks and living root bridges.', 'Oct - April', 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80'),
('s1111111-1111-1111-1111-111111111105', 'd1111111-1111-1111-1111-111111111111', 'Nongriat', 'attraction', 'Home to the iconic Double Decker Living Root Bridge tucked deep in tropical rainforest.', 'Oct - May', 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80'),
('s1111111-1111-1111-1111-111111111106', 'd1111111-1111-1111-1111-111111111111', 'Mawsynram', 'village', 'Wettest place on earth with pristine waterfalls and Krem Puri caves.', 'Sept - May', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80'),
('s1111111-1111-1111-1111-111111111107', 'd1111111-1111-1111-1111-111111111111', 'Jowai', 'town', 'Capital of West Jaintia Hills, famous for Krang Suri Waterfalls and Nartiang Monoliths.', 'Oct - May', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80'),
('s1111111-1111-1111-1111-111111111108', 'd1111111-1111-1111-1111-111111111111', 'Garo Hills', 'wildlife_park', 'Biodiversity hotspot home to Nokrek National Park and Balpakram National Park.', 'Nov - March', 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=800&q=80')
ON CONFLICT (destination_id, name) DO UPDATE SET short_description = EXCLUDED.short_description, hero_image_url = EXCLUDED.hero_image_url;

-- Activities for Meghalaya Sub-destinations
INSERT INTO public.destination_activities (sub_destination_id, name, category, estimated_duration_hours, ideal_time_of_day, ideal_months, description, image_url) VALUES
('s1111111-1111-1111-1111-111111111101', 'Elephant Falls & Shillong Peak Tour', 'Sightseeing', 3.5, 'Morning', '{10,11,12,1,2,3,4,5}', 'Explore three-tiered Elephant Falls and enjoy panoramic 360-degree views of Shillong valley.', 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&q=80'),
('s1111111-1111-1111-1111-111111111101', 'Shillong Cafe & Heritage Walk', 'Food', 2.5, 'Evening', '{1,2,3,4,5,6,7,8,9,10,11,12}', 'Walk through Laitumkhrah and Police Bazar cafes sampling local Khasi cuisine and live music.', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80'),

('s1111111-1111-1111-1111-111111111102', 'Nohkalikai Waterfall Viewpoint Visit', 'Sightseeing', 2.0, 'Morning', '{10,11,12,1,2,3,4,5}', 'Witness India’s tallest plunge waterfall cascading into an emerald green pool.', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80'),
('s1111111-1111-1111-1111-111111111102', 'Mawsmai Limestone Cave Caving Expedition', 'Adventure', 1.5, 'Afternoon', '{10,11,12,1,2,3,4,5}', 'Crawl through illuminated natural limestone caves filled with ancient fossils and stalactites.', 'https://images.unsplash.com/photo-1503220317375-aaad61436b1b?w=800&q=80'),

('s1111111-1111-1111-1111-111111111103', 'Umngot River Crystal Boat Ride', 'Water Sports', 2.0, 'Morning', '{11,12,1,2,3,4}', 'Experience floating on glass-clear waters of the Umngot River bordering Bangladesh.', 'https://images.unsplash.com/photo-1518684079-3c830dcef090?w=800&q=80'),
('s1111111-1111-1111-1111-111111111103', 'Jaflong Bangladesh Border View & Suspension Bridge', 'Sightseeing', 1.5, 'Sunset', '{10,11,12,1,2,3,4,5}', 'Walk across the Dawki suspension bridge and view Bangladesh stone collection banks.', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80'),

('s1111111-1111-1111-1111-111111111104', 'Asia’s Cleanest Village & Skywalk Tour', 'Cultural', 2.0, 'Morning', '{10,11,12,1,2,3,4,5}', 'Stroll flower-lined cobblestone pathways in Mawlynnong and climb the bamboo Sky View tower.', 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80'),

('s1111111-1111-1111-1111-111111111105', 'Double Decker Living Root Bridge Trek', 'Trekking', 6.0, 'Full Day', '{10,11,12,1,2,3,4,5}', 'Descend 3,000 steps through lush jungle to the famous 250-year-old bio-engineered double decker root bridge.', 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80'),
('s1111111-1111-1111-1111-111111111105', 'Rainbow Falls Natural Pool Swim', 'Nature', 3.0, 'Afternoon', '{10,11,12,1,2,3,4,5}', 'Trek further past Nongriat to swim in the turquoise waters of Rainbow Falls.', 'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=800&q=80'),

('s1111111-1111-1111-1111-111111111107', 'Krang Suri Waterfalls Swimming & Cliff Jump', 'Adventure', 4.0, 'Afternoon', '{10,11,12,1,2,3,4,5}', 'Swim behind the curtain of deep blue Krang Suri waterfalls in West Jaintia Hills.', 'https://images.unsplash.com/photo-1548574505-5e239809ee19?w=800&q=80');


-- SEED ADDITIONAL MAJOR INDIAN DESTINATIONS & SUB-DESTINATIONS
INSERT INTO public.destinations (name, state_or_ut, region, overview, best_months) VALUES
('Kerala', 'Kerala', 'South India', 'God’s Own Country, famed for Alleppey backwaters, Munnar tea gardens, and Kovalam beaches.', '{9,10,11,12,1,2,3}'),
('Rajasthan', 'Rajasthan', 'West India', 'Land of Maharajas, royal palaces, Jaisalmer sand dunes, and vibrant forts.', '{10,11,12,1,2,3}'),
('Goa', 'Goa', 'West India', 'Beach paradise of India featuring historic Portuguese churches, night markets, and water sports.', '{10,11,12,1,2,3,4}'),
('Ladakh', 'Ladakh', 'North India', 'High-altitude cold desert with Pangong Tso lake, Buddhist monasteries, and dramatic mountain passes.', '{5,6,7,8,9}'),
('Himachal Pradesh', 'Himachal Pradesh', 'North India', 'Pine valleys, snow-capped Himalayas, Manali solang valley, and Spiti cold desert.', '{3,4,5,6,9,10,11,12}'),
('Uttarakhand', 'Uttarakhand', 'North India', 'Yoga capital Rishikesh, Mussoorie hill views, Nainital lakes, and Chardham pilgrimages.', '{3,4,5,6,9,10,11,12}'),
('Kashmir', 'Jammu & Kashmir', 'North India', 'Paradise on Earth with Dal Lake Shikara rides, Gulmarg gondolas, and Pahalgam pine forests.', '{3,4,5,6,7,8,9,10,11,12}'),
('Tamil Nadu', 'Tamil Nadu', 'South India', 'Dravidian temple architecture, Ooty tea gardens, and Mahabalipuram shore temples.', '{10,11,12,1,2,3}'),
('Karnataka', 'Karnataka', 'South India', 'Hampi UNESCO ruins, Coorg coffee plantations, and Chikmagalur mountain peaks.', '{10,11,12,1,2,3}'),
('Sikkim', 'Sikkim', 'North East', 'Kanchenjunga snow views, Gangtok monasteries, Nathula pass, and Yumthang valley.', '{3,4,5,10,11,12}'),
('Andaman & Nicobar', 'Andaman & Nicobar Islands', 'Islands', 'Pristine white sand beaches, Radhanagar beach, and coral reef scuba diving.', '{10,11,12,1,2,3,4,5}'),
('Golden Triangle', 'Delhi-Agra-Jaipur', 'North India', 'Classic India tour covering Taj Mahal Agra, Qutub Minar Delhi, and Amber Fort Jaipur.', '{10,11,12,1,2,3}')
ON CONFLICT (name) DO NOTHING;

-- Seed Sub-destinations for Kerala
INSERT INTO public.sub_destinations (destination_id, name, type, short_description)
SELECT id, 'Munnar', 'hill_station', 'Rolling tea estates and Eravikulam Nilgiri Tahr sanctuary' FROM public.destinations WHERE name = 'Kerala'
ON CONFLICT DO NOTHING;
INSERT INTO public.sub_destinations (destination_id, name, type, short_description)
SELECT id, 'Alleppey', 'town', 'Vembanad Lake luxury private houseboat cruises & backwater canals' FROM public.destinations WHERE name = 'Kerala'
ON CONFLICT DO NOTHING;
INSERT INTO public.sub_destinations (destination_id, name, type, short_description)
SELECT id, 'Wayanad', 'hill_station', 'Edakkal Caves, Chembra Peak heart lake, and spice plantations' FROM public.destinations WHERE name = 'Kerala'
ON CONFLICT DO NOTHING;
INSERT INTO public.sub_destinations (destination_id, name, type, short_description)
SELECT id, 'Thekkady', 'wildlife_park', 'Periyar Tiger Reserve boat safari and spice garden walk' FROM public.destinations WHERE name = 'Kerala'
ON CONFLICT DO NOTHING;

-- Seed Sub-destinations for Rajasthan
INSERT INTO public.sub_destinations (destination_id, name, type, short_description)
SELECT id, 'Jaipur', 'town', 'Pink City featuring Amber Fort, Hawa Mahal, and City Palace' FROM public.destinations WHERE name = 'Rajasthan'
ON CONFLICT DO NOTHING;
INSERT INTO public.sub_destinations (destination_id, name, type, short_description)
SELECT id, 'Udaipur', 'town', 'City of Lakes with romantic Lake Pichola boat cruises and Jag Mandir' FROM public.destinations WHERE name = 'Rajasthan'
ON CONFLICT DO NOTHING;
INSERT INTO public.sub_destinations (destination_id, name, type, short_description)
SELECT id, 'Jaisalmer', 'town', 'Golden City desert fort, Thar sand dunes camel safari, and luxury tents' FROM public.destinations WHERE name = 'Rajasthan'
ON CONFLICT DO NOTHING;

-- Seed Sub-destinations for Ladakh
INSERT INTO public.sub_destinations (destination_id, name, type, short_description)
SELECT id, 'Leh', 'town', 'Shanti Stupa, Leh Palace, and Thiksey Monastery' FROM public.destinations WHERE name = 'Ladakh'
ON CONFLICT DO NOTHING;
INSERT INTO public.sub_destinations (destination_id, name, type, short_description)
SELECT id, 'Nubra Valley', 'valley', 'Khardung La Pass, Hunder double-humped Bactrian camel safari' FROM public.destinations WHERE name = 'Ladakh'
ON CONFLICT DO NOTHING;
INSERT INTO public.sub_destinations (destination_id, name, type, short_description)
SELECT id, 'Pangong Tso', 'attraction', 'High-altitude turquoise salt lake changing colors across the day' FROM public.destinations WHERE name = 'Ladakh'
ON CONFLICT DO NOTHING;
