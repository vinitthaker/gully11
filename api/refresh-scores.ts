import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// ─── Config ──────────────────────────────────────────────────────
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const RAPIDAPI_KEY = process.env.VITE_RAPIDAPI_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Cricbuzz Types ──────────────────────────────────────────────
interface CricbuzzBatsman {
  id: number; name: string; balls: number; runs: number;
  fours: number; sixes: number; strkrate: string; outdec: string;
}
interface CricbuzzBowler {
  id: number; name: string; overs: number; maidens: number;
  runs: number; wickets: number; economy: string;
}
interface CricbuzzFielder {
  name: string; catches: number; runouts: number; stumpings: number;
}
interface CricbuzzInning {
  inningsid: number; batsman: CricbuzzBatsman[];
  bowler: CricbuzzBowler[]; fielder?: CricbuzzFielder[];
}

// ─── Scoring Rules (same as frontend) ────────────────────────────
const RULES = {
  RUN: 1, FOUR_BONUS: 1, SIX_BONUS: 2, HALF_CENTURY: 8, CENTURY: 16,
  WICKET: 25, THREE_WICKETS: 8, FIVE_WICKETS: 16, MAIDEN_OVER: 12,
  CATCH: 8, RUN_OUT: 12, STUMPING: 12,
  CAPTAIN: 2, VICE_CAPTAIN: 1.5,
  DUCK: -3,
  SR_ABOVE_170: 6, SR_150_TO_170: 4, SR_130_TO_150: 2,
  SR_BELOW_60: -6, SR_60_TO_80: -4, SR_80_TO_100: -2, SR_MIN_BALLS: 10,
  ECON_BELOW_5: 6, ECON_5_TO_6: 4, ECON_6_TO_7: 2,
  ECON_10_TO_11: -2, ECON_11_TO_12: -4, ECON_ABOVE_12: -6, ECON_MIN_OVERS: 2,
};

// ─── Scoring Engine ──────────────────────────────────────────────
interface PlayerStats {
  playerId: string; name: string;
  runs: number; wickets: number; catches: number; ballsFaced: number;
  fours: number; sixes: number; oversBowled: number; runsConceded: number;
  maidens: number; stumpings: number; runOuts: number;
  strikeRate: number; economyRate: number;
  fantasyPoints: number;
  breakdown: { batting: number; bowling: number; fielding: number; bonus: number };
}

function calculatePlayerPoints(s: PlayerStats) {
  let batting = 0, bowling = 0, fielding = 0, bonus = 0;

  // Batting
  if (s.runs > 0) batting += s.runs * RULES.RUN;
  if (s.fours > 0) batting += s.fours * RULES.FOUR_BONUS;
  if (s.sixes > 0) batting += s.sixes * RULES.SIX_BONUS;
  if (s.runs >= 100) bonus += RULES.CENTURY;
  else if (s.runs >= 50) bonus += RULES.HALF_CENTURY;
  if (s.runs === 0 && s.ballsFaced > 0) batting += RULES.DUCK;

  // Bowling
  if (s.wickets > 0) bowling += s.wickets * RULES.WICKET;
  if (s.wickets >= 5) bonus += RULES.FIVE_WICKETS;
  else if (s.wickets >= 3) bonus += RULES.THREE_WICKETS;
  if (s.maidens > 0) bowling += s.maidens * RULES.MAIDEN_OVER;

  // Fielding
  if (s.catches > 0) fielding += s.catches * RULES.CATCH;
  if (s.stumpings > 0) fielding += s.stumpings * RULES.STUMPING;
  if (s.runOuts > 0) fielding += s.runOuts * RULES.RUN_OUT;

  // SR bonus
  if (s.ballsFaced >= RULES.SR_MIN_BALLS && s.strikeRate > 0) {
    if (s.strikeRate > 170) bonus += RULES.SR_ABOVE_170;
    else if (s.strikeRate >= 150) bonus += RULES.SR_150_TO_170;
    else if (s.strikeRate >= 130) bonus += RULES.SR_130_TO_150;
    else if (s.strikeRate < 60) bonus += RULES.SR_BELOW_60;
    else if (s.strikeRate < 80) bonus += RULES.SR_60_TO_80;
    else if (s.strikeRate < 100) bonus += RULES.SR_80_TO_100;
  }

  // Economy bonus
  if (s.oversBowled >= RULES.ECON_MIN_OVERS && s.economyRate > 0) {
    if (s.economyRate < 5) bonus += RULES.ECON_BELOW_5;
    else if (s.economyRate < 6) bonus += RULES.ECON_5_TO_6;
    else if (s.economyRate < 7) bonus += RULES.ECON_6_TO_7;
    else if (s.economyRate > 12) bonus += RULES.ECON_ABOVE_12;
    else if (s.economyRate > 11) bonus += RULES.ECON_11_TO_12;
    else if (s.economyRate > 10) bonus += RULES.ECON_10_TO_11;
  }

  return { total: batting + bowling + fielding + bonus, batting, bowling, fielding, bonus };
}

function extractStats(scorecard: CricbuzzInning[]): Map<string, PlayerStats> {
  const statsMap = new Map<string, PlayerStats>();

  const getOrCreate = (id: number, name: string): PlayerStats => {
    const strId = String(id);
    if (!statsMap.has(strId)) {
      statsMap.set(strId, {
        playerId: strId, name,
        runs: 0, wickets: 0, catches: 0, ballsFaced: 0,
        fours: 0, sixes: 0, oversBowled: 0, runsConceded: 0,
        maidens: 0, stumpings: 0, runOuts: 0,
        strikeRate: 0, economyRate: 0, fantasyPoints: 0,
        breakdown: { batting: 0, bowling: 0, fielding: 0, bonus: 0 },
      });
    }
    return statsMap.get(strId)!;
  };

  for (const inning of scorecard) {
    if (inning.batsman) {
      for (const bat of inning.batsman) {
        if (!bat.id) continue;
        const p = getOrCreate(bat.id, bat.name);
        p.runs += bat.runs || 0;
        p.ballsFaced += bat.balls || 0;
        p.fours += bat.fours || 0;
        p.sixes += bat.sixes || 0;
      }
    }
    if (inning.bowler) {
      for (const bowl of inning.bowler) {
        if (!bowl.id) continue;
        const p = getOrCreate(bowl.id, bowl.name);
        p.wickets += bowl.wickets || 0;
        p.oversBowled += bowl.overs || 0;
        p.runsConceded += bowl.runs || 0;
        p.maidens += bowl.maidens || 0;
      }
    }
    if (inning.fielder) {
      for (const field of inning.fielder) {
        const existing = Array.from(statsMap.values()).find(
          (s) => s.name.toLowerCase() === field.name.toLowerCase() ||
                 s.name.toLowerCase().includes(field.name.toLowerCase()) ||
                 field.name.toLowerCase().includes(s.name.toLowerCase())
        );
        if (existing) {
          existing.catches += field.catches || 0;
          existing.stumpings += field.stumpings || 0;
          existing.runOuts += field.runouts || 0;
        }
      }
    }
  }

  for (const [, stats] of statsMap) {
    if (stats.ballsFaced > 0) stats.strikeRate = (stats.runs / stats.ballsFaced) * 100;
    if (stats.oversBowled > 0) stats.economyRate = stats.runsConceded / stats.oversBowled;
    const pts = calculatePlayerPoints(stats);
    stats.fantasyPoints = pts.total;
    stats.breakdown = pts;
  }

  return statsMap;
}

function extractMatchScore(scorecard: CricbuzzInning[]) {
  const innings: { team: string; score: string; overs: string }[] = [];
  for (const inning of scorecard) {
    let totalRuns = 0, totalWickets = 0;
    for (const bat of inning.batsman || []) {
      totalRuns += bat.runs || 0;
      if (bat.outdec && bat.outdec !== 'batting' && bat.outdec !== 'not out') totalWickets++;
    }
    const bowlers = inning.bowler || [];
    let totalBalls = 0;
    for (const b of bowlers) {
      const whole = Math.floor(b.overs || 0);
      const frac = Math.round(((b.overs || 0) - whole) * 10);
      totalBalls += whole * 6 + frac;
    }
    const bowlerRuns = bowlers.reduce((sum, b) => sum + (b.runs || 0), 0);
    if (bowlerRuns > totalRuns) totalRuns = bowlerRuns;
    const ov = Math.floor(totalBalls / 6);
    const ob = totalBalls % 6;
    innings.push({
      team: `Innings ${inning.inningsid}`,
      score: `${totalRuns}/${totalWickets}`,
      overs: ob > 0 ? `${ov}.${ob}` : `${ov}`,
    });
  }
  return { innings, status: scorecard.length >= 2 ? 'Complete' : 'In Progress' };
}

// ─── Name matching (same as frontend) ────────────────────────────
function buildPlayerIdMap(
  players: { id: string; name: string }[],
  teamPlayers: { player_id: string }[],
  stats: Map<string, PlayerStats>
): Map<string, string> {
  const cricbuzzPlayers = Array.from(stats.entries());
  const normalize = (s: string) => s.toLowerCase().trim().replace(/[^a-z ]/g, '');

  const idMap = new Map<string, string>();
  const allPlayerIds = new Set(teamPlayers.map((tp) => tp.player_id));

  for (const ourId of allPlayerIds) {
    const player = players.find((p) => p.id === ourId);
    if (!player) { idMap.set(ourId, ourId); continue; }

    const ourName = normalize(player.name);
    const ourParts = ourName.split(' ').filter(Boolean);
    const ourLast = ourParts[ourParts.length - 1];
    const ourFirst = ourParts[0];
    let matched = false;

    for (const [cbId, cbPlayer] of cricbuzzPlayers) {
      const cbName = normalize(cbPlayer.name);
      const cbParts = cbName.split(' ').filter(Boolean);
      const cbLast = cbParts[cbParts.length - 1];
      const cbFirst = cbParts[0];

      if (ourName === cbName ||
          (ourLast === cbLast && ourFirst[0] === cbFirst[0]) ||
          (ourLast === cbLast && (cbFirst.startsWith(ourFirst) || ourFirst.startsWith(cbFirst))) ||
          (cbParts.length === 1 && cbFirst === ourLast) ||
          ourName.includes(cbName) || cbName.includes(ourName) ||
          (ourLast === cbLast && ourLast.length >= 5)) {
        idMap.set(ourId, cbId);
        matched = true;
        break;
      }
    }
    if (!matched) idMap.set(ourId, ourId);
  }
  return idMap;
}

// ─── Main Handler ────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow manual trigger or cron
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  // For cron jobs, Vercel sends the secret in the Authorization header
  // For manual calls, skip auth check (admin responsibility)

  if (!RAPIDAPI_KEY) {
    return res.status(500).json({ error: 'RAPIDAPI_KEY not configured' });
  }

  try {
    const now = new Date();
    const fiveHoursMs = 5 * 60 * 60 * 1000;

    // 1. Find matches that are live (started but not ended, with cricbuzz ID)
    const { data: matches, error: mErr } = await supabase
      .from('gully11_ipl_schedule')
      .select('id, team_home, team_away, match_date, cricbuzz_match_id')
      .not('cricbuzz_match_id', 'is', null);

    if (mErr) throw mErr;

    const liveMatches = (matches || []).filter((m) => {
      const matchDate = new Date(m.match_date).getTime();
      const nowMs = now.getTime();
      return nowMs > matchDate && nowMs < matchDate + fiveHoursMs;
    });

    if (liveMatches.length === 0) {
      return res.status(200).json({ message: 'No live matches', matchesChecked: 0 });
    }

    // 2. Get all players for name matching
    const { data: allPlayers } = await supabase
      .from('gully11_players')
      .select('id, name');

    const results = [];

    for (const match of liveMatches) {
      try {
        // 3. Fetch scorecard from Cricbuzz
        const cbRes = await fetch(
          `https://cricbuzz-cricket.p.rapidapi.com/mcenter/v1/${match.cricbuzz_match_id}/hscard`,
          {
            headers: {
              'x-rapidapi-host': 'cricbuzz-cricket.p.rapidapi.com',
              'x-rapidapi-key': RAPIDAPI_KEY,
            },
          }
        );

        if (!cbRes.ok) {
          results.push({ matchId: match.id, error: `Cricbuzz API ${cbRes.status}` });
          continue;
        }

        const cbData = await cbRes.json();
        const scorecard: CricbuzzInning[] = cbData.scorecard || [];

        if (scorecard.length === 0) {
          results.push({ matchId: match.id, error: 'No scorecard data' });
          continue;
        }

        // 4. Extract stats and calculate points
        const stats = extractStats(scorecard);
        const matchScore = extractMatchScore(scorecard);

        // 5. Get all fantasy teams for this match
        const { data: teams } = await supabase
          .from('gully11_fantasy_teams')
          .select('id, user_id, captain_id, vice_captain_id')
          .eq('match_id', match.id);

        const teamIds = (teams || []).map((t) => t.id);
        const { data: teamPlayers } = await supabase
          .from('gully11_fantasy_team_players')
          .select('team_id, player_id')
          .in('team_id', teamIds.length > 0 ? teamIds : ['none']);

        // 6. Build name mapping
        const idMap = buildPlayerIdMap(allPlayers || [], teamPlayers || [], stats);

        // 7. Calculate team scores
        const teamScores = (teams || []).map((team) => {
          const picks = (teamPlayers || []).filter((tp) => tp.team_id === team.id);
          let totalPoints = 0;
          const playerScores = picks.map((pick) => {
            const mappedId = idMap.get(pick.player_id) || pick.player_id;
            const playerStat = stats.get(mappedId);
            const basePoints = playerStat?.fantasyPoints ?? 0;
            const multiplier = pick.player_id === team.captain_id
              ? RULES.CAPTAIN
              : pick.player_id === team.vice_captain_id
                ? RULES.VICE_CAPTAIN
                : 1;
            const pts = Math.round(basePoints * multiplier * 10) / 10;
            totalPoints += pts;
            return { playerId: pick.player_id, basePoints, multiplier, totalPoints: pts };
          });
          return { teamId: team.id, userId: team.user_id, totalPoints: Math.round(totalPoints * 10) / 10, players: playerScores };
        });

        teamScores.sort((a, b) => b.totalPoints - a.totalPoints);

        // 8. Build player points map
        const playerPointsMap: Record<string, any> = {};
        for (const [id, s] of stats.entries()) {
          playerPointsMap[id] = {
            name: s.name, total: s.fantasyPoints,
            batting: s.breakdown.batting, bowling: s.breakdown.bowling,
            fielding: s.breakdown.fielding, bonus: s.breakdown.bonus,
            runs: s.runs, wickets: s.wickets, catches: s.catches,
            fours: s.fours, sixes: s.sixes, ballsFaced: s.ballsFaced,
            oversBowled: s.oversBowled, runsConceded: s.runsConceded,
            maidens: s.maidens, strikeRate: s.strikeRate, economyRate: s.economyRate,
          };
        }

        // 9. Save to cache
        const { error: cacheErr } = await supabase
          .from('gully11_scorecard_cache')
          .upsert({
            match_id: match.id,
            cricbuzz_match_id: match.cricbuzz_match_id,
            scorecard_data: scorecard,
            match_score: matchScore,
            player_points: playerPointsMap,
            team_scores: teamScores,
            last_updated: new Date().toISOString(),
          }, { onConflict: 'match_id' });

        if (cacheErr) {
          results.push({ matchId: match.id, error: cacheErr.message });
        } else {
          results.push({
            matchId: match.id,
            match: `${match.team_home} vs ${match.team_away}`,
            score: matchScore,
            teamsScored: teamScores.length,
            topScore: teamScores[0]?.totalPoints ?? 0,
          });
        }
      } catch (e: any) {
        results.push({ matchId: match.id, error: e.message });
      }
    }

    return res.status(200).json({
      message: `Processed ${liveMatches.length} live match(es)`,
      timestamp: now.toISOString(),
      results,
    });
  } catch (e: any) {
    console.error('refresh-scores error:', e);
    return res.status(500).json({ error: e.message });
  }
}
