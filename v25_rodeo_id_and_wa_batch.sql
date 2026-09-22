-- v25_rodeo_id_and_wa_batch.sql
-- Adds rodeo_id (herd association) and wa_batch_id (WhatsApp photo grouping) to field_notes.

-- Ensure we're working in the public schema (required for gcloud sql import context)
SET search_path TO public;

-- 1. rodeo_id: asocia una nota de bitácora a un rodeo específico
--    Permite que el análisis IA de condición corporal se guarde en el historial del rodeo.
ALTER TABLE public.field_notes
  ADD COLUMN IF NOT EXISTS rodeo_id UUID REFERENCES public.herds(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_field_notes_rodeo_id
  ON public.field_notes(rodeo_id)
  WHERE rodeo_id IS NOT NULL;

-- 2. wa_batch_id: agrupa imágenes enviadas en un mismo "álbum" de WhatsApp.
--    El webhook asigna el mismo UUID a las imágenes del mismo sender dentro de una ventana de 30s.
--    Máximo 3 imágenes por batch (el webhook lo controla).
ALTER TABLE public.field_notes
  ADD COLUMN IF NOT EXISTS wa_batch_id TEXT;

CREATE INDEX IF NOT EXISTS idx_field_notes_wa_batch
  ON public.field_notes(wa_batch_id)
  WHERE wa_batch_id IS NOT NULL;
