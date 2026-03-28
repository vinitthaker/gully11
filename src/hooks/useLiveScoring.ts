import { useState, useEffect, useCallback, useRef } from 'react';
import * as cricapi from '../lib/cricapi';
import { extractPlayerStats, calculateTeamScore, type TeamScore, type PlayerStats } from '../lib/scoring';
import type { FantasyTeam } from '../types';

// Poll every 3 minutes to stay within 100 API calls/day
// A T20 match ~3.5 hours = 210 min / 3 = 70 calls (scorecard only)
// Leaves ~30 calls for other API usage
const POLL_INTERVAL = 180_000; // 3 minutes

interface UseLiveScoringOptions {
  cricapiMatchId?: string;
  matchStarted: boolean;
  matchEnded: boolean;
  teams: FantasyTeam[];
  enabled: boolean;
}

interface UseLiveScoringResult {
  teamScores: TeamScore[];
  playerStats: Map<string, PlayerStats>;
  liveScore: { t1s?: string; t2s?: string; status?: string } | null;
  isLoading: boolean;
  lastUpdated: number | null;
  error: string | null;
  apiCallsUsed: number;
  refresh: () => Promise<void>;
}

export function useLiveScoring({
  cricapiMatchId,
  matchStarted,
  matchEnded,
  teams,
  enabled,
}: UseLiveScoringOptions): UseLiveScoringResult {
  const [teamScores, setTeamScores] = useState<TeamScore[]>([]);
  const [playerStats, setPlayerStats] = useState<Map<string, PlayerStats>>(new Map());
  const [liveScore, setLiveScore] = useState<{ t1s?: string; t2s?: string; status?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiCallsUsed, setApiCallsUsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const teamsRef = useRef(teams);
  teamsRef.current = teams;

  const fetchAndCalculate = useCallback(async () => {
    if (!cricapiMatchId || !enabled) return;

    // Safety: stop polling if we've used too many API calls (leave buffer)
    if (apiCallsUsed >= 80) {
      console.warn('CricAPI call budget exhausted (80/100). Stopping auto-poll.');
      setError('API call limit reached. Use manual refresh sparingly.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Single API call — scorecard gives us player stats AND match status
      // This is more efficient than calling both scorecard + liveScores
      const scorecard = await cricapi.getMatchScorecard(cricapiMatchId);
      setApiCallsUsed((prev) => prev + 1);

      if (scorecard && scorecard.length > 0) {
        // Extract live score from scorecard innings
        const innings = scorecard.map((inn) => {
          const battingRuns = inn.batting?.reduce((s, b) => s + (b.r || 0), 0) ?? 0;
          const extras = 0; // scorecard doesn't separate extras easily
          return { inning: inn.inning, runs: battingRuns + extras };
        });

        if (innings.length > 0) {
          setLiveScore({
            t1s: innings[0] ? `${innings[0].inning}` : undefined,
            t2s: innings[1] ? `${innings[1].inning}` : undefined,
            status: innings.length >= 2 ? 'In Progress' : `${innings[0]?.inning || 'Live'}`,
          });
        }

        // Calculate points from scorecard
        const stats = extractPlayerStats(scorecard);
        setPlayerStats(stats);

        const currentTeams = teamsRef.current;
        const scores: TeamScore[] = currentTeams.map((team) => {
          const playerIds = team.players.map((p) => p.playerId);
          return calculateTeamScore(stats, playerIds, team.captainId, team.viceCaptainId, team.userId);
        });

        scores.sort((a, b) => b.totalPoints - a.totalPoints);
        setTeamScores(scores);
        setLastUpdated(Date.now());
      }
    } catch (e: any) {
      console.error('Live scoring error:', e);
      setError(e.message || 'Failed to fetch scores');
    } finally {
      setIsLoading(false);
    }
  }, [cricapiMatchId, enabled, apiCallsUsed]);

  // Auto-poll during live matches
  useEffect(() => {
    if (!enabled || !matchStarted || !cricapiMatchId) return;

    // Initial fetch
    fetchAndCalculate();

    // Only poll if match hasn't ended
    if (!matchEnded) {
      intervalRef.current = setInterval(fetchAndCalculate, POLL_INTERVAL);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, matchStarted, matchEnded, cricapiMatchId]); // intentionally exclude fetchAndCalculate to avoid re-creating interval

  return {
    teamScores,
    playerStats,
    liveScore,
    isLoading,
    lastUpdated,
    error,
    apiCallsUsed,
    refresh: fetchAndCalculate,
  };
}
