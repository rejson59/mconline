-- Hunger drains fractionally each tick. Integer columns rejected the entire
-- profile upsert (including inventory/position) with PostgreSQL 22P02.
ALTER TABLE public.blockcraft_players
  ALTER COLUMN health TYPE double precision USING health::double precision,
  ALTER COLUMN hunger TYPE double precision USING hunger::double precision;
