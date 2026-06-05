-- v15_multiple_photos_and_ai.sql
-- Add support for multiple photos in field notes.

ALTER TABLE field_notes ADD COLUMN IF NOT EXISTS photo_urls JSONB DEFAULT '[]'::jsonb;
