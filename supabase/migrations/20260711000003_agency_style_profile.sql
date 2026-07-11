-- Migration: 20260711000003_agency_style_profile.sql
-- Purpose: Add style_profile column to public.agencies table

ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS style_profile JSONB DEFAULT '{}'::jsonb;
