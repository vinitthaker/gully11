-- Update PBKS and GT player credits and roles to match Dream11 values for IPL 2026

-- ============ PBKS UPDATES ============

UPDATE gully11_players SET credits = 9.0 WHERE id = 'pbks-1';    -- Shreyas Iyer 8.5 → 9.0
UPDATE gully11_players SET credits = 7.5 WHERE id = 'pbks-2';    -- Nehal Wadhera 7.0 → 7.5
UPDATE gully11_players SET credits = 6.5 WHERE id = 'pbks-4';    -- Pyla Avinash 6.0 → 6.5
UPDATE gully11_players SET credits = 8.0 WHERE id = 'pbks-5';    -- Shashank Singh 7.0 → 8.0
UPDATE gully11_players SET credits = 7.0 WHERE id = 'pbks-6';    -- Vishnu Vinod 6.5 → 7.0
UPDATE gully11_players SET credits = 8.0 WHERE id = 'pbks-7';    -- Prabhsimran Singh 6.5 → 8.0
UPDATE gully11_players SET role = 'BOWL', credits = 7.5 WHERE id = 'pbks-9';   -- Harpreet Brar AR → BOWL, 7.0 → 7.5
UPDATE gully11_players SET credits = 8.5 WHERE id = 'pbks-10';   -- Marco Jansen 8.0 → 8.5
UPDATE gully11_players SET credits = 8.0 WHERE id = 'pbks-11';   -- Azmatullah Omarzai 7.5 → 8.0
UPDATE gully11_players SET role = 'BAT', credits = 8.0 WHERE id = 'pbks-12';   -- Priyansh Arya AR → BAT, 6.0 → 8.0
UPDATE gully11_players SET credits = 7.0 WHERE id = 'pbks-15';   -- Mitch Owen 6.0 → 7.0
UPDATE gully11_players SET credits = 7.5 WHERE id = 'pbks-16';   -- Cooper Connolly 7.0 → 7.5
UPDATE gully11_players SET role = 'BOWL', credits = 7.5 WHERE id = 'pbks-17';  -- Ben Dwarshuis AR → BOWL, 6.0 → 7.5
UPDATE gully11_players SET credits = 9.0 WHERE id = 'pbks-18';   -- Arshdeep Singh 8.5 → 9.0
UPDATE gully11_players SET credits = 7.5 WHERE id = 'pbks-20';   -- Vyshak Vijaykumar 6.0 → 7.5
UPDATE gully11_players SET credits = 7.0 WHERE id = 'pbks-21';   -- Yash Thakur 6.0 → 7.0
UPDATE gully11_players SET credits = 7.0 WHERE id = 'pbks-22';   -- Xavier Bartlett 6.0 → 7.0
UPDATE gully11_players SET credits = 7.0 WHERE id = 'pbks-23';   -- Pravin Dubey 6.0 → 7.0
UPDATE gully11_players SET credits = 6.5 WHERE id = 'pbks-24';   -- Vishal Nishad 6.0 → 6.5

-- ============ GT UPDATES ============

UPDATE gully11_players SET credits = 9.0 WHERE id = 'gt-1';      -- Shubman Gill 9.5 → 9.0
UPDATE gully11_players SET credits = 9.0 WHERE id = 'gt-2';      -- Sai Sudharsan 8.0 → 9.0
UPDATE gully11_players SET role = 'AR' WHERE id = 'gt-3';         -- Glenn Phillips BAT → AR
UPDATE gully11_players SET credits = 8.5 WHERE id = 'gt-4';      -- Jos Buttler 9.5 → 8.5
UPDATE gully11_players SET credits = 6.5 WHERE id = 'gt-5';      -- Kumar Kushagra 6.0 → 6.5
UPDATE gully11_players SET role = 'BAT', credits = 7.5 WHERE id = 'gt-7';   -- Tom Banton WK → BAT, 6.5 → 7.5
UPDATE gully11_players SET credits = 7.5 WHERE id = 'gt-9';      -- Washington Sundar 8.0 → 7.5
UPDATE gully11_players SET role = 'BOWL', credits = 6.5 WHERE id = 'gt-10'; -- Mohd Arshad Khan AR → BOWL, 6.0 → 6.5
UPDATE gully11_players SET role = 'BOWL', credits = 8.0 WHERE id = 'gt-11'; -- Sai Kishore AR → BOWL, 6.5 → 8.0
UPDATE gully11_players SET role = 'BOWL', credits = 7.0 WHERE id = 'gt-12'; -- Jayant Yadav AR → BOWL, 6.5 → 7.0
UPDATE gully11_players SET credits = 8.0 WHERE id = 'gt-13';     -- Jason Holder 7.5 → 8.0
UPDATE gully11_players SET role = 'BAT', credits = 6.5 WHERE id = 'gt-14';  -- Rahul Tewatia AR → BAT, 8.0 → 6.5
UPDATE gully11_players SET role = 'BAT', credits = 7.0 WHERE id = 'gt-15';  -- Shahrukh Khan AR → BAT, 6.5 → 7.0
UPDATE gully11_players SET credits = 8.0 WHERE id = 'gt-18';     -- Prasidh Krishna 7.0 → 8.0
UPDATE gully11_players SET role = 'AR' WHERE id = 'gt-19';       -- Manav Suthar BOWL → AR
UPDATE gully11_players SET credits = 6.0 WHERE id = 'gt-20';     -- Gurnoor Singh Brar 6.5 → 6.0
UPDATE gully11_players SET credits = 7.0 WHERE id = 'gt-21';     -- Ishant Sharma 6.0 → 7.0
UPDATE gully11_players SET credits = 7.0 WHERE id = 'gt-24';     -- Kulwant Khejroliya 6.0 → 7.0
UPDATE gully11_players SET credits = 8.5 WHERE id = 'gt-25';     -- Rashid Khan 9.5 → 8.5

-- Add missing GT player
INSERT INTO gully11_players (id, name, team, role, credits, is_overseas)
VALUES ('gt-26', 'Prem Raj Yarra', 'GT', 'BOWL', 5.5, false)
ON CONFLICT (id) DO UPDATE SET credits = 5.5;
