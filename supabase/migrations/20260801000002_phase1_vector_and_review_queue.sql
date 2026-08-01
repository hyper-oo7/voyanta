-- Migration: 20260801000002_phase1_vector_and_review_queue.sql
-- Description: Phase 1 Tables — Block Vector Embeddings & Attraction Manual Review Queue

CREATE TABLE IF NOT EXISTS public.block_embeddings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    block_id TEXT NOT NULL REFERENCES public.itinerary_blocks(block_id) ON DELETE CASCADE,
    agency_id TEXT DEFAULT 'global',
    destination TEXT NOT NULL,
    content_text TEXT NOT NULL,
    embedding_vector FLOAT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.attraction_review_queue (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    raw_name TEXT NOT NULL,
    suggested_canonical_id TEXT NOT NULL,
    city TEXT NOT NULL,
    similarity_score NUMERIC(4,3) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_block_embeddings_block ON public.block_embeddings(block_id);
CREATE INDEX IF NOT EXISTS idx_block_embeddings_destination ON public.block_embeddings(destination);
CREATE INDEX IF NOT EXISTS idx_attraction_review_queue_status ON public.attraction_review_queue(status);

ALTER TABLE public.block_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attraction_review_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public/Tenant Read Block Embeddings" ON public.block_embeddings
    FOR SELECT USING (agency_id = 'global' OR agency_id = current_setting('app.current_agency_id', true));

CREATE POLICY "Public Read Attraction Review Queue" ON public.attraction_review_queue
    FOR SELECT USING (true);
