// Vercel Serverless Function — auto-refresh fantasy scores
// Called by cron-job.org every 3 minutes during live matches

export const config = {
  maxDuration: 30,
};

// ─── Config ──────────────────────────────────────────────────────
const RAPIDAPI_KEY = process.env.VITE_RAPIDAPI_KEY || '';

function getSupabaseClient() {
  const url = process.env.VITE_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  // Dynamic import not needed — use fetch directly
  return { url, key };
}

async function supabaseQuery(path: string, options: any = {}) {
  const { url, key } = getSupabaseClient();
  const method = options.method || 'GET';
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || (method === 'GET' ? '' : 'return=representation'),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${res.status}: ${text}`);
  }
  if (method === 'GET' || options.prefer?.includes('return')) {
    return res.json();
  }
  return null;
}

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

// ─── Scoring Rules ───────────────────────────────────────────────
const R = {
  RUN: 1, FOUR_BONUS: 1, SIX_BONUS: 2, HALF_CENTURY: 8, CENTURY: 16,
  WICKET: 25, THREE_WICKETS: 8, FIVE_WICKETS: 16, MAIDEN_OVER: 12,
  CATCH: 8, RUN_OUT: 12, STUMPING: 12,
  CAPTAIN: 2, VICE_CAPTAIN: 1.5, DUCK: -3,
  SR_ABOVE_170: 6, SR_150_TO_170: 4, SR_130_TO_150: 2,
  SR_BELOW_60: -6, SR_60_TO_80: -4, SR_80_TO_100: -2, SR_MIN_BALLS: 10,
  ECON_BELOW_5: 6, ECON_5_TO_6: 4, ECON_6_TO_7: 2,
  ECON_10_TO_11: -2, ECON_11_TO_12: -4, ECON_ABOVE_12: -6, ECON_MIN_OVERS: 2,
};

interface PlayerStats {
  id: string; name: string;
  runs: number; wickets: number; catches: number; ballsFaced: number;
  fours: number; sixes: number; oversBowled: number; runsConceded: number;
  maidens: number; stumpings: number; runOuts: number;
  strikeRate: number; economyRate: number; fantasyPoints: number;
  breakdown: { batting: number; bowling: number; fielding: number; bonus: number };
}

function calcPoints(s: PlayerStats) {
  let bat = 0, bowl = 0, field = 0, bonus = 0;
  if (s.runs > 0) bat += s.runs * R.RUN;
  if (s.fours > 0) bat += s.fours * R.FOUR_BONUS;
  if (s.sixes > 0) bat += s.sixes * R.SIX_BONUS;
  if (s.runs >= 100) bonus += R.CENTURY;
  else if (s.runs >= 50) bonus += R.HALF_CENTURY;
  if (s.runs === 0 && s.ballsFaced > 0) bat += R.DUCK;
  if (s.wickets > 0) bowl += s.wickets * R.WICKET;
  if (s.wickets >= 5) bonus += R.FIVE_WICKETS;
  else if (s.wickets >= 3) bonus += R.THREE_WICKETS;
  if (s.maidens > 0) bowl += s.maidens * R.MAIDEN_OVER;
  if (s.catches > 0) field += s.catches * R.CATCH;
  if (s.stumpings > 0) field += s.stumpings * R.STUMPING;
  if (s.runOuts > 0) field += s.runOuts * R.RUN_OUT;
  if (s.ballsFaced >= R.SR_MIN_BALLS && s.strikeRate > 0) {
    if (s.strikeRate > 170) bonus += R.SR_ABOVE_170;
    else if (s.strikeRate >= 150) bonus += R.SR_150_TO_170;
    else if (s.strikeRate >= 130) bonus += R.SR_130_TO_150;
    else if (s.strikeRate < 60) bonus += R.SR_BELOW_60;
    else if (s.strikeRate < 80) bonus += R.SR_60_TO_80;
    else if (s.strikeRate < 100) bonus += R.SR_80_TO_100;
  }
  if (s.oversBowled >= R.ECON_MIN_OVERS && s.economyRate > 0) {
    if (s.economyRate < 5) bonus += R.ECON_BELOW_5;
    else if (s.economyRate < 6) bonus += R.ECON_5_TO_6;
    else if (s.economyRate < 7) bonus += R.ECON_6_TO_7;
    else if (s.economyRate > 12) bonus += R.ECON_ABOVE_12;
    else if (s.economyRate > 11) bonus += R.ECON_11_TO_12;
    else if (s.economyRate > 10) bonus += R.ECON_10_TO_11;
  }
  return { total: bat + bowl + field + bonus, batting: bat, bowling: bowl, fielding: field, bonus };
}

function extractStats(scorecard: CricbuzzInning[]): Map<string, PlayerStats> {
  const m = new Map<string, PlayerStats>();
  const get = (id: number, name: string) => {
    const k = String(id);
    if (!m.has(k)) m.set(k, {
      id: k, name, runs: 0, wickets: 0, catches: 0, ballsFaced: 0,
      fours: 0, sixes: 0, oversBowled: 0, runsConceded: 0,
      maidens: 0, stumpings: 0, runOuts: 0,
      strikeRate: 0, economyRate: 0, fantasyPoints: 0,
      breakdown: { batting: 0, bowling: 0, fielding: 0, bonus: 0 },
    });
    return m.get(k)!;
  };
  for (const inn of scorecard) {
    for (const b of inn.batsman || []) {
      if (!b.id) continue;
      const p = get(b.id, b.name);
      p.runs += b.runs || 0; p.ballsFaced += b.balls || 0;
      p.fours += b.fours || 0; p.sixes += b.sixes || 0;
    }
    for (const b of inn.bowler || []) {
      if (!b.id) continue;
      const p = get(b.id, b.name);
      p.wickets += b.wickets || 0; p.oversBowled += b.overs || 0;
      p.runsConceded += b.runs || 0; p.maidens += b.maidens || 0;
    }
    for (const f of inn.fielder || []) {
      const ex = Array.from(m.values()).find(
        s => s.name.toLowerCase() === f.name.toLowerCase() ||
          s.name.toLowerCase().includes(f.name.toLowerCase()) ||
          f.name.toLowerCase().includes(s.name.toLowerCase())
      );
      if (ex) { ex.catches += f.catches || 0; ex.stumpings += f.stumpings || 0; ex.runOuts += f.runouts || 0; }
    }
  }
  for (const [, s] of m) {
    if (s.ballsFaced > 0) s.strikeRate = (s.runs / s.ballsFaced) * 100;
    if (s.oversBowled > 0) s.economyRate = s.runsConceded / s.oversBowled;
    const pts = calcPoints(s);
    s.fantasyPoints = pts.total;
    s.breakdown = pts;
  }
  return m;
}

function extractMatchScore(scorecard: CricbuzzInning[]) {
  const innings: { team: string; score: string; overs: string }[] = [];
  for (const inn of scorecard) {
    let runs = 0, wkts = 0, totalBalls = 0;
    for (const b of inn.batsman || []) {
      runs += b.runs || 0;
      if (b.outdec && b.outdec !== 'batting' && b.outdec !== 'not out') wkts++;
    }
    for (const b of inn.bowler || []) {
      const w = Math.floor(b.overs || 0);
      const f = Math.round(((b.overs || 0) - w) * 10);
      totalBalls += w * 6 + f;
    }
    const bowlRuns = (inn.bowler || []).reduce((s, b) => s + (b.runs || 0), 0);
    if (bowlRuns > runs) runs = bowlRuns;
    const ov = Math.floor(totalBalls / 6);
    const ob = totalBalls % 6;
    innings.push({ team: `Innings ${inn.inningsid}`, score: `${runs}/${wkts}`, overs: ob > 0 ? `${ov}.${ob}` : `${ov}` });
  }
  return { innings, status: scorecard.length >= 2 ? 'Complete' : 'In Progress' };
}

function buildIdMap(players: any[], teamPlayers: any[], stats: Map<string, PlayerStats>): Map<string, string> {
  const cbPlayers = Array.from(stats.entries());
  const norm = (s: string) => s.toLowerCase().trim().replace(/[^a-z ]/g, '');
  const idMap = new Map<string, string>();
  const allIds = new Set(teamPlayers.map((tp: any) => tp.player_id));
  for (const ourId of allIds) {
    const pl = players.find((p: any) => p.id === ourId);
    if (!pl) { idMap.set(ourId, ourId); continue; }
    const on = norm(pl.name), op = on.split(' ').filter(Boolean);
    const ol = op[op.length - 1], of_ = op[0];
    let found = false;
    for (const [cbId, cb] of cbPlayers) {
      const cn = norm(cb.name), cp = cn.split(' ').filter(Boolean);
      const cl = cp[cp.length - 1], cf = cp[0];
      if (on === cn || (ol === cl && of_[0] === cf[0]) ||
        (ol === cl && (cf.startsWith(of_) || of_.startsWith(cf))) ||
        (cp.length === 1 && cf === ol) ||
        on.includes(cn) || cn.includes(on) ||
        (ol === cl && ol.length >= 5)) {
        idMap.set(ourId, cbId); found = true; break;
      }
    }
    if (!found) idMap.set(ourId, ourId);
  }
  return idMap;
}

// ─── Handler ─────────────────────────────────────────────────────
export default async function handler(req: any, res: any) {
  if (!RAPIDAPI_KEY) return res.status(500).json({ error: 'RAPIDAPI_KEY not configured' });

  try {
    const now = Date.now();
    const FIVE_HOURS = 5 * 60 * 60 * 1000;

    // 1. Get matches with cricbuzz IDs
    const matches = await supabaseQuery(
      'gully11_ipl_schedule?cricbuzz_match_id=not.is.null&select=id,team_home,team_away,match_date,cricbuzz_match_id'
    );

    const live = (matches || []).filter((m: any) => {
      const t = new Date(m.match_date).getTime();
      return now > t && now < t + FIVE_HOURS;
    });

    if (live.length === 0) return res.status(200).json({ message: 'No live matches', checked: 0 });

    // 2. Get players
    const players = await supabaseQuery('gully11_players?select=id,name');

    const results = [];
    for (const match of live) {
      try {
        // 3. Fetch Cricbuzz scorecard
        const cbRes = await fetch(`https://cricbuzz-cricket.p.rapidapi.com/mcenter/v1/${match.cricbuzz_match_id}/hscard`, {
          headers: { 'x-rapidapi-host': 'cricbuzz-cricket.p.rapidapi.com', 'x-rapidapi-key': RAPIDAPI_KEY },
        });
        if (!cbRes.ok) { results.push({ matchId: match.id, error: `API ${cbRes.status}` }); continue; }

        const cbData = await cbRes.json();
        const scorecard: CricbuzzInning[] = cbData.scorecard || [];
        if (!scorecard.length) { results.push({ matchId: match.id, error: 'No data' }); continue; }

        // 4. Calculate
        const stats = extractStats(scorecard);
        const matchScore = extractMatchScore(scorecard);

        // 5. Get fantasy teams
        const teams = await supabaseQuery(`gully11_fantasy_teams?match_id=eq.${match.id}&select=id,user_id,captain_id,vice_captain_id`);
        const teamIds = (teams || []).map((t: any) => t.id);
        const teamPlayers = teamIds.length > 0
          ? await supabaseQuery(`gully11_fantasy_team_players?team_id=in.(${teamIds.join(',')})&select=team_id,player_id`)
          : [];

        // 6. Map & score
        const idMap = buildIdMap(players || [], teamPlayers || [], stats);
        const teamScores = (teams || []).map((team: any) => {
          const picks = (teamPlayers || []).filter((tp: any) => tp.team_id === team.id);
          let total = 0;
          const ps = picks.map((pick: any) => {
            const mid = idMap.get(pick.player_id) || pick.player_id;
            const st = stats.get(mid);
            const base = st?.fantasyPoints ?? 0;
            const mult = pick.player_id === team.captain_id ? R.CAPTAIN
              : pick.player_id === team.vice_captain_id ? R.VICE_CAPTAIN : 1;
            const pts = Math.round(base * mult * 10) / 10;
            total += pts;
            return { playerId: pick.player_id, basePoints: base, multiplier: mult, totalPoints: pts };
          });
          return { teamId: team.id, userId: team.user_id, totalPoints: Math.round(total * 10) / 10, players: ps };
        }).sort((a: any, b: any) => b.totalPoints - a.totalPoints);

        // 7. Player points map
        const pp: Record<string, any> = {};
        for (const [id, s] of stats.entries()) {
          pp[id] = {
            name: s.name, total: s.fantasyPoints,
            batting: s.breakdown.batting, bowling: s.breakdown.bowling,
            fielding: s.breakdown.fielding, bonus: s.breakdown.bonus,
            runs: s.runs, wickets: s.wickets, catches: s.catches,
            fours: s.fours, sixes: s.sixes, ballsFaced: s.ballsFaced,
            oversBowled: s.oversBowled, runsConceded: s.runsConceded,
            maidens: s.maidens, strikeRate: s.strikeRate, economyRate: s.economyRate,
          };
        }

        // 8. Upsert cache
        await supabaseQuery('gully11_scorecard_cache?on_conflict=match_id', {
          method: 'POST',
          headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
          body: {
            match_id: match.id,
            cricbuzz_match_id: match.cricbuzz_match_id,
            scorecard_data: scorecard,
            match_score: matchScore,
            player_points: pp,
            team_scores: teamScores,
            last_updated: new Date().toISOString(),
          },
        });

        results.push({
          matchId: match.id,
          match: `${match.team_home} vs ${match.team_away}`,
          score: matchScore,
          teams: teamScores.length,
          top: teamScores[0]?.totalPoints ?? 0,
        });
      } catch (e: any) {
        results.push({ matchId: match.id, error: e.message });
      }
    }

    return res.status(200).json({ message: `Processed ${live.length} match(es)`, results });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
