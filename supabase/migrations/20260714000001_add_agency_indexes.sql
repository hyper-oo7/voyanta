-- Add indexes on agency_id to prevent sequential scans during RLS filtering

CREATE INDEX IF NOT EXISTS idx_clients_agency ON public.clients(agency_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_agency ON public.subscriptions(agency_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_agency ON public.team_invitations(agency_id);
CREATE INDEX IF NOT EXISTS idx_proposals_agency ON public.proposals(agency_id);
CREATE INDEX IF NOT EXISTS idx_proposal_items_proposal ON public.proposal_items(proposal_id);
CREATE INDEX IF NOT EXISTS idx_invoices_agency ON public.invoices(agency_id);
CREATE INDEX IF NOT EXISTS idx_hotels_agency ON public.hotels(agency_id);
CREATE INDEX IF NOT EXISTS idx_flights_agency ON public.flights(agency_id);
CREATE INDEX IF NOT EXISTS idx_activities_agency ON public.activities(agency_id);
CREATE INDEX IF NOT EXISTS idx_templates_agency ON public.templates(agency_id);
CREATE INDEX IF NOT EXISTS idx_itineraries_agency ON public.itineraries(agency_id);
CREATE INDEX IF NOT EXISTS idx_itinerary_blocks_agency ON public.itinerary_blocks(agency_id);
CREATE INDEX IF NOT EXISTS idx_imports_agency ON public.imports(agency_id);
CREATE INDEX IF NOT EXISTS idx_field_mappings_agency ON public.field_mappings(agency_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_agency ON public.analytics_events(agency_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_agency ON public.activity_logs(agency_id);
CREATE INDEX IF NOT EXISTS idx_notifications_agency ON public.notifications(agency_id);
