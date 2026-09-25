-- v29_wa_album_batching.sql
-- Supports the new single-row WhatsApp album batching introduced in the
-- webhook debounce refactor.  All photos from a rapid-fire send now land in
-- ONE field_notes row; photo_urls JSONB holds the complete array.
--
-- Changes:
--   1. sender_name   — already added in v28; this is idempotent.
--   2. photo_urls    — already JSONB DEFAULT '[]' from v15; no schema change.
--   3. wa_batch_id   — already TEXT from v25; no schema change.
--   4. New GIN index on photo_urls for fast "entries with photos" queries.
--   5. Drops the obsolete idx_field_notes_wa_batch (replaced by full-scan
--      is now negligible since batch lookups happen server-side in memory).

SET search_path TO public;

-- 1. sender_name (idempotent — v28 may have run already)
ALTER TABLE public.field_notes
  ADD COLUMN IF NOT EXISTS sender_name TEXT;

COMMENT ON COLUMN public.field_notes.sender_name IS
  'WhatsApp display name of the sender. Set by the webhook on ingest.';

-- 2. GIN index: fast lookup of notes that have photo_urls populated
--    (used by the Bitácora feed to filter album entries)
CREATE INDEX IF NOT EXISTS idx_field_notes_photo_urls_gin
  ON public.field_notes USING GIN (photo_urls jsonb_path_ops)
  WHERE photo_urls IS NOT NULL AND photo_urls != '[]'::jsonb;

-- 3. Composite index for WhatsApp feed queries (most common access pattern)
CREATE INDEX IF NOT EXISTS idx_field_notes_wa_feed
  ON public.field_notes (org_id, source, created_at DESC)
  WHERE source = 'WHATSAPP';
