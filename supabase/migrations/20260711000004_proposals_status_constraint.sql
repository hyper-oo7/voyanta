-- Migration: 20260711000004_proposals_status_constraint.sql
-- Purpose: Relax status check constraint to support 'Approved' (Won) and 'Cancelled' (Lost) status tracking

ALTER TABLE public.proposals DROP CONSTRAINT IF EXISTS proposals_status_check;
ALTER TABLE public.proposals ADD CONSTRAINT proposals_status_check CHECK (status IN ('Draft', 'Sent', 'Approved', 'Modified', 'Archived', 'Rejected', 'Cancelled'));
