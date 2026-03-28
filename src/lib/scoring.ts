// Fantasy scoring engine — calculates points from CricAPI scorecard data
// Rules: 1 pt/run, 25 pts/wicket, 10 pts/catch
// Captain: 2x, Vice Captain: 1.5x

import type { ScorecardInning } from './cricapi';

export interface PlayerStats {
  playerId: string;
  name: string;
  runs: number;
  wickets: number;
  catches: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  oversBowled: number;
  runsConceded: number;
  maidens: number;
  stumpings: number;
  runOuts: number;
  fantasyPoints: number;
}

export interface TeamScore {
  userId: string;
  totalPoints: number;
  playerScores: {
    playerId: string;
    name: string;
    basePoints: number;
    multiplier: number;
    totalPoints: number;
    breakdown: { runs: number; wickets: number; catches: number };
  }[];
}

// ─── Calculate fantasy points for a single player ────────────────

export function calculatePlayerPoints(stats: {
  runs: number;
  wickets: number;
  catches: number;
}): number {
  return (stats.runs * 1) + (stats.wickets * 25) + (stats.catches * 10);
}

// ─── Extract player stats from CricAPI scorecard ─────────────────

export function extractPlayerStats(scorecard: ScorecardInning[]): Map<string, PlayerStats> {
  const statsMap = new Map<string, PlayerStats>();

  const getOrCreate = (id: string, name: string): PlayerStats => {
    if (!statsMap.has(id)) {
      statsMap.set(id, {
        playerId: id,
        name,
        runs: 0,
        wickets: 0,
        catches: 0,
        ballsFaced: 0,
        fours: 0,
        sixes: 0,
        oversBowled: 0,
        runsConceded: 0,
        maidens: 0,
        stumpings: 0,
        runOuts: 0,
        fantasyPoints: 0,
      });
    }
    return statsMap.get(id)!;
  };

  for (const inning of scorecard) {
    // Batting stats
    if (inning.batting) {
      for (const bat of inning.batting) {
        if (!bat.id) continue;
        const player = getOrCreate(bat.id, bat.name);
        player.runs += bat.r || 0;
        player.ballsFaced += bat.b || 0;
        player.fours += bat['4s'] || 0;
        player.sixes += bat['6s'] || 0;
      }
    }

    // Bowling stats
    if (inning.bowling) {
      for (const bowl of inning.bowling) {
        if (!bowl.id) continue;
        const player = getOrCreate(bowl.id, bowl.name);
        player.wickets += bowl.w || 0;
        player.oversBowled += bowl.o || 0;
        player.runsConceded += bowl.r || 0;
        player.maidens += bowl.m || 0;
      }
    }

    // Catching/fielding stats
    if (inning.catching) {
      for (const field of inning.catching) {
        if (!field.id) continue;
        const player = getOrCreate(field.id, field.name);
        player.catches += field.catches || 0;
        player.stumpings += field.stumpings || 0;
        player.runOuts += field.runouts || 0;
      }
    }
  }

  // Calculate fantasy points for each player
  for (const [, stats] of statsMap) {
    stats.fantasyPoints = calculatePlayerPoints({
      runs: stats.runs,
      wickets: stats.wickets,
      catches: stats.catches,
    });
  }

  return statsMap;
}

// ─── Calculate team score from player stats ──────────────────────

export function calculateTeamScore(
  playerStats: Map<string, PlayerStats>,
  teamPlayerIds: string[],
  captainId: string,
  viceCaptainId: string,
  userId: string
): TeamScore {
  const playerScores: TeamScore['playerScores'] = [];
  let totalPoints = 0;

  for (const playerId of teamPlayerIds) {
    const stats = playerStats.get(playerId);
    const basePoints = stats?.fantasyPoints ?? 0;
    const multiplier = playerId === captainId ? 2 : playerId === viceCaptainId ? 1.5 : 1;
    const pts = Math.round(basePoints * multiplier * 10) / 10;

    playerScores.push({
      playerId,
      name: stats?.name ?? 'Unknown',
      basePoints,
      multiplier,
      totalPoints: pts,
      breakdown: {
        runs: stats?.runs ?? 0,
        wickets: stats?.wickets ?? 0,
        catches: stats?.catches ?? 0,
      },
    });

    totalPoints += pts;
  }

  // Sort by total points desc
  playerScores.sort((a, b) => b.totalPoints - a.totalPoints);

  return {
    userId,
    totalPoints: Math.round(totalPoints * 10) / 10,
    playerScores,
  };
}

// ─── Rank teams and calculate payouts ────────────────────────────

export function rankTeamsAndCalculatePayouts(
  teamScores: TeamScore[],
  entryAmount: number,
  _memberCount: number,
  payoutTable: number[]
): {
  userId: string;
  rank: number;
  totalPoints: number;
  payout: number;
  netAmount: number;
}[] {
  // Sort by points descending
  const sorted = [...teamScores].sort((a, b) => b.totalPoints - a.totalPoints);

  return sorted.map((team, i) => {
    const rank = i + 1;
    const payout = payoutTable[rank - 1] || 0;
    return {
      userId: team.userId,
      rank,
      totalPoints: team.totalPoints,
      payout,
      netAmount: payout - entryAmount,
    };
  });
}
