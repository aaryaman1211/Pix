-- The photo shown as a memory's thumbnail. Null means "the first photo".
-- Deliberately no foreign key: a second link between memories and memory_photos would make the
-- app's existing `memory_photos(...)` embeds ambiguous. The app clears it when that photo is
-- deleted and falls back to the first photo if it ever points at a missing one.
alter table public.memories add column cover_photo_id uuid;
