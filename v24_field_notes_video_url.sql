-- v24: Add video_url column to field_notes
-- Run this migration to support WhatsApp video messages in Bitácora

ALTER TABLE field_notes
  ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Index for fast lookup of video notes
CREATE INDEX IF NOT EXISTS idx_field_notes_video_url
  ON field_notes (org_id)
  WHERE video_url IS NOT NULL;
