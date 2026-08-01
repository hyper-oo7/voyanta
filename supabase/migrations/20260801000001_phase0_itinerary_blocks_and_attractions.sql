-- Migration: 20260801000001_phase0_itinerary_blocks_and_attractions.sql
-- Description: Core Phase 0 Schemas — Itinerary Blocks, Attraction Master, Standardized Hotels, and Standardized Transfers

CREATE TABLE IF NOT EXISTS public.itinerary_blocks (
    block_id TEXT PRIMARY KEY,
    agency_id TEXT DEFAULT 'global',
    destination TEXT NOT NULL,
    region TEXT NOT NULL,
    duration_type TEXT DEFAULT '1_day',
    theme_tags TEXT[] DEFAULT '{}',
    source_pdf TEXT,
    attractions_sequence TEXT[] DEFAULT '{}',
    slot_map JSONB DEFAULT '{"morning":[], "afternoon":[], "evening":[]}'::jsonb,
    hotel_used_in_source TEXT,
    confidence NUMERIC(4,3) DEFAULT 1.000 CHECK (confidence >= 0 AND confidence <= 1.0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.attraction_master (
    attraction_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    duration_minutes INT DEFAULT 60 CHECK (duration_minutes >= 0),
    open_time TEXT DEFAULT '08:00',
    close_time TEXT DEFAULT '17:00',
    best_slot TEXT[] DEFAULT '{"morning"}',
    entry_fee NUMERIC(10,2) DEFAULT 0.00 CHECK (entry_fee >= 0),
    lat DOUBLE PRECISION CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90)),
    lng DOUBLE PRECISION CHECK (lng IS NULL OR (lng >= -180 AND lng <= 180)),
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.standardized_hotels (
    hotel_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    agency_id TEXT DEFAULT 'global',
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    price_min NUMERIC(10,2) DEFAULT 0.00 CHECK (price_min >= 0),
    price_max NUMERIC(10,2) DEFAULT 0.00 CHECK (price_max >= 0),
    meal_plan TEXT DEFAULT 'CP',
    star TEXT DEFAULT '3_star',
    amenities TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.standardized_transfers (
    transfer_id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    agency_id TEXT DEFAULT 'global',
    location TEXT NOT NULL,
    vehicle_type TEXT NOT NULL,
    capacity INT DEFAULT 4 CHECK (capacity >= 1),
    price_min NUMERIC(10,2) DEFAULT 0.00 CHECK (price_min >= 0),
    price_max NUMERIC(10,2) DEFAULT 0.00 CHECK (price_max >= 0),
    inclusions TEXT[] DEFAULT '{"toll_tax","parking","driver_bhatta","fuel"}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance & Query Filtering Indexes
CREATE INDEX IF NOT EXISTS idx_itinerary_blocks_destination ON public.itinerary_blocks(destination);
CREATE INDEX IF NOT EXISTS idx_itinerary_blocks_agency ON public.itinerary_blocks(agency_id);
CREATE INDEX IF NOT EXISTS idx_itinerary_blocks_theme_tags ON public.itinerary_blocks USING GIN(theme_tags);

CREATE INDEX IF NOT EXISTS idx_attraction_master_city ON public.attraction_master(city);
CREATE INDEX IF NOT EXISTS idx_attraction_master_tags ON public.attraction_master USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_standardized_hotels_location ON public.standardized_hotels(location);
CREATE INDEX IF NOT EXISTS idx_standardized_hotels_agency ON public.standardized_hotels(agency_id);
CREATE INDEX IF NOT EXISTS idx_standardized_hotels_amenities ON public.standardized_hotels USING GIN(amenities);

CREATE INDEX IF NOT EXISTS idx_standardized_transfers_location ON public.standardized_transfers(location);
CREATE INDEX IF NOT EXISTS idx_standardized_transfers_agency ON public.standardized_transfers(agency_id);
CREATE INDEX IF NOT EXISTS idx_standardized_transfers_inclusions ON public.standardized_transfers USING GIN(inclusions);

-- Enable RLS for Security Isolation
ALTER TABLE public.itinerary_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attraction_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standardized_hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standardized_transfers ENABLE ROW LEVEL SECURITY;

-- Global Read / Agency Tenant Access Policies
CREATE POLICY "Public/Tenant Read Itinerary Blocks" ON public.itinerary_blocks
    FOR SELECT USING (agency_id = 'global' OR agency_id = current_setting('app.current_agency_id', true));

CREATE POLICY "Public Read Attraction Master" ON public.attraction_master
    FOR SELECT USING (true);

CREATE POLICY "Public/Tenant Read Standardized Hotels" ON public.standardized_hotels
    FOR SELECT USING (agency_id = 'global' OR agency_id = current_setting('app.current_agency_id', true));

CREATE POLICY "Public/Tenant Read Standardized Transfers" ON public.standardized_transfers
    FOR SELECT USING (agency_id = 'global' OR agency_id = current_setting('app.current_agency_id', true));
