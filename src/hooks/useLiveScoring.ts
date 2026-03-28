import { useState, useEffect, useCallback, useRef } from 'react';
import * as cricapi from '../lib/cricapi';
import { extractPlayerStats, calculateTeamScore, type TeamScore, type PlayerStats } from '../lib/scoring';
import type { FantasyTeam } from '../types';

const POLL_INTERVAL = 90_000; // 90 seconds

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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAndCalculate = useCallback(async () => {
    if (!cricapiMatchId || !enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch scorecard and live scores in parallel
      const [scorecard, scores] = await Promise.all([
        cricapi.getMatchScorecard(cricapiMatchId).catch(() => null),
        cricapi.getLiveScores().catch(() => []),
      ]);

      // Update live score
      if (scores.length > 0) {
        const liveMatch = scores.find((s: any) => s.id === cricapiMatchId);
        if (liveMatch) {
          const scoreArr = (liveMatch as any).score || [];
          const innings = scoreArr.map((s: any) => `${s.r}/${s.w} (${s.o})`);
          setLiveScore({
            t1s: innings[0],
            t2s: innings[1],
            status: liveMatch.status,
          });
        }
      }

      // Calculate points from scorecard
      if (scorecard && scorecard.length > 0) {
        const stats = extractPlayerStats(scorecard);
        setPlayerStats(stats);

        // Calculate scores for all teams
        const scores: TeamScore[] = teams.map((team) => {
          const playerIds = team.players.map((p) => p.playerId);
          return calculateTeamScore(stats, playerIds, team.captainId, team.viceCaptainId, team.userId);
        });

        // Sort by total points
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
  }, [cricapiMatchId, teams, enabled]);

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
  }, [enabled, matchStarted, matchEnded, cricapiMatchId, fetchAndCalculate]);

  return {
    teamScores,
    playerStats,
    liveScore,
    isLoading,
    lastUpdated,
    error,
    refresh: fetchAndCalculate,
  };
}
