-- Migración para añadir soporte al Tour/Walkthrough Interactivo
ALTER TABLE "profiles"
ADD COLUMN "completed_tours" TEXT[] DEFAULT '{}';
