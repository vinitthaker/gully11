// CricAPI Integration for live scores & fantasy points
// Docs: https://cricketdata.org/how-to-use-fantasy-cricket-api.aspx

const API_KEY = import.meta.env.VITE_CRICAPI_KEY || '';
const BASE_URL = 'https://api.cricapi.com/v1';

// ─── Types ──────────────────────────────────────────────────────

export interface CricAPIMatch {
  id: string;
  name: string;
  matchType: string;
  status: string;
  venue: string;
  date: string;
  dateTimeGMT: string;
  teams: string[];
  teamInfo: { name: string; shortname: string; img: string }[];
  fantasyEnabled: boolean;
  matchStarted: boolean;
  matchEnded: boolean;
  score?: { r: number; w: number; o: number; inning: string }[];
}

export interface PlayerPoints {
  id: string;
  name: string;
  points: number;
}

export interface MatchPointsResponse {
  innings: {
    inning: string;
    batting: PlayerPoints[];
    bowling: PlayerPoints[];
    catching: PlayerPoints[];
  }[];
  totals: PlayerPoints[];
}

export interface BattingEntry {
  id: string;
  name: string;
  r: number;
  b: number;
  '4s': number;
  '6s': number;
  sr: number;
  dismissal: string;
  'dismissal-text': string;
}

export interface BowlingEntry {
  id: string;
  name: string;
  o: number;
  m: number;
  r: number;
  w: number;
  nb: number;
  wd: number;
  eco: number;
}

export interface ScorecardInning {
  inning: string;
  batting: BattingEntry[];
  bowling: BowlingEntry[];
  catching: { id: string; name: string; catches: number; stumpings: number; runouts: number }[];
}

// ─── API Calls ──────────────────────────────────────────────────

async function apiFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  if (!API_KEY) throw new Error('CricAPI key not configured');

  const url = new URL(`${BASE_URL}/${endpoint}`);
  url.searchParams.set('apikey', API_KEY);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`CricAPI error: ${res.status}`);

  const json = await res.json();
  if (json.status !== 'success') {
    console.error(`CricAPI ${endpoint} failed:`, json);
    throw new Error(json.reason || json.status || 'CricAPI request failed');
  }

  return json.data;
}

/** Get live/current matches */
export async function getCurrentMatches(): Promise<CricAPIMatch[]> {
  return apiFetch<CricAPIMatch[]>('currentMatches', { offset: '0' });
}

/** Get all matches for a series (e.g. IPL) */
export async function getSeriesMatches(seriesId: string): Promise<{ matchList: CricAPIMatch[] }> {
  return apiFetch('series_info', { id: seriesId });
}

/** Search for a series by name */
export async function searchSeries(name: string): Promise<{ id: string; name: string }[]> {
  return apiFetch('series', { search: name });
}

/** Get live score for current matches */
export async function getLiveScores(): Promise<CricAPIMatch[]> {
  return apiFetch<CricAPIMatch[]>('cricScore');
}

/** Get detailed scorecard for a match */
export async function getMatchScorecard(matchId: string): Promise<ScorecardInning[]> {
  const data = await apiFetch<{ scorecard: ScorecardInning[] }>('match_scorecard', { id: matchId });
  return data.scorecard || [];
}

/** Get pre-calculated fantasy points for a match */
export async function getMatchPoints(matchId: string): Promise<MatchPointsResponse> {
  return apiFetch<MatchPointsResponse>('match_points', { id: matchId });
}

/** Get match info */
export async function getMatchInfo(matchId: string): Promise<CricAPIMatch> {
  return apiFetch<CricAPIMatch>('match_info', { id: matchId });
}

// ─── Helpers ────────────────────────────────────────────────────

/** Map CricAPI team shortnames to our team codes */
const TEAM_CODE_MAP: Record<string, string> = {
  'KKR': 'KKR',
  'RCB': 'RCB',
  'SRH': 'SRH',
  'CSK': 'CSK',
  'MI': 'MI',
  'DC': 'DC',
  'LSG': 'LSG',
  'GT': 'GT',
  'PBKS': 'PBKS',
  'RR': 'RR',
  // Common alternate names
  'Kolkata Knight Riders': 'KKR',
  'Royal Challengers Bengaluru': 'RCB',
  'Royal Challengers Bangalore': 'RCB',
  'Sunrisers Hyderabad': 'SRH',
  'Chennai Super Kings': 'CSK',
  'Mumbai Indians': 'MI',
  'Delhi Capitals': 'DC',
  'Lucknow Super Giants': 'LSG',
  'Gujarat Titans': 'GT',
  'Punjab Kings': 'PBKS',
  'Rajasthan Royals': 'RR',
};

export function resolveTeamCode(name: string): string | undefined {
  return TEAM_CODE_MAP[name] || TEAM_CODE_MAP[name.trim()];
}

/** Find CricAPI match ID that corresponds to our schedule match */
export function findCricAPIMatchId(
  cricMatches: CricAPIMatch[],
  teamHome: string,
  teamAway: string,
  matchDate: string // YYYY-MM-DD
): string | undefined {
  return cricMatches.find((m) => {
    const teams = m.teams.map((t) => resolveTeamCode(t)).filter(Boolean);
    const dateMatch = m.date === matchDate || m.dateTimeGMT?.startsWith(matchDate);
    return dateMatch && teams.includes(teamHome) && teams.includes(teamAway);
  })?.id;
}

/** Calculate total fantasy points for a user's team from CricAPI match points */
export function calculateTeamPoints(
  matchPoints: MatchPointsResponse,
  playerIds: string[],
  captainId: string,
  viceCaptainId: string
): { totalPoints: number; playerPoints: Record<string, number> } {
  const playerPointsMap: Record<string, number> = {};

  // Use totals array for per-player total points
  for (const p of matchPoints.totals) {
    if (playerIds.includes(p.id)) {
      playerPointsMap[p.id] = p.points;
    }
  }

  // Calculate total with C/VC multipliers
  let totalPoints = 0;
  for (const pid of playerIds) {
    const pts = playerPointsMap[pid] || 0;
    if (pid === captainId) {
      totalPoints += pts * 2;
    } else if (pid === viceCaptainId) {
      totalPoints += pts * 1.5;
    } else {
      totalPoints += pts;
    }
  }

  return { totalPoints: Math.round(totalPoints * 10) / 10, playerPoints: playerPointsMap };
}
