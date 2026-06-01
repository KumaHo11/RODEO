-- Migration: Add 'source' column to farm_events to distinguish Agenda events from Rodeo activities
-- Run this in your PostgreSQL database (Supabase SQL editor or psql)

ALTER TABLE farm_events
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'agenda';

-- Mark existing events created from HerdModal as 'rodeo'
-- These are events with status='COMPLETED' that have a description matching herd activity patterns
-- (This is a best-effort classification of historical data)
-- You can run this to reclassify, or leave historical events as 'agenda' and only new ones get classified.

-- Optional: to clean up existing data, identify rodeo-created events by checking if they were
-- created via HerdModal (they always have status=COMPLETED and detailed descriptions with EV data):
-- UPDATE farm_events
--   SET source = 'rodeo'
--   WHERE status = 'COMPLETED'
--     AND description IS NOT NULL
--     AND description LIKE '%EV resultante%'
--     AND source = 'agenda';

COMMENT ON COLUMN farm_events.source IS 'Origin of the event: agenda (created in Agenda module), rodeo (created from HerdModal activities), planner (created from Grazing Planner)';
