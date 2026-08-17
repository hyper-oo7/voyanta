-- Migration: 20260817000004_hybrid_search_rrf.sql
-- Description: Add Full-Text TSVector column and Reciprocal Rank Fusion (RRF) Hybrid Search RPC

-- 1. Add full-text search tsvector column to document_chunks
ALTER TABLE public.document_chunks 
  ADD COLUMN IF NOT EXISTS content_tsv TSVECTOR 
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

-- 2. GIN index for high-speed keyword retrieval
CREATE INDEX IF NOT EXISTS idx_document_chunks_content_tsv 
ON public.document_chunks USING GIN (content_tsv);

-- 3. Hybrid Search RPC with Reciprocal Rank Fusion (RRF)
CREATE OR REPLACE FUNCTION match_document_chunks_hybrid(
    query_embedding VECTOR(768),
    query_text TEXT,
    match_count INT DEFAULT 8,
    p_agency_id TEXT DEFAULT 'global',
    filter_destination TEXT DEFAULT NULL,
    filter_chunk_type TEXT DEFAULT NULL,
    rrf_k INT DEFAULT 60,
    vector_weight FLOAT DEFAULT 1.0,
    keyword_weight FLOAT DEFAULT 1.0
)
RETURNS TABLE (
    id TEXT,
    content TEXT,
    metadata JSONB,
    source_type TEXT,
    document_id TEXT,
    similarity FLOAT,
    vector_rank INT,
    keyword_rank INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Configure runtime HNSW traversal
    BEGIN
        SET LOCAL hnsw.iterative_scan = 'relaxed_order';
        SET LOCAL hnsw.ef_search = 80;
        SET LOCAL hnsw.max_scan_tuples = 50000;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    RETURN QUERY
    WITH
    -- 1. Semantic Dense Search Candidates
    semantic AS (
        SELECT 
            dc.id,
            ROW_NUMBER() OVER (ORDER BY dc.embedding <=> query_embedding ASC) AS rank
        FROM public.document_chunks dc
        WHERE (dc.agency_id = 'global' OR dc.agency_id = p_agency_id)
          AND (filter_destination IS NULL OR LOWER(COALESCE(dc.metadata->>'destination', '')) LIKE '%' || LOWER(filter_destination) || '%')
          AND (filter_chunk_type IS NULL OR dc.metadata->>'chunk_type' = filter_chunk_type)
        LIMIT match_count * 3
    ),
    -- 2. Keyword Full-Text Search Candidates
    keyword AS (
        SELECT 
            dc.id,
            ROW_NUMBER() OVER (ORDER BY ts_rank_cd(dc.content_tsv, websearch_to_tsquery('english', query_text)) DESC) AS rank
        FROM public.document_chunks dc
        WHERE (dc.agency_id = 'global' OR dc.agency_id = p_agency_id)
          AND dc.content_tsv @@ websearch_to_tsquery('english', query_text)
          AND (filter_destination IS NULL OR LOWER(COALESCE(dc.metadata->>'destination', '')) LIKE '%' || LOWER(filter_destination) || '%')
          AND (filter_chunk_type IS NULL OR dc.metadata->>'chunk_type' = filter_chunk_type)
        LIMIT match_count * 3
    ),
    -- 3. Reciprocal Rank Fusion
    fused AS (
        SELECT
            COALESCE(s.id, k.id) AS id,
            (COALESCE(vector_weight / (rrf_k + s.rank), 0.0) + 
             COALESCE(keyword_weight / (rrf_k + k.rank), 0.0))::FLOAT AS rrf_score,
            s.rank::INT AS vector_rank,
            k.rank::INT AS keyword_rank
        FROM semantic s
        FULL OUTER JOIN keyword k ON s.id = k.id
    )
    SELECT
        dc.id,
        dc.content,
        dc.metadata,
        dc.source_type,
        dc.document_id,
        f.rrf_score AS similarity,
        f.vector_rank,
        f.keyword_rank
    FROM fused f
    JOIN public.document_chunks dc ON dc.id = f.id
    ORDER BY f.rrf_score DESC
    LIMIT match_count;
END;
$$;
