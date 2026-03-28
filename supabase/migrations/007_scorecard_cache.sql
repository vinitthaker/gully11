-- Cache for Cricbuzz scorecard API responses
-- Only admin refreshes this, all users read from it
CREATE TABLE IF NOT EXISTS gully11_scorecard_cache (
  id SERIAL PRIMARY KEY,
  match_id INT NOT NULL REFERENCES gully11_ipl_schedule(id) ON DELETE CASCADE,
  cricbuzz_match_id TEXT NOT NULL,

  -- Raw scorecard data (innings batting/bowling/fielding)
  scorecard_data JSONB NOT NULL DEFAULT '{}',

  -- Extracted match score summary for UI display
  match_score JSONB NOT NULL DEFAULT '{}',
  -- e.g. { "innings": [
  --   { "team": "RCB", "score": "185/4", "overs": "18.2", "status": "Batting" },
  --   { "team": "SRH", "score": "210/7", "overs": "20.0", "status": "Complete" }
  -- ], "status": "SRH won by 25 runs", "matchStatus": "Complete" }

  -- Calculated player points (our scoring engine output)
  player_points JSONB NOT NULL DEFAULT '{}',
  -- e.g. { "player_id_123": { "total": 84, "batting": 60, "bowling": 0, "fielding": 8, "bonus": 16 } }

  -- Calculated team scores for all fantasy teams
  team_scores JSONB NOT NULL DEFAULT '[]',
  -- e.g. [{ "teamId": "xxx", "userId": "yyy", "totalPoints": 475, "players": [...] }]

  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),

  UNIQUE(match_id)
);

-- Enable RLS
ALTER TABLE gully11_scorecard_cache ENABLE ROW LEVEL SECURITY;

-- Anyone can read (all group members need to see scores)
CREATE POLICY "Anyone can read scorecard cache"
  ON gully11_scorecard_cache FOR SELECT
  USING (true);

-- Only authenticated users can insert/update (admin refresh)
CREATE POLICY "Authenticated users can upsert scorecard cache"
  ON gully11_scorecard_cache FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update scorecard cache"
  ON gully11_scorecard_cache FOR UPDATE
  USING (auth.uid() IS NOT NULL);
