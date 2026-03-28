// Cricbuzz API Integration via RapidAPI
// Docs: https://rapidapi.com/cricbuzz-cricket/api/cricbuzz-cricket

const RAPIDAPI_KEY = import.meta.env.VITE_RAPIDAPI_KEY || '';
const BASE_URL = 'https://cricbuzz-cricket.p.rapidapi.com';

// ─── Types ──────────────────────────────────────────────────────

export interface CricbuzzBatsman {
  id: number;
  name: string;
  balls: number;
  runs: number;
  fours: number;
  sixes: number;
  strkrate: string;
  outdec: string;
  iscaptain: boolean;
  iskeeper: boolean;
}

export interface CricbuzzBowler {
  id: number;
  name: string;
  overs: number;
  maidens: number;
  runs: number;
  wickets: number;
  economy: string;
}

export interface CricbuzzFielder {
  name: string;
  catches: number;
  runouts: number;
  stumpings: number;
}

export interface CricbuzzInning {
  inningsid: number;
  batsman: CricbuzzBatsman[];
  bowler: CricbuzzBowler[];
  fielder?: CricbuzzFielder[];
}

export interface CricbuzzMatchInfo {
  matchId: number;
  seriesId: number;
  matchDesc: string;
  matchFormat: string;
  startDate: string;
  state: string;
  status: string;
  team1: { teamId: number; teamSName: string; teamName: string };
  team2: { teamId: number; teamSName: string; teamName: string };
}

// ─── API Calls ──────────────────────────────────────────────────

async function apiFetch<T>(path: string): Promise<T> {
  if (!RAPIDAPI_KEY) throw new Error('RapidAPI key not configured');

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'x-rapidapi-host': 'cricbuzz-cricket.p.rapidapi.com',
      'x-rapidapi-key': RAPIDAPI_KEY,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`Cricbuzz API error ${res.status}:`, text);
    throw new Error(`Cricbuzz API error: ${res.status}`);
  }

  return res.json();
}

/** Get scorecard for a match */
export async function getScorecard(matchId: number): Promise<CricbuzzInning[]> {
  const data = await apiFetch<{ scorecard: CricbuzzInning[] }>(`/mcenter/v1/${matchId}/hscard`);
  return data.scorecard || [];
}

/** Get match info */
export async function getMatchInfo(matchId: number): Promise<CricbuzzMatchInfo> {
  const data = await apiFetch<{ matchInfo: CricbuzzMatchInfo }>(`/mcenter/v1/${matchId}`);
  return data.matchInfo;
}

/** Get live matches */
export async function getLiveMatches(): Promise<any> {
  return apiFetch('/matches/v1/live');
}

/** Get all matches for IPL series */
export async function getSeriesMatches(seriesId: number): Promise<CricbuzzMatchInfo[]> {
  const data = await apiFetch<{ matchDetails: any[] }>(`/series/v1/${seriesId}`);
  const matches: CricbuzzMatchInfo[] = [];
  for (const m of data.matchDetails || []) {
    const list = m.matchDetailsMap?.match || [];
    for (const mi of list) {
      if (mi.matchInfo) matches.push(mi.matchInfo);
    }
  }
  return matches;
}

// ─── IPL Team Code Mapping ──────────────────────────────────────

const TEAM_CODE_MAP: Record<string, string> = {
  'CSK': 'CSK', 'MI': 'MI', 'RCB': 'RCB', 'SRH': 'SRH',
  'KKR': 'KKR', 'DC': 'DC', 'PBKS': 'PBKS', 'RR': 'RR',
  'GT': 'GT', 'LSG': 'LSG',
};

export function resolveTeamCode(shortName: string): string | undefined {
  return TEAM_CODE_MAP[shortName.toUpperCase()];
}
