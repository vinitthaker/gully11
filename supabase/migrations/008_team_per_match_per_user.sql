-- Change fantasy teams to be per match per user (not per group)
-- This allows one team to apply across all groups

-- Drop old unique constraint (group_id + match_id + user_id)
ALTER TABLE gully11_fantasy_teams
  DROP CONSTRAINT IF EXISTS gully11_fantasy_teams_group_id_match_id_user_id_key;

-- Make group_id nullable
ALTER TABLE gully11_fantasy_teams
  ALTER COLUMN group_id DROP NOT NULL;

-- Add new unique constraint (match_id + user_id only)
ALTER TABLE gully11_fantasy_teams
  ADD CONSTRAINT gully11_fantasy_teams_match_user_unique UNIQUE (match_id, user_id);

-- Update RLS to allow reading all teams for a match (not just own group)
DROP POLICY IF EXISTS "Users can view fantasy teams in their groups" ON gully11_fantasy_teams;
CREATE POLICY "Anyone authenticated can view fantasy teams"
  ON gully11_fantasy_teams FOR SELECT
  USING (auth.uid() IS NOT NULL);
