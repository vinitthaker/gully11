// Supabase Edge Function — auto-refresh fantasy scores
// Called by cron-job.org every 3 minutes
// Only processes matches that are currently live (started < 5 hours ago)

const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// ─── Supabase REST helper ────────────────────────────────────────
async function sb(path: string, opts: any = {}) {
  const method = opts.method || 'GET';
  const headers: Record<string, string> = {
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
  if (opts.prefer) headers['Prefer'] = opts.prefer;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method, headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return method === 'GET' || opts.prefer?.includes('return') ? res.json() : null;
}

// ─── Scoring ─────────────────────────────────────────────────────
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

interface Stats {
  id: string; name: string; runs: number; wickets: number; catches: number;
  ballsFaced: number; fours: number; sixes: number; oversBowled: number;
  runsConceded: number; maidens: number; stumpings: number; runOuts: number;
  strikeRate: number; economyRate: number; fantasyPoints: number;
  breakdown: { batting: number; bowling: number; fielding: number; bonus: number };
}

function calcPts(s: Stats) {
  let bat = 0, bowl = 0, fld = 0, bon = 0;
  if (s.runs > 0) bat += s.runs; if (s.fours > 0) bat += s.fours;
  if (s.sixes > 0) bat += s.sixes * 2;
  if (s.runs >= 100) bon += R.CENTURY; else if (s.runs >= 50) bon += R.HALF_CENTURY;
  if (s.runs === 0 && s.ballsFaced > 0) bat += R.DUCK;
  if (s.wickets > 0) bowl += s.wickets * R.WICKET;
  if (s.wickets >= 5) bon += R.FIVE_WICKETS; else if (s.wickets >= 3) bon += R.THREE_WICKETS;
  if (s.maidens > 0) bowl += s.maidens * R.MAIDEN_OVER;
  if (s.catches > 0) fld += s.catches * R.CATCH;
  if (s.stumpings > 0) fld += s.stumpings * R.STUMPING;
  if (s.runOuts > 0) fld += s.runOuts * R.RUN_OUT;
  if (s.ballsFaced >= R.SR_MIN_BALLS && s.strikeRate > 0) {
    if (s.strikeRate > 170) bon += R.SR_ABOVE_170;
    else if (s.strikeRate >= 150) bon += R.SR_150_TO_170;
    else if (s.strikeRate >= 130) bon += R.SR_130_TO_150;
    else if (s.strikeRate < 60) bon += R.SR_BELOW_60;
    else if (s.strikeRate < 80) bon += R.SR_60_TO_80;
    else if (s.strikeRate < 100) bon += R.SR_80_TO_100;
  }
  if (s.oversBowled >= R.ECON_MIN_OVERS && s.economyRate > 0) {
    if (s.economyRate < 5) bon += R.ECON_BELOW_5;
    else if (s.economyRate < 6) bon += R.ECON_5_TO_6;
    else if (s.economyRate < 7) bon += R.ECON_6_TO_7;
    else if (s.economyRate > 12) bon += R.ECON_ABOVE_12;
    else if (s.economyRate > 11) bon += R.ECON_11_TO_12;
    else if (s.economyRate > 10) bon += R.ECON_10_TO_11;
  }
  return { total: bat + bowl + fld + bon, batting: bat, bowling: bowl, fielding: fld, bonus: bon };
}

function extractStats(scorecard: any[]): Map<string, Stats> {
  const m = new Map<string, Stats>();
  const get = (id: number, name: string) => {
    const k = String(id);
    if (!m.has(k)) m.set(k, { id: k, name, runs: 0, wickets: 0, catches: 0, ballsFaced: 0, fours: 0, sixes: 0, oversBowled: 0, runsConceded: 0, maidens: 0, stumpings: 0, runOuts: 0, strikeRate: 0, economyRate: 0, fantasyPoints: 0, breakdown: { batting: 0, bowling: 0, fielding: 0, bonus: 0 } });
    return m.get(k)!;
  };
  for (const inn of scorecard) {
    for (const b of inn.batsman || []) { if (!b.id) continue; const p = get(b.id, b.name); p.runs += b.runs || 0; p.ballsFaced += b.balls || 0; p.fours += b.fours || 0; p.sixes += b.sixes || 0; }
    for (const b of inn.bowler || []) { if (!b.id) continue; const p = get(b.id, b.name); p.wickets += b.wickets || 0; p.oversBowled += b.overs || 0; p.runsConceded += b.runs || 0; p.maidens += b.maidens || 0; }
    for (const f of inn.fielder || []) {
      const ex = Array.from(m.values()).find(s => s.name.toLowerCase() === f.name.toLowerCase() || s.name.toLowerCase().includes(f.name.toLowerCase()) || f.name.toLowerCase().includes(s.name.toLowerCase()));
      if (ex) { ex.catches += f.catches || 0; ex.stumpings += f.stumpings || 0; ex.runOuts += f.runouts || 0; }
    }
  }
  for (const [, s] of m) {
    if (s.ballsFaced > 0) s.strikeRate = (s.runs / s.ballsFaced) * 100;
    if (s.oversBowled > 0) s.economyRate = s.runsConceded / s.oversBowled;
    const pts = calcPts(s); s.fantasyPoints = pts.total; s.breakdown = pts;
  }
  return m;
}

function extractMatchScore(scorecard: any[]) {
  const innings: { team: string; score: string; overs: string }[] = [];
  for (const inn of scorecard) {
    const team = inn.batteamsname || `Innings ${inn.inningsid}`;
    const score = inn.score !== undefined ? inn.score : 0;
    const wickets = inn.wickets !== undefined ? inn.wickets : 0;
    const overs = inn.overs !== undefined ? String(inn.overs) : '0';
    innings.push({ team, score: `${score}/${wickets}`, overs });
  }
  return { innings, status: scorecard.length >= 2 ? 'Complete' : 'In Progress' };
}

function buildIdMap(players: any[], teamPlayers: any[], stats: Map<string, Stats>): Map<string, string> {
  const cbP = Array.from(stats.entries());
  const norm = (s: string) => s.toLowerCase().trim().replace(/[^a-z ]/g, '');
  const idMap = new Map<string, string>();
  for (const tp of teamPlayers) {
    if (idMap.has(tp.player_id)) continue;
    const pl = players.find((p: any) => p.id === tp.player_id);
    if (!pl) { idMap.set(tp.player_id, tp.player_id); continue; }
    const on = norm(pl.name), op = on.split(' ').filter(Boolean), ol = op[op.length - 1], of_ = op[0];
    let found = false;
    for (const [cbId, cb] of cbP) {
      const cn = norm(cb.name), cp = cn.split(' ').filter(Boolean), cl = cp[cp.length - 1], cf = cp[0];
      if (on === cn || (ol === cl && of_[0] === cf[0]) || (ol === cl && (cf.startsWith(of_) || of_.startsWith(cf))) || (cp.length === 1 && cf === ol) || on.includes(cn) || cn.includes(on) || (ol === cl && ol.length >= 5)) { idMap.set(tp.player_id, cbId); found = true; break; }
    }
    if (!found) idMap.set(tp.player_id, tp.player_id);
  }
  return idMap;
}

// ─── Main ────────────────────────────────────────────────────────
Deno.serve(async (_req) => {
  if (!RAPIDAPI_KEY) return new Response(JSON.stringify({ error: 'RAPIDAPI_KEY not set' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  try {
    const now = Date.now(), FIVE_H = 5 * 60 * 60 * 1000;
    const matches = await sb('gully11_ipl_schedule?cricbuzz_match_id=not.is.null&select=id,team_home,team_away,match_date,cricbuzz_match_id');
    const live = (matches || []).filter((m: any) => { const t = new Date(m.match_date).getTime(); return now > t && now < t + FIVE_H; });
    if (!live.length) return new Response(JSON.stringify({ message: 'No live matches' }), { headers: { 'Content-Type': 'application/json' } });

    const players = await sb('gully11_players?select=id,name');
    const results = [];

    for (const match of live) {
      try {
        const cbRes = await fetch(`https://cricbuzz-cricket.p.rapidapi.com/mcenter/v1/${match.cricbuzz_match_id}/hscard`, { headers: { 'x-rapidapi-host': 'cricbuzz-cricket.p.rapidapi.com', 'x-rapidapi-key': RAPIDAPI_KEY } });
        if (!cbRes.ok) { results.push({ matchId: match.id, error: `API ${cbRes.status}` }); continue; }
        const scorecard = (await cbRes.json()).scorecard || [];
        if (!scorecard.length) { results.push({ matchId: match.id, error: 'No data' }); continue; }

        const stats = extractStats(scorecard);
        const matchScore = extractMatchScore(scorecard);
        const teams = await sb(`gully11_fantasy_teams?match_id=eq.${match.id}&select=id,user_id,captain_id,vice_captain_id`);
        const teamIds = (teams || []).map((t: any) => t.id);
        const teamPlayers = teamIds.length > 0 ? await sb(`gully11_fantasy_team_players?team_id=in.(${teamIds.join(',')})&select=team_id,player_id`) : [];
        const idMap = buildIdMap(players || [], teamPlayers || [], stats);

        const teamScores = (teams || []).map((team: any) => {
          const picks = (teamPlayers || []).filter((tp: any) => tp.team_id === team.id);
          let total = 0;
          const ps = picks.map((pick: any) => {
            const mid = idMap.get(pick.player_id) || pick.player_id;
            const st = stats.get(mid);
            const base = st?.fantasyPoints ?? 0;
            const mult = pick.player_id === team.captain_id ? R.CAPTAIN : pick.player_id === team.vice_captain_id ? R.VICE_CAPTAIN : 1;
            const pts = Math.round(base * mult * 10) / 10;
            total += pts;
            return { playerId: pick.player_id, basePoints: base, multiplier: mult, totalPoints: pts };
          });
          return { teamId: team.id, userId: team.user_id, totalPoints: Math.round(total * 10) / 10, players: ps };
        }).sort((a: any, b: any) => b.totalPoints - a.totalPoints);

        const pp: Record<string, any> = {};
        for (const [id, s] of stats.entries()) {
          pp[id] = { name: s.name, total: s.fantasyPoints, batting: s.breakdown.batting, bowling: s.breakdown.bowling, fielding: s.breakdown.fielding, bonus: s.breakdown.bonus, runs: s.runs, wickets: s.wickets, catches: s.catches, fours: s.fours, sixes: s.sixes, ballsFaced: s.ballsFaced, oversBowled: s.oversBowled, runsConceded: s.runsConceded, maidens: s.maidens, strikeRate: s.strikeRate, economyRate: s.economyRate };
        }

        await sb('gully11_scorecard_cache?on_conflict=match_id', {
          method: 'POST', prefer: 'resolution=merge-duplicates,return=representation',
          body: { match_id: match.id, cricbuzz_match_id: match.cricbuzz_match_id, scorecard_data: scorecard, match_score: matchScore, player_points: pp, team_scores: teamScores, last_updated: new Date().toISOString() },
        });

        results.push({ matchId: match.id, match: `${match.team_home} vs ${match.team_away}`, score: matchScore, teams: teamScores.length, top: teamScores[0]?.totalPoints ?? 0 });
      } catch (e: any) { results.push({ matchId: match.id, error: e.message }); }
    }

    return new Response(JSON.stringify({ message: `Processed ${live.length} match(es)`, results }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
