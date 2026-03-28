-- ============================================================
-- Gully11 Fantasy Schema
-- Normalized tables for team creation, scoring & leaderboard
-- ============================================================

-- ─── 1. PLAYERS (IPL rosters, seeded per season) ────────────

CREATE TABLE gully11_players (
  id TEXT PRIMARY KEY,                -- e.g. "csk-1", "mi-3"
  name TEXT NOT NULL,
  team TEXT NOT NULL,                 -- team code: CSK, MI, RCB...
  role TEXT NOT NULL CHECK (role IN ('WK', 'BAT', 'AR', 'BOWL')),
  credits NUMERIC(3,1) DEFAULT 7.0,  -- player cost (total budget = 100)
  is_overseas BOOLEAN DEFAULT false
);

ALTER TABLE gully11_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read players"
  ON gully11_players FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE INDEX idx_gully11_players_team ON gully11_players(team);
CREATE INDEX idx_gully11_players_role ON gully11_players(role);

-- ─── 2. FANTASY TEAMS (one per user per match per group) ────

CREATE TABLE gully11_fantasy_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES gully11_groups(id) ON DELETE CASCADE,
  match_id INTEGER NOT NULL REFERENCES gully11_ipl_schedule(id),
  user_id UUID NOT NULL,
  captain_id TEXT REFERENCES gully11_players(id),
  vice_captain_id TEXT REFERENCES gully11_players(id),
  total_points NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (group_id, match_id, user_id)
);

ALTER TABLE gully11_fantasy_teams ENABLE ROW LEVEL SECURITY;

-- Users can read teams in their groups (all teams visible after match)
CREATE POLICY "Group members can read fantasy teams"
  ON gully11_fantasy_teams FOR SELECT
  TO authenticated
  USING (group_id IN (SELECT get_my_gully11_group_ids(auth.uid())));

-- Users can create/update their own teams
CREATE POLICY "Users can insert own fantasy teams"
  ON gully11_fantasy_teams FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own fantasy teams"
  ON gully11_fantasy_teams FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own fantasy teams"
  ON gully11_fantasy_teams FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX idx_gully11_ft_group ON gully11_fantasy_teams(group_id);
CREATE INDEX idx_gully11_ft_match ON gully11_fantasy_teams(match_id);
CREATE INDEX idx_gully11_ft_user ON gully11_fantasy_teams(user_id);
CREATE INDEX idx_gully11_ft_lookup ON gully11_fantasy_teams(group_id, match_id);

-- ─── 3. FANTASY TEAM PLAYERS (11 picks per team) ───────────

CREATE TABLE gully11_fantasy_team_players (
  team_id UUID NOT NULL REFERENCES gully11_fantasy_teams(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES gully11_players(id),
  role TEXT NOT NULL CHECK (role IN ('WK', 'BAT', 'AR', 'BOWL')),
  PRIMARY KEY (team_id, player_id)
);

ALTER TABLE gully11_fantasy_team_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can read team players"
  ON gully11_fantasy_team_players FOR SELECT
  TO authenticated
  USING (team_id IN (
    SELECT id FROM gully11_fantasy_teams
    WHERE group_id IN (SELECT get_my_gully11_group_ids(auth.uid()))
  ));

CREATE POLICY "Users can insert own team players"
  ON gully11_fantasy_team_players FOR INSERT
  TO authenticated
  WITH CHECK (team_id IN (
    SELECT id FROM gully11_fantasy_teams WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own team players"
  ON gully11_fantasy_team_players FOR DELETE
  TO authenticated
  USING (team_id IN (
    SELECT id FROM gully11_fantasy_teams WHERE user_id = auth.uid()
  ));

CREATE INDEX idx_gully11_ftp_team ON gully11_fantasy_team_players(team_id);

-- ─── 4. PLAYER MATCH STATS (admin-entered per match) ───────

CREATE TABLE gully11_player_match_stats (
  match_id INTEGER NOT NULL REFERENCES gully11_ipl_schedule(id),
  player_id TEXT NOT NULL REFERENCES gully11_players(id),

  -- Batting
  runs INTEGER DEFAULT 0,
  balls_faced INTEGER DEFAULT 0,
  fours INTEGER DEFAULT 0,
  sixes INTEGER DEFAULT 0,
  is_not_out BOOLEAN DEFAULT false,

  -- Bowling
  overs_bowled NUMERIC(4,1) DEFAULT 0,
  runs_conceded INTEGER DEFAULT 0,
  wickets INTEGER DEFAULT 0,
  maidens INTEGER DEFAULT 0,

  -- Fielding
  catches INTEGER DEFAULT 0,
  stumpings INTEGER DEFAULT 0,
  run_outs INTEGER DEFAULT 0,

  -- Other
  is_in_playing_xi BOOLEAN DEFAULT true,
  is_man_of_match BOOLEAN DEFAULT false,

  -- Calculated
  fantasy_points NUMERIC(10,2) DEFAULT 0,

  PRIMARY KEY (match_id, player_id)
);

ALTER TABLE gully11_player_match_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read player stats"
  ON gully11_player_match_stats FOR SELECT
  TO authenticated
  USING (true);

-- Only group admins can insert/update stats (enforced at app level for now)
CREATE POLICY "Authenticated can insert stats"
  ON gully11_player_match_stats FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM gully11_group_members WHERE is_admin = true
    )
  );

CREATE POLICY "Authenticated can update stats"
  ON gully11_player_match_stats FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM gully11_group_members WHERE is_admin = true
    )
  );

CREATE INDEX idx_gully11_pms_match ON gully11_player_match_stats(match_id);
CREATE INDEX idx_gully11_pms_player ON gully11_player_match_stats(player_id);

-- ─── 5. TEAM POINTS (calculated per team per match) ────────

CREATE TABLE gully11_team_points (
  group_id UUID NOT NULL REFERENCES gully11_groups(id) ON DELETE CASCADE,
  match_id INTEGER NOT NULL REFERENCES gully11_ipl_schedule(id),
  user_id UUID NOT NULL,
  team_id UUID REFERENCES gully11_fantasy_teams(id) ON DELETE CASCADE,
  total_points NUMERIC(10,2) NOT NULL DEFAULT 0,
  rank INTEGER,
  payout NUMERIC(10,2) DEFAULT 0,
  net_amount NUMERIC(10,2) DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (group_id, match_id, user_id)
);

ALTER TABLE gully11_team_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can read team points"
  ON gully11_team_points FOR SELECT
  TO authenticated
  USING (group_id IN (SELECT get_my_gully11_group_ids(auth.uid())));

CREATE POLICY "Authenticated can insert team points"
  ON gully11_team_points FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update team points"
  ON gully11_team_points FOR UPDATE
  TO authenticated
  USING (true);

CREATE INDEX idx_gully11_tp_group ON gully11_team_points(group_id);
CREATE INDEX idx_gully11_tp_match ON gully11_team_points(match_id);
CREATE INDEX idx_gully11_tp_rank ON gully11_team_points(group_id, match_id, rank);

-- ─── 6. FANTASY POINT RULES (configurable scoring) ─────────
-- Stored as reference so scoring logic is transparent

CREATE TABLE gully11_point_rules (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL,         -- 'batting', 'bowling', 'fielding', 'bonus'
  action TEXT NOT NULL,           -- 'run', 'four', 'six', 'wicket', etc.
  points NUMERIC(6,2) NOT NULL,
  description TEXT
);

ALTER TABLE gully11_point_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read point rules"
  ON gully11_point_rules FOR SELECT
  TO authenticated, anon
  USING (true);

-- Seed default Dream11-style point rules
INSERT INTO gully11_point_rules (category, action, points, description) VALUES
-- Batting
('batting', 'run', 1, 'Per run scored'),
('batting', 'four_bonus', 1, 'Bonus per boundary (4s)'),
('batting', 'six_bonus', 2, 'Bonus per six'),
('batting', 'half_century', 8, '50 runs bonus'),
('batting', 'century', 16, '100 runs bonus'),
('batting', 'duck', -2, 'Out for 0 (batters/WK/AR only)'),
('batting', 'strike_rate_below_50', -6, 'SR below 50 (min 10 balls)'),
('batting', 'strike_rate_50_60', -4, 'SR between 50-59.99 (min 10 balls)'),
('batting', 'strike_rate_60_70', -2, 'SR between 60-69.99 (min 10 balls)'),
('batting', 'strike_rate_130_150', 2, 'SR between 130-149.99 (min 10 balls)'),
('batting', 'strike_rate_150_170', 4, 'SR between 150-169.99 (min 10 balls)'),
('batting', 'strike_rate_above_170', 6, 'SR 170+ (min 10 balls)'),

-- Bowling
('bowling', 'wicket', 25, 'Per wicket taken'),
('bowling', 'maiden', 8, 'Per maiden over'),
('bowling', '3_wicket_haul', 4, '3 wickets bonus'),
('bowling', '4_wicket_haul', 8, '4 wickets bonus'),
('bowling', '5_wicket_haul', 16, '5 wickets bonus'),
('bowling', 'economy_below_5', 6, 'Economy below 5 (min 2 overs)'),
('bowling', 'economy_5_6', 4, 'Economy 5-5.99 (min 2 overs)'),
('bowling', 'economy_6_7', 2, 'Economy 6-6.99 (min 2 overs)'),
('bowling', 'economy_10_11', -2, 'Economy 10-11 (min 2 overs)'),
('bowling', 'economy_11_12', -4, 'Economy 11-11.99 (min 2 overs)'),
('bowling', 'economy_above_12', -6, 'Economy 12+ (min 2 overs)'),

-- Fielding
('fielding', 'catch', 8, 'Per catch'),
('fielding', 'stumping', 12, 'Per stumping'),
('fielding', 'run_out', 12, 'Direct hit run out'),

-- Bonus
('bonus', 'playing_xi', 4, 'Being in the playing XI'),
('bonus', 'man_of_match', 10, 'Man of the match'),
('bonus', 'captain', 0, 'Captain gets 2x total points'),
('bonus', 'vice_captain', 0, 'Vice captain gets 1.5x total points');
