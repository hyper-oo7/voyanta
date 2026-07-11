-- Migration: 20260711000005_vault_packages_audit.sql
-- Purpose: Add raw_text and extraction_version columns to public.vault_packages

ALTER TABLE public.vault_packages ADD COLUMN IF NOT EXISTS raw_text TEXT;
ALTER TABLE public.vault_packages ADD COLUMN IF NOT EXISTS extraction_version TEXT DEFAULT 'v1.0.0';
