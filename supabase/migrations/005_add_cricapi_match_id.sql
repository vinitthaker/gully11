-- Add CricAPI match ID column to schedule table
ALTER TABLE gully11_ipl_schedule
ADD COLUMN IF NOT EXISTS cricapi_match_id TEXT;

-- Test: Map match #1 (RCB vs SRH) to a completed IPL 2025 match for testing
-- This is the RCB vs SRH match from IPL 2025 (May 23, 2025) — SRH won by 42 runs
UPDATE gully11_ipl_schedule
SET cricapi_match_id = '20aacd15-ede1-4447-9b21-dd08e51900b2'
WHERE id = 1;
