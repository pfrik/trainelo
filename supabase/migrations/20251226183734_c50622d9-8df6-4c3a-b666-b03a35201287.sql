-- Add description field to external_blocks table
ALTER TABLE public.external_blocks ADD COLUMN IF NOT EXISTS description text;