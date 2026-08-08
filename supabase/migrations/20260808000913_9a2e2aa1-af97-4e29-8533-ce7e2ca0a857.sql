ALTER TABLE public.home_blocks
  ADD COLUMN IF NOT EXISTS block_type text NOT NULL DEFAULT 'cards',
  ADD COLUMN IF NOT EXISTS columns smallint NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS items jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.home_blocks
  DROP CONSTRAINT IF EXISTS home_blocks_block_type_check;
ALTER TABLE public.home_blocks
  ADD CONSTRAINT home_blocks_block_type_check CHECK (block_type IN ('cards','links'));

ALTER TABLE public.home_blocks
  DROP CONSTRAINT IF EXISTS home_blocks_columns_check;
ALTER TABLE public.home_blocks
  ADD CONSTRAINT home_blocks_columns_check CHECK (columns IN (3,4));