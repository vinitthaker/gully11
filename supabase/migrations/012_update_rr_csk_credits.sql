-- Update RR and CSK player credits and roles to match Dream11 values for IPL 2026
-- Also add missing players (Shahrukh Khan, Kuldeep Sharma)

-- ============ CSK UPDATES ============

-- WK
UPDATE gully11_players SET credits = 9.0 WHERE id = 'csk-2';   -- Sanju Samson 8.5 → 9.0
UPDATE gully11_players SET credits = 7.5 WHERE id = 'csk-1';   -- MS Dhoni 8.5 → 7.5
UPDATE gully11_players SET credits = 7.0 WHERE id = 'csk-4';   -- Urvil Patel 6.0 → 7.0

-- BAT
UPDATE gully11_players SET credits = 9.0 WHERE id = 'csk-5';   -- Ruturaj Gaikwad 8.5 → 9.0
UPDATE gully11_players SET credits = 8.5 WHERE id = 'csk-6';   -- Dewald Brevis 7.0 → 8.5
UPDATE gully11_players SET credits = 7.5 WHERE id = 'csk-7';   -- Ayush Mhatre 7.0 → 7.5

-- Replace Sarfaraz Khan with Shahrukh Khan (different player in squad)
UPDATE gully11_players SET name = 'Shahrukh Khan', credits = 7.0 WHERE id = 'csk-8';

-- Kuldeep Sharma (new, replace Kartik Sharma slot)
UPDATE gully11_players SET name = 'Kuldeep Sharma', credits = 6.5 WHERE id = 'csk-3';

-- AR
UPDATE gully11_players SET credits = 8.5 WHERE id = 'csk-15';  -- Shivam Dube 7.5 → 8.5
UPDATE gully11_players SET credits = 7.5 WHERE id = 'csk-9';   -- Jamie Overton (same)
UPDATE gully11_players SET credits = 7.0 WHERE id = 'csk-12';  -- Matthew Short (same)
UPDATE gully11_players SET credits = 6.5 WHERE id = 'csk-11';  -- Prashant Veer 6.0 → 6.5
UPDATE gully11_players SET credits = 6.5 WHERE id = 'csk-14';  -- Zak Foulkes 6.0 → 6.5
UPDATE gully11_players SET credits = 6.0 WHERE id = 'csk-13';  -- Aman Khan (A Hakim Khan) (same)
UPDATE gully11_players SET credits = 6.0 WHERE id = 'csk-10';  -- Ramakrishna Ghosh (same)

-- BOWL
UPDATE gully11_players SET credits = 8.5 WHERE id = 'csk-17';  -- Noor Ahmad 7.0 → 8.5
UPDATE gully11_players SET credits = 8.0 WHERE id = 'csk-16';  -- Khaleel Ahmed 7.0 → 8.0
UPDATE gully11_players SET credits = 8.0 WHERE id = 'csk-23';  -- Matt Henry 7.5 → 8.0
UPDATE gully11_players SET credits = 8.0 WHERE id = 'csk-25';  -- Spencer Johnson 7.0 → 8.0
UPDATE gully11_players SET credits = 7.5 WHERE id = 'csk-22';  -- Akeal Hosein 7.0 → 7.5
UPDATE gully11_players SET credits = 7.0 WHERE id = 'csk-24';  -- Rahul Chahar (same)
UPDATE gully11_players SET credits = 7.0 WHERE id = 'csk-19';  -- Mukesh Choudhary 6.5 → 7.0
UPDATE gully11_players SET credits = 7.0 WHERE id = 'csk-20';  -- Shreyas Gopal 6.5 → 7.0
UPDATE gully11_players SET credits = 6.5 WHERE id = 'csk-18';  -- Anshul Kamboj (same)
UPDATE gully11_players SET credits = 6.0 WHERE id = 'csk-21';  -- Gurjapneet Singh (same)

-- ============ RR UPDATES ============

-- WK
UPDATE gully11_players SET credits = 8.0 WHERE id = 'rr-6';    -- Dhruv Jurel (same)
UPDATE gully11_players SET credits = 7.0 WHERE id = 'rr-8';    -- Lhuan-dre Pretorius 6.0 → 7.0
UPDATE gully11_players SET name = 'Lhuan-dre Pretorius' WHERE id = 'rr-8'; -- fix typo

-- BAT
UPDATE gully11_players SET credits = 9.0 WHERE id = 'rr-1';    -- Yashasvi Jaiswal 9.5 → 9.0
UPDATE gully11_players SET credits = 8.5 WHERE id = 'rr-2';    -- Shimron Hetmyer 8.0 → 8.5
UPDATE gully11_players SET credits = 8.5 WHERE id = 'rr-3';    -- Vaibhav Suryavanshi 6.5 → 8.5
UPDATE gully11_players SET credits = 7.0 WHERE id = 'rr-4';    -- Shubham Dubey 6.0 → 7.0

UPDATE gully11_players SET credits = 6.0 WHERE id = 'rr-9';   -- Ravi Singh (same)

-- AR
UPDATE gully11_players SET credits = 8.5 WHERE id = 'rr-10';   -- Riyan Parag 8.0 → 8.5
UPDATE gully11_players SET credits = 8.5 WHERE id = 'rr-12';   -- Ravindra Jadeja (same)
UPDATE gully11_players SET credits = 8.0 WHERE id = 'rr-13';   -- Dasun Shanaka 7.5 → 8.0
UPDATE gully11_players SET credits = 7.5, role = 'AR' WHERE id = 'rr-7';  -- Donovan Ferreira 6.5 → 7.5, WK → AR
UPDATE gully11_players SET credits = 7.0 WHERE id = 'rr-11';   -- Yudhvir Singh Charak 6.0 → 7.0

-- BOWL
UPDATE gully11_players SET credits = 8.5 WHERE id = 'rr-14';   -- Jofra Archer 8.0 → 8.5
UPDATE gully11_players SET credits = 8.0 WHERE id = 'rr-17';   -- Ravi Bishnoi 7.5 → 8.0
UPDATE gully11_players SET credits = 8.0 WHERE id = 'rr-24';   -- Sandeep Sharma 7.0 → 8.0
UPDATE gully11_players SET credits = 7.5 WHERE id = 'rr-22';   -- Adam Milne 7.0 → 7.5
UPDATE gully11_players SET credits = 7.5 WHERE id = 'rr-15';   -- Tushar Deshpande 7.0 → 7.5
UPDATE gully11_players SET credits = 7.5 WHERE id = 'rr-25';   -- Nandre Burger 7.0 → 7.5
UPDATE gully11_players SET credits = 7.0 WHERE id = 'rr-23';   -- Kuldeep Sen → Kartik Sen 7.0
UPDATE gully11_players SET credits = 6.5 WHERE id = 'rr-16';   -- Kwena Maphaka 6.0 → 6.5
UPDATE gully11_players SET credits = 6.5 WHERE id = 'rr-20';   -- Vignesh Puthur → Vaibhav Puthur 6.0 → 6.5
UPDATE gully11_players SET credits = 6.0 WHERE id = 'rr-19';   -- Yash Punja (same)
UPDATE gully11_players SET credits = 6.0 WHERE id = 'rr-21';   -- Brijesh Sharma → Budhi Sharma (same)
UPDATE gully11_players SET credits = 6.0 WHERE id = 'rr-18';   -- Sushant Mishra (same)
