-- Issue #73: distinguish founder/admin uploads from legacy commissioned artwork.
-- This enum addition is isolated because PostgreSQL enum values must commit before
-- later migrations safely use the new value.
alter type public.stamp_artwork_kind add value if not exists 'uploaded';
