import { useState, useEffect, useCallback, useRef } from 'react';
import * as cricbuzz from '../lib/cricbuzz';
import * as db from '../lib/db';
import { extractPlayerStatsFromCricbuzz, calculateTeamScore, type TeamScore, type PlayerStats } from '../lib/scoring';
import type { FantasyTeam } from '../types';
import { IPL_PLAYERS } from '../utils/players';

// Architecture:
// - Admin clicks "Refresh Scores" → calls Cricbuzz API → calculates points → saves to Supabase cache
// - All users read from the Supabase cache (no direct API calls)
// - This conserves API calls (200/month on free tier)

interface UseLiveScoringOptions {
  cricbuzzMatchId?: number;
  matchId: number;
  matchStarted: boolean;
  teams: FantasyTeam[];
  enabled: boolean;
  isAdmin: boolean;
  authUserId?: string;
}

interface MatchScoreInfo {
  innings: { team: string; score: string; overs: string }[];
  status: string;
}

interface UseLiveScoringResult {
  teamScores: TeamScore[];
  playerStats: Map<string, PlayerStats>;
  playerIdMap: Map<string, string>;
  matchScore: MatchScoreInfo | null;
  isLoading: boolean;
  lastUpdated: number | null;
  error: string | null;
  refresh: () => Promise<void>;  // Admin: fetches from API + saves to cache
  isRefreshingFromApi: boolean;
}

// Build player name → ID mapping for matching our players to Cricbuzz players
function buildPlayerIdMap(
  teams: FantasyTeam[],
  stats: Map<string, PlayerStats>
): Map<string, string> {
  const cricbuzzPlayers = Array.from(stats.entries());
  const normalize = (s: string) => s.toLowerCase().trim().replace(/[^a-z ]/g, '');

  const mapPlayerToCricbuzz = (ourPlayerId: string): string => {
    const player = IPL_PLAYERS.find((p) => p.id === ourPlayerId);
    if (!player) return ourPlayerId;

    const ourName = normalize(player.name);
    const ourParts = ourName.split(' ').filter(Boolean);
    const ourLast = ourParts[ourParts.length - 1];
    const ourFirst = ourParts[0];

    for (const [cbId, cbPlayer] of cricbuzzPlayers) {
      const cbName = normalize(cbPlayer.name);
      const cbParts = cbName.split(' ').filter(Boolean);
      const cbLast = cbParts[cbParts.length - 1];
      const cbFirst = cbParts[0];

      if (ourName === cbName) return cbId;
      if (ourLast === cbLast && ourFirst[0] === cbFirst[0]) return cbId;
      if (ourLast === cbLast && (cbFirst.startsWith(ourFirst) || ourFirst.startsWith(cbFirst))) return cbId;
      if (cbParts.length === 1 && cbFirst === ourLast) return cbId;
      if (ourName.includes(cbName) || cbName.includes(ourName)) return cbId;
      if (ourLast === cbLast && ourLast.length >= 5) return cbId;
    }

    return ourPlayerId;
  };

  const idMap = new Map<string, string>();
  for (const team of teams) {
    for (const p of team.players) {
      if (!idMap.has(p.playerId)) {
        idMap.set(p.playerId, mapPlayerToCricbuzz(p.playerId));
      }
    }
    if (!idMap.has(team.captainId)) idMap.set(team.captainId, mapPlayerToCricbuzz(team.captainId));
    if (!idMap.has(team.viceCaptainId)) idMap.set(team.viceCaptainId, mapPlayerToCricbuzz(team.viceCaptainId));
  }
  return idMap;
}

// Extract match score summary from Cricbuzz scorecard
function extractMatchScore(scorecard: cricbuzz.CricbuzzInning[]): MatchScoreInfo {
  const innings: { team: string; score: string; overs: string }[] = [];

  for (const inning of scorecard) {
    // Sum runs and wickets from batsmen
    let totalRuns = 0;
    let totalWickets = 0;
    let maxOvers = '0';
    const batsmen = inning.batsman || [];

    for (const bat of batsmen) {
      totalRuns += bat.runs || 0;
      if (bat.outdec && bat.outdec !== 'batting' && bat.outdec !== 'not out') {
        totalWickets++;
      }
    }

    // Get overs from bowlers (max overs in the inning)
    const bowlers = inning.bowler || [];
    let totalBalls = 0;
    for (const bowl of bowlers) {
      const overs = bowl.overs || 0;
      const whole = Math.floor(overs);
      const frac = Math.round((overs - whole) * 10);
      totalBalls += whole * 6 + frac;
    }
    const overWhole = Math.floor(totalBalls / 6);
    const overBalls = totalBalls % 6;
    maxOvers = overBalls > 0 ? `${overWhole}.${overBalls}` : `${overWhole}`;

    // Also add extras if we can calculate from bowler runs vs batsman runs
    const bowlerRuns = bowlers.reduce((sum, b) => sum + (b.runs || 0), 0);
    if (bowlerRuns > totalRuns) {
      totalRuns = bowlerRuns; // Bowler runs include extras
    }

    // Try to determine team name from batting order
    const teamName = `Innings ${inning.inningsid}`;

    innings.push({
      team: teamName,
      score: `${totalRuns}/${totalWickets}`,
      overs: maxOvers,
    });
  }

  return {
    innings,
    status: scorecard.length >= 2 ? 'Complete' : 'In Progress',
  };
}

export function useLiveScoring({
  cricbuzzMatchId,
  matchId,
  matchStarted,
  teams,
  enabled,
  isAdmin,
  authUserId,
}: UseLiveScoringOptions): UseLiveScoringResult {
  const [teamScores, setTeamScores] = useState<TeamScore[]>([]);
  const [playerStats, setPlayerStats] = useState<Map<string, PlayerStats>>(new Map());
  const [playerIdMap, setPlayerIdMap] = useState<Map<string, string>>(new Map());
  const [matchScore, setMatchScore] = useState<MatchScoreInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshingFromApi, setIsRefreshingFromApi] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const teamsRef = useRef(teams);
  teamsRef.current = teams;

  // Calculate team scores from player stats
  const calculateScores = useCallback((stats: Map<string, PlayerStats>, currentTeams: FantasyTeam[]) => {
    const idMap = buildPlayerIdMap(currentTeams, stats);
    setPlayerIdMap(idMap);

    const scores: TeamScore[] = currentTeams.map((team) => {
      const mappedPlayerIds = team.players.map((p) => idMap.get(p.playerId) || p.playerId);
      const mappedCaptainId = idMap.get(team.captainId) || team.captainId;
      const mappedVCId = idMap.get(team.viceCaptainId) || team.viceCaptainId;
      return calculateTeamScore(stats, mappedPlayerIds, mappedCaptainId, mappedVCId, team.userId);
    });

    scores.sort((a, b) => b.totalPoints - a.totalPoints);
    setTeamScores(scores);
    setPlayerStats(stats);
    return { scores, idMap };
  }, []);

  // Load cached data from Supabase (all users)
  const loadFromCache = useCallback(async () => {
    if (!matchId || !enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const cache = await db.fetchScorecardCache(matchId);
      if (cache && cache.scorecardData) {
        // Re-extract stats from cached scorecard data
        const scorecard = cache.scorecardData as cricbuzz.CricbuzzInning[];
        const stats = extractPlayerStatsFromCricbuzz(scorecard);

        calculateScores(stats, teamsRef.current);
        setMatchScore(cache.matchScore);
        setLastUpdated(new Date(cache.lastUpdated).getTime());
      }
    } catch (e: any) {
      console.error('Failed to load scorecard cache:', e);
      // Don't show error for cache miss — just no data yet
    } finally {
      setIsLoading(false);
    }
  }, [matchId, enabled, calculateScores]);

  // Admin: fetch from Cricbuzz API, calculate, and save to cache
  const refreshFromApi = useCallback(async () => {
    if (!cricbuzzMatchId || !enabled || !authUserId) return;

    setIsRefreshingFromApi(true);
    setError(null);

    try {
      // 1. Fetch scorecard from Cricbuzz API
      const scorecard = await cricbuzz.getScorecard(cricbuzzMatchId);
      if (!scorecard || scorecard.length === 0) {
        setError('No scorecard data available yet');
        return;
      }

      // 2. Extract stats
      const stats = extractPlayerStatsFromCricbuzz(scorecard);

      // 3. Extract match score summary
      const score = extractMatchScore(scorecard);

      // 4. Calculate team scores
      const { scores } = calculateScores(stats, teamsRef.current);

      // 5. Build player points map for cache
      const playerPointsMap: Record<string, any> = {};
      for (const [id, s] of stats.entries()) {
        playerPointsMap[id] = {
          name: s.name,
          total: s.fantasyPoints,
          batting: s.breakdown.batting,
          bowling: s.breakdown.bowling,
          fielding: s.breakdown.fielding,
          bonus: s.breakdown.bonus,
          runs: s.runs,
          wickets: s.wickets,
          catches: s.catches,
          fours: s.fours,
          sixes: s.sixes,
          ballsFaced: s.ballsFaced,
          oversBowled: s.oversBowled,
          runsConceded: s.runsConceded,
          maidens: s.maidens,
          strikeRate: s.strikeRate,
          economyRate: s.economyRate,
        };
      }

      // 6. Save to Supabase cache
      await db.saveScorecardCache(
        matchId,
        String(cricbuzzMatchId),
        scorecard,
        score,
        playerPointsMap,
        scores,
        authUserId
      );

      setMatchScore(score);
      setLastUpdated(Date.now());
    } catch (e: any) {
      console.error('API refresh error:', e);
      setError(e.message || 'Failed to fetch scores from API');
    } finally {
      setIsRefreshingFromApi(false);
    }
  }, [cricbuzzMatchId, matchId, enabled, authUserId, calculateScores]);

  // On mount: load from cache (everyone)
  useEffect(() => {
    if (!enabled || !matchStarted) return;
    loadFromCache();
  }, [enabled, matchStarted, loadFromCache]);

  // Auto-refresh cache every 30 seconds (reads from Supabase, not API)
  useEffect(() => {
    if (!enabled || !matchStarted) return;
    const interval = setInterval(loadFromCache, 30_000);
    return () => clearInterval(interval);
  }, [enabled, matchStarted, loadFromCache]);

  // Admin auto-refresh: call Cricbuzz API every 3 minutes and save to cache
  // Only runs if admin has the match page open — saves to Supabase so all users see it
  useEffect(() => {
    if (!enabled || !matchStarted || !isAdmin || !cricbuzzMatchId || !authUserId) return;

    // First refresh on mount (admin only)
    refreshFromApi();

    const interval = setInterval(refreshFromApi, 3 * 60 * 1000); // Every 3 minutes
    return () => clearInterval(interval);
  }, [enabled, matchStarted, isAdmin, cricbuzzMatchId, authUserId]);

  return {
    teamScores,
    playerStats,
    playerIdMap,
    matchScore,
    isLoading,
    lastUpdated,
    error,
    refresh: refreshFromApi,
    isRefreshingFromApi,
  };
}
