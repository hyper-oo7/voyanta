-- Migration: 20260817000003_pgvector_hnsw_tuning_and_iterative_scan.sql
-- Description: Tune HNSW index parameters (m=24, ef_construction=100), enable iterative graph scan, and add adaptive threshold fallback

-- 1. Upgrade HNSW index for document_chunks with optimal production parameters
DROP INDEX IF EXISTS public.idx_document_chunks_embedding;
CREATE INDEX idx_document_chunks_embedding 
ON public.document_chunks 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 24, ef_construction = 100);

-- 2. Upgrade HNSW indexes for document summaries
DROP INDEX IF EXISTS public.idx_documents_summary_embedding;
CREATE INDEX idx_documents_summary_embedding
ON public.documents
USING hnsw (summary_embedding vector_cosine_ops)
WITH (m = 24, ef_construction = 100)
WHERE summary_embedding IS NOT NULL;

DROP INDEX IF EXISTS public.idx_vault_packages_summary_embedding;
CREATE INDEX idx_vault_packages_summary_embedding
ON public.vault_packages
USING hnsw (summary_embedding vector_cosine_ops)
WITH (m = 24, ef_construction = 100)
WHERE summary_embedding IS NOT NULL;

-- 3. Production-tuned match_document_chunks RPC with iterative scan & adaptive threshold
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
DECLARE
    found_count INT;
BEGIN
    -- Configure runtime HNSW traversal
    BEGIN
        SET LOCAL hnsw.iterative_scan = 'relaxed_order';
        SET LOCAL hnsw.ef_search = 80;
        SET LOCAL hnsw.max_scan_tuples = 50000;
    EXCEPTION WHEN OTHERS THEN
        -- Graceful fallback if pgvector version doesn't support specific GUC variables
        NULL;
    END;

    -- Primary query execution
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

    GET DIAGNOSTICS found_count = ROW_COUNT;

    -- Adaptive Relaxation: If no chunks found at strict threshold, retry with relaxed threshold
    IF found_count = 0 AND match_threshold > 0.25 THEN
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
          AND (1 - (dc.embedding <=> query_embedding)) >= (match_threshold * 0.65)
          AND (filter_destination IS NULL OR LOWER(COALESCE(dc.metadata->>'destination', '')) LIKE '%' || LOWER(filter_destination) || '%')
          AND (filter_chunk_type IS NULL OR dc.metadata->>'chunk_type' = filter_chunk_type)
        ORDER BY dc.embedding <=> query_embedding ASC
        LIMIT match_count;
    END IF;
END;
$$;

-- 4. Production-tuned match_document_summaries RPC with iterative scan
CREATE OR REPLACE FUNCTION match_document_summaries(
    query_embedding VECTOR(768),
    p_agency_id TEXT DEFAULT 'global',
    match_count INT DEFAULT 3,
    match_threshold FLOAT DEFAULT 0.3
)
RETURNS TABLE (
    id TEXT,
    summary_text TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    BEGIN
        SET LOCAL hnsw.iterative_scan = 'relaxed_order';
        SET LOCAL hnsw.ef_search = 80;
        SET LOCAL hnsw.max_scan_tuples = 50000;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    RETURN QUERY
    SELECT
        d.id::text,
        d.summary_text,
        1 - (d.summary_embedding <=> query_embedding) AS similarity
    FROM public.documents d
    WHERE (d.agency_id = 'global' OR d.agency_id = p_agency_id)
      AND d.summary_embedding IS NOT NULL
      AND (1 - (d.summary_embedding <=> query_embedding)) >= match_threshold
    ORDER BY d.summary_embedding <=> query_embedding ASC
    LIMIT match_count;
END;
$$;
