-- Neighbourhood ("Bandra West") shown on place cards. The full address is fetched on demand.
alter table public.saved_places add column locality text;
