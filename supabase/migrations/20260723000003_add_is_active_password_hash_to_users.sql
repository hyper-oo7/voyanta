-- Migration: Add missing is_active and password_hash columns to public.users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash TEXT;
