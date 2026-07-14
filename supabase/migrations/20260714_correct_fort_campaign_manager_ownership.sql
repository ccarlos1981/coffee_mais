-- Migration to correct the ownership of the two FORT campaigns in July 2026 that were wrongly assigned to Julliano during backfill

BEGIN;

UPDATE public.cm_campanhas
SET gerente_id = 'b447f539-4f65-41d3-a113-238c246fcd7f'::uuid -- Leandro Saffi
WHERE id IN (
  '182a5c0e-ed92-4e9b-aa3c-d3903bc0f345', -- Campanha FORT - 2026-07 (created by Leandro Saffi)
  'e4e4cf91-bacf-4464-8e35-18cc8fe3206e'  -- Campanha FORT - 2026-07 - 371b66cf-20c9-441e-8f2a-a15a8bce8cf0 (created by Leandro Saffi)
);

COMMIT;
