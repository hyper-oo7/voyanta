-- Migration 20260721000001: Expand clients_status_check constraint to accept both title case and lower case statuses

DO $$
BEGIN
  -- Drop existing check constraint if present
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clients_status_check'
  ) THEN
    ALTER TABLE public.clients DROP CONSTRAINT clients_status_check;
  END IF;

  -- Re-add check constraint supporting both TitleCase and lowercase variations
  ALTER TABLE public.clients ADD CONSTRAINT clients_status_check
    CHECK (
      status IS NULL OR
      status IN (
        'Inquiry', 'inquiry',
        'Proposal Sent', 'proposal sent', 'proposal_sent',
        'Approved', 'approved',
        'Booked', 'booked',
        'Completed', 'completed',
        'Cancelled', 'cancelled', 'canceled',
        'Lead', 'lead',
        'Draft', 'draft',
        'Active', 'active'
      )
    );
END $$;
