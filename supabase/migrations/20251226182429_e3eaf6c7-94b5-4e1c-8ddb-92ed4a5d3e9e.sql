-- Add completed boolean field to external_blocks table
ALTER TABLE public.external_blocks
ADD COLUMN completed boolean DEFAULT false;

-- Add workout_type field for badge display
ALTER TABLE public.external_blocks
ADD COLUMN workout_type text;