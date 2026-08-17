-- Migration: 20260817000002_doc_summary_embeddings.sql
-- Description: Add document-level summary text and vector embeddings for Document Summary Index routing

CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Add summary columns to public.documents
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS summary_text TEXT,
  ADD COLUMN IF NOT EXISTS summary_embedding VECTOR(768);

-- HNSW index for fast document-level cosine similarity search on documents table
CREATE INDEX IF NOT EXISTS idx_documents_summary_embedding
ON public.documents
USING hnsw (summary_embedding vector_cosine_ops)
WHERE summary_embedding IS NOT NULL;

-- 2. Add summary columns to public.vault_packages
ALTER TABLE public.vault_packages
  ADD COLUMN IF NOT EXISTS summary_text TEXT,
  ADD COLUMN IF NOT EXISTS summary_embedding VECTOR(768);

-- HNSW index for fast document-level cosine similarity search on vault_packages table
CREATE INDEX IF NOT EXISTS idx_vault_packages_summary_embedding
ON public.vault_packages
USING hnsw (summary_embedding vector_cosine_ops)
WHERE summary_embedding IS NOT NULL;

-- 3. RPC function to search document summaries by query embedding
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
