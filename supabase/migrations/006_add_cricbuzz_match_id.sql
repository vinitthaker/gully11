-- Add Cricbuzz match ID column to schedule table
ALTER TABLE gully11_ipl_schedule
ADD COLUMN IF NOT EXISTS cricbuzz_match_id INTEGER;

-- Test: Map match #1 (RCB vs SRH) to IPL 2025 RCB vs SRH match (30th match)
-- SRH won by 25 runs. Match ID from Cricbuzz: 91434
UPDATE gully11_ipl_schedule
SET cricbuzz_match_id = 91434
WHERE id = 1;
