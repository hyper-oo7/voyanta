-- ============================================================================
-- Migration: 20260710000004_supplier_pdfs_permanent_and_status.sql
-- Purpose: Remove 15-day vault expiration constraints:
--          1. Make expires_at column nullable on public.supplier_pdfs
--          2. Enforce check constraint on public.supplier_pdfs status ('active', 'superseded')
--          3. Enforce check constraint on public.vault_packages status ('active', 'superseded', 'deleted')
-- ============================================================================

-- 1. Make expires_at nullable in supplier_pdfs
ALTER TABLE public.supplier_pdfs ALTER COLUMN expires_at DROP NOT NULL;

-- 2. Add check constraint on supplier_pdfs status
ALTER TABLE public.supplier_pdfs DROP CONSTRAINT IF EXISTS supplier_pdfs_status_check;
ALTER TABLE public.supplier_pdfs ADD CONSTRAINT supplier_pdfs_status_check CHECK (status IN ('active', 'superseded'));

-- 3. Add check constraint on vault_packages status
ALTER TABLE public.vault_packages DROP CONSTRAINT IF EXISTS vault_packages_status_check;
ALTER TABLE public.vault_packages ADD CONSTRAINT vault_packages_status_check CHECK (status IN ('active', 'superseded', 'deleted'));
