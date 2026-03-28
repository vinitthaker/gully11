-- Gully11 Schema
-- Uses existing auth.users table (shared across apps)

-- GLOBAL IPL SCHEDULE (shared across ALL groups, pre-seeded)
CREATE TABLE gully11_ipl_schedule (
  id SERIAL PRIMARY KEY,
  team_home TEXT NOT NULL,
  team_away TEXT NOT NULL,
  match_date TIMESTAMPTZ NOT NULL,
  venue TEXT NOT NULL
);

ALTER TABLE gully11_ipl_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read IPL schedule"
  ON gully11_ipl_schedule FOR SELECT
  TO authenticated
  USING (true);

-- GROUPS
CREATE TABLE gully11_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  emoji TEXT,
  invite_code TEXT UNIQUE,
  entry_amount INTEGER NOT NULL DEFAULT 100,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE gully11_groups ENABLE ROW LEVEL SECURITY;

-- GROUP MEMBERS
CREATE TABLE gully11_group_members (
  group_id UUID REFERENCES gully11_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  is_registered BOOLEAN DEFAULT false,
  is_admin BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

ALTER TABLE gully11_group_members ENABLE ROW LEVEL SECURITY;

-- MATCH RESULTS (admin-entered rankings per member, per match, per group)
CREATE TABLE gully11_match_results (
  group_id UUID REFERENCES gully11_groups(id) ON DELETE CASCADE,
  match_id INTEGER REFERENCES gully11_ipl_schedule(id),
  user_id UUID NOT NULL,
  rank INTEGER NOT NULL,
  payout NUMERIC(10,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (group_id, match_id, user_id)
);

ALTER TABLE gully11_match_results ENABLE ROW LEVEL SECURITY;

-- TRANSACTIONS (auto-generated from results)
CREATE TABLE gully11_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES gully11_groups(id) ON DELETE CASCADE,
  match_id INTEGER REFERENCES gully11_ipl_schedule(id),
  user_id UUID NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE gully11_transactions ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_gully11_members_user ON gully11_group_members(user_id);
CREATE INDEX idx_gully11_members_group ON gully11_group_members(group_id);
CREATE INDEX idx_gully11_results_group ON gully11_match_results(group_id);
CREATE INDEX idx_gully11_results_match ON gully11_match_results(match_id);
CREATE INDEX idx_gully11_tx_group ON gully11_transactions(group_id);
CREATE INDEX idx_gully11_tx_user ON gully11_transactions(user_id);
CREATE INDEX idx_gully11_schedule_date ON gully11_ipl_schedule(match_date);

-- Helper function (created AFTER tables exist)
CREATE OR REPLACE FUNCTION get_my_gully11_group_ids(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT group_id FROM gully11_group_members WHERE user_id = p_user_id;
$$;

-- RLS POLICIES (created AFTER helper function)

-- Groups
CREATE POLICY "Users can read own groups"
  ON gully11_groups FOR SELECT
  TO authenticated
  USING (id IN (SELECT get_my_gully11_group_ids(auth.uid())));

CREATE POLICY "Anyone can read groups by invite code"
  ON gully11_groups FOR SELECT
  TO authenticated, anon
  USING (invite_code IS NOT NULL);

CREATE POLICY "Authenticated users can create groups"
  ON gully11_groups FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Group creator can update"
  ON gully11_groups FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Group creator can delete"
  ON gully11_groups FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Group members
CREATE POLICY "Members and invitees can read group members"
  ON gully11_group_members FOR SELECT
  TO authenticated, anon
  USING (group_id IN (SELECT get_my_gully11_group_ids(auth.uid()))
    OR group_id IN (SELECT id FROM gully11_groups WHERE invite_code IS NOT NULL));

CREATE POLICY "Authenticated users can insert members"
  ON gully11_group_members FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Members can update own membership"
  ON gully11_group_members FOR UPDATE
  TO authenticated
  USING (group_id IN (SELECT get_my_gully11_group_ids(auth.uid())));

-- Match results
CREATE POLICY "Group members can read results"
  ON gully11_match_results FOR SELECT
  TO authenticated
  USING (group_id IN (SELECT get_my_gully11_group_ids(auth.uid())));

CREATE POLICY "Authenticated can insert results"
  ON gully11_match_results FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Transactions
CREATE POLICY "Group members can read transactions"
  ON gully11_transactions FOR SELECT
  TO authenticated
  USING (group_id IN (SELECT get_my_gully11_group_ids(auth.uid())));

CREATE POLICY "Authenticated can insert transactions"
  ON gully11_transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);
