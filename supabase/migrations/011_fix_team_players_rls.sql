-- Fix: gully11_fantasy_team_players RLS policy was not updated when
-- migration 008 made group_id nullable on gully11_fantasy_teams.
-- The old policy checked group_id IN (...) which fails for NULL group_id,
-- preventing members from seeing other members' team players (and thus live points).

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Group members can read team players" ON gully11_fantasy_team_players;

-- New policy: any authenticated user can read team players
-- (matches the open policy on gully11_fantasy_teams from migration 008)
CREATE POLICY "Anyone authenticated can read team players"
  ON gully11_fantasy_team_players FOR SELECT
  TO authenticated
  USING (true);
