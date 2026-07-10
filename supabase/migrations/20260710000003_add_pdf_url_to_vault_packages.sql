-- ============================================================================
-- Migration: 20260710000003_add_pdf_url_to_vault_packages.sql
-- Purpose: Add pdf_url column to public.vault_packages to store Cloudflare R2 links
-- ============================================================================

ALTER TABLE public.vault_packages ADD COLUMN IF NOT EXISTS pdf_url TEXT;
