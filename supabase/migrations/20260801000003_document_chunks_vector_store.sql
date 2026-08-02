-- Migration: 20260801000003_document_chunks_vector_store.sql
-- Description: Complete vector extension, document_chunks table, and match_document_chunks RPC

CREATE EXTENSION IF NOT EXISTS vector;

-- Document chunks table with vector embeddings
CREATE TABLE IF NOT EXISTS public.document_chunks (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    agency_id TEXT NOT NULL DEFAULT 'global',
    document_id TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(768),
    metadata JSONB DEFAULT '{}'::jsonb,
    source_type TEXT DEFAULT 'pdf',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT fk_document 
        FOREIGN KEY (document_id) 
        REFERENCES public.documents(id) 
        ON DELETE CASCADE
);

-- Index for fast similarity search
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding 
ON public.document_chunks 
USING hnsw (embedding vector_cosine_ops);

-- Index for agency filtering
CREATE INDEX IF NOT EXISTS idx_document_chunks_agency 
ON public.document_chunks(agency_id);

-- Index for document filtering
CREATE INDEX IF NOT EXISTS idx_document_chunks_document 
ON public.document_chunks(document_id);

-- GIN index on metadata for JSON filtering
CREATE INDEX IF NOT EXISTS idx_document_chunks_metadata 
ON public.document_chunks USING GIN (metadata);

-- Enable RLS for Security Isolation
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Read Document Chunks" ON public.document_chunks
    FOR SELECT USING (agency_id = 'global' OR agency_id = current_setting('app.current_agency_id', true));

CREATE POLICY "Tenant Insert Document Chunks" ON public.document_chunks
    FOR INSERT WITH CHECK (agency_id = 'global' OR agency_id = current_setting('app.current_agency_id', true));

CREATE POLICY "Tenant Delete Document Chunks" ON public.document_chunks
    FOR DELETE USING (agency_id = 'global' OR agency_id = current_setting('app.current_agency_id', true));

-- RPC function for similarity search
CREATE OR REPLACE FUNCTION match_document_chunks(
    query_embedding VECTOR(768),
    match_threshold FLOAT DEFAULT 0.5,
    match_count INT DEFAULT 8,
    p_agency_id TEXT DEFAULT 'global',
    filter_destination TEXT DEFAULT NULL,
    filter_chunk_type TEXT DEFAULT NULL
)
RETURNS TABLE (
    id TEXT,
    content TEXT,
    metadata JSONB,
    source_type TEXT,
    document_id TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.id,
        dc.content,
        dc.metadata,
        dc.source_type,
        dc.document_id,
        1 - (dc.embedding <=> query_embedding) AS similarity
    FROM public.document_chunks dc
    WHERE (dc.agency_id = 'global' OR dc.agency_id = p_agency_id)
      AND (1 - (dc.embedding <=> query_embedding)) >= match_threshold
      AND (filter_destination IS NULL OR LOWER(COALESCE(dc.metadata->>'destination', '')) LIKE '%' || LOWER(filter_destination) || '%')
      AND (filter_chunk_type IS NULL OR dc.metadata->>'chunk_type' = filter_chunk_type)
    ORDER BY dc.embedding <=> query_embedding ASC
    LIMIT match_count;
END;
$$;
