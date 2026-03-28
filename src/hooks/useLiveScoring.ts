import { useState, useEffect, useCallback, useRef } from 'react';
import * as cricbuzz from '../lib/cricbuzz';
import { extractPlayerStatsFromCricbuzz, calculateTeamScore, type TeamScore, type PlayerStats } from '../lib/scoring';
import type { FantasyTeam } from '../types';
import { IPL_PLAYERS } from '../utils/players';

// Poll every 3 minutes — Cricbuzz free tier: 200 requests/month
// A T20 match ~3.5h = ~70 polls. Budget carefully.
const POLL_INTERVAL = 180_000; // 3 minutes

interface UseLiveScoringOptions {
  cricbuzzMatchId?: number;
  matchStarted: boolean;
  matchEnded: boolean;
  teams: FantasyTeam[];
  enabled: boolean;
}

interface UseLiveScoringResult {
  teamScores: TeamScore[];
  playerStats: Map<string, PlayerStats>;
  liveScore: { status?: string } | null;
  isLoading: boolean;
  lastUpdated: number | null;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useLiveScoring({
  cricbuzzMatchId,
  matchStarted,
  matchEnded,
  teams,
  enabled,
}: UseLiveScoringOptions): UseLiveScoringResult {
  const [teamScores, setTeamScores] = useState<TeamScore[]>([]);
  const [playerStats, setPlayerStats] = useState<Map<string, PlayerStats>>(new Map());
  const [liveScore, setLiveScore] = useState<{ status?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const teamsRef = useRef(teams);
  teamsRef.current = teams;

  const fetchAndCalculate = useCallback(async () => {
    if (!cricbuzzMatchId || !enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      // Single API call — Cricbuzz scorecard
      const scorecard = await cricbuzz.getScorecard(cricbuzzMatchId);

      if (scorecard && scorecard.length > 0) {
        setLiveScore({ status: scorecard.length >= 2 ? 'In Progress' : 'Innings 1' });

        // Extract stats using Cricbuzz format
        const stats = extractPlayerStatsFromCricbuzz(scorecard);
        setPlayerStats(stats);

        // Build name-based mapping: our player ID → Cricbuzz player ID (string)
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

            // 1. Exact full name
            if (ourName === cbName) return cbId;

            // 2. Last name + first letter (e.g. "V Kohli" = "Virat Kohli")
            if (ourLast === cbLast && ourFirst[0] === cbFirst[0]) return cbId;

            // 3. Short form prefix (e.g. "Phil Salt" vs "Philip Salt")
            if (ourLast === cbLast && (cbFirst.startsWith(ourFirst) || ourFirst.startsWith(cbFirst))) return cbId;

            // 4. Cricbuzz often uses just last name (e.g. "Head", "Klaasen")
            if (cbParts.length === 1 && cbFirst === ourLast) return cbId;

            // 5. Our name contains cricbuzz name or vice versa (handles "Bhuvneshwar" vs "Bhuvneshwar Kumar")
            if (ourName.includes(cbName) || cbName.includes(ourName)) return cbId;

            // 6. Unique long surname match (5+ chars)
            if (ourLast === cbLast && ourLast.length >= 5) return cbId;
          }

          return ourPlayerId; // No match — 0 points
        };

        const currentTeams = teamsRef.current;
        const scores: TeamScore[] = currentTeams.map((team) => {
          const mappedPlayerIds = team.players.map((p) => mapPlayerToCricbuzz(p.playerId));
          const mappedCaptainId = mapPlayerToCricbuzz(team.captainId);
          const mappedVCId = mapPlayerToCricbuzz(team.viceCaptainId);
          return calculateTeamScore(stats, mappedPlayerIds, mappedCaptainId, mappedVCId, team.userId);
        });

        scores.sort((a, b) => b.totalPoints - a.totalPoints);
        setTeamScores(scores);
        setLastUpdated(Date.now());
      }
    } catch (e: any) {
      console.error('Live scoring error:', e);
      const msg = e.message || 'Failed to fetch scores';
      setError(msg);

      // Stop polling on API errors
      if (msg.includes('429') || msg.includes('limit') || msg.includes('401')) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [cricbuzzMatchId, enabled]);

  // Auto-poll during live matches
  useEffect(() => {
    if (!enabled || !matchStarted || !cricbuzzMatchId) return;

    fetchAndCalculate();

    if (!matchEnded) {
      intervalRef.current = setInterval(fetchAndCalculate, POLL_INTERVAL);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, matchStarted, matchEnded, cricbuzzMatchId]);

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
