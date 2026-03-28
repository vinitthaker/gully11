// Fantasy scoring engine — Dream11-inspired hybrid scoring
// Core rules always apply, advanced rules only when data is available

import type { ScorecardInning } from './cricapi';

// ─── Scoring Rules ──────────────────────────────────────────────

export const SCORING_RULES = {
  // Batting (Core)
  RUN: 1,
  FOUR_BONUS: 1,       // +1 per boundary (on top of run points)
  SIX_BONUS: 2,        // +2 per six (on top of run points)
  HALF_CENTURY: 8,     // 50+ runs bonus
  CENTURY: 16,         // 100+ runs bonus

  // Bowling (Core)
  WICKET: 25,
  THREE_WICKETS: 8,    // 3+ wickets bonus
  FIVE_WICKETS: 16,    // 5+ wickets bonus

  // Fielding (Core)
  CATCH: 8,
  RUN_OUT: 12,
  STUMPING: 12,

  // Multipliers
  CAPTAIN: 2,
  VICE_CAPTAIN: 1.5,

  // Advanced (optional — only if data available)
  // Strike Rate bonuses (min 10 balls faced)
  SR_ABOVE_170: 6,
  SR_150_TO_170: 4,
  SR_130_TO_150: 2,
  SR_BELOW_60: -6,
  SR_60_TO_80: -4,
  SR_80_TO_100: -2,
  SR_MIN_BALLS: 10,

  // Economy Rate bonuses (min 2 overs bowled)
  ECON_BELOW_5: 6,
  ECON_5_TO_6: 4,
  ECON_6_TO_7: 2,
  ECON_10_TO_11: -2,
  ECON_11_TO_12: -4,
  ECON_ABOVE_12: -6,
  ECON_MIN_OVERS: 2,

  // Maiden over
  MAIDEN_OVER: 12,

  // Duck (0 runs, out, min 1 ball faced)
  DUCK: -3,
} as const;

// ─── Types ──────────────────────────────────────────────────────

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
  strikeRate: number;
  economyRate: number;
  fantasyPoints: number;
  breakdown: PointBreakdown;
}

export interface PointBreakdown {
  batting: number;
  bowling: number;
  fielding: number;
  bonus: number;
  details: string[];
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
    breakdown: {
      runs: number;
      wickets: number;
      catches: number;
      fours: number;
      sixes: number;
      batting: number;
      bowling: number;
      fielding: number;
      bonus: number;
    };
  }[];
}

// ─── Calculate fantasy points for a single player ────────────────

export function calculatePlayerPoints(stats: {
  runs: number;
  fours: number;
  sixes: number;
  ballsFaced: number;
  wickets: number;
  catches: number;
  stumpings: number;
  runOuts: number;
  oversBowled: number;
  runsConceded: number;
  maidens: number;
  strikeRate: number;
  economyRate: number;
}): { total: number; breakdown: PointBreakdown } {
  let batting = 0;
  let bowling = 0;
  let fielding = 0;
  let bonus = 0;
  const details: string[] = [];

  // ─── Batting ─────────────────────────────────────────
  if (stats.runs > 0) {
    batting += stats.runs * SCORING_RULES.RUN;
    details.push(`${stats.runs} runs = ${stats.runs * SCORING_RULES.RUN}`);
  }

  if (stats.fours > 0) {
    const fourBonus = stats.fours * SCORING_RULES.FOUR_BONUS;
    batting += fourBonus;
    details.push(`${stats.fours} fours = +${fourBonus}`);
  }

  if (stats.sixes > 0) {
    const sixBonus = stats.sixes * SCORING_RULES.SIX_BONUS;
    batting += sixBonus;
    details.push(`${stats.sixes} sixes = +${sixBonus}`);
  }

  if (stats.runs >= 100) {
    bonus += SCORING_RULES.CENTURY;
    details.push(`Century bonus = +${SCORING_RULES.CENTURY}`);
  } else if (stats.runs >= 50) {
    bonus += SCORING_RULES.HALF_CENTURY;
    details.push(`Half-century bonus = +${SCORING_RULES.HALF_CENTURY}`);
  }

  // Duck penalty (0 runs, must have faced at least 1 ball)
  if (stats.runs === 0 && stats.ballsFaced > 0) {
    batting += SCORING_RULES.DUCK;
    details.push(`Duck = ${SCORING_RULES.DUCK}`);
  }

  // ─── Bowling ─────────────────────────────────────────
  if (stats.wickets > 0) {
    bowling += stats.wickets * SCORING_RULES.WICKET;
    details.push(`${stats.wickets} wickets = ${stats.wickets * SCORING_RULES.WICKET}`);
  }

  if (stats.wickets >= 5) {
    bonus += SCORING_RULES.FIVE_WICKETS;
    details.push(`5-wicket bonus = +${SCORING_RULES.FIVE_WICKETS}`);
  } else if (stats.wickets >= 3) {
    bonus += SCORING_RULES.THREE_WICKETS;
    details.push(`3-wicket bonus = +${SCORING_RULES.THREE_WICKETS}`);
  }

  if (stats.maidens > 0) {
    const maidenPts = stats.maidens * SCORING_RULES.MAIDEN_OVER;
    bowling += maidenPts;
    details.push(`${stats.maidens} maiden(s) = +${maidenPts}`);
  }

  // ─── Fielding ────────────────────────────────────────
  if (stats.catches > 0) {
    fielding += stats.catches * SCORING_RULES.CATCH;
    details.push(`${stats.catches} catch(es) = ${stats.catches * SCORING_RULES.CATCH}`);
  }

  if (stats.stumpings > 0) {
    fielding += stats.stumpings * SCORING_RULES.STUMPING;
    details.push(`${stats.stumpings} stumping(s) = ${stats.stumpings * SCORING_RULES.STUMPING}`);
  }

  if (stats.runOuts > 0) {
    fielding += stats.runOuts * SCORING_RULES.RUN_OUT;
    details.push(`${stats.runOuts} run out(s) = ${stats.runOuts * SCORING_RULES.RUN_OUT}`);
  }

  // ─── Advanced: Strike Rate (only if enough balls faced) ───
  if (stats.ballsFaced >= SCORING_RULES.SR_MIN_BALLS && stats.strikeRate > 0) {
    if (stats.strikeRate > 170) {
      bonus += SCORING_RULES.SR_ABOVE_170;
      details.push(`SR ${stats.strikeRate.toFixed(1)} (>170) = +${SCORING_RULES.SR_ABOVE_170}`);
    } else if (stats.strikeRate >= 150) {
      bonus += SCORING_RULES.SR_150_TO_170;
      details.push(`SR ${stats.strikeRate.toFixed(1)} (150-170) = +${SCORING_RULES.SR_150_TO_170}`);
    } else if (stats.strikeRate >= 130) {
      bonus += SCORING_RULES.SR_130_TO_150;
      details.push(`SR ${stats.strikeRate.toFixed(1)} (130-150) = +${SCORING_RULES.SR_130_TO_150}`);
    } else if (stats.strikeRate < 60) {
      bonus += SCORING_RULES.SR_BELOW_60;
      details.push(`SR ${stats.strikeRate.toFixed(1)} (<60) = ${SCORING_RULES.SR_BELOW_60}`);
    } else if (stats.strikeRate < 80) {
      bonus += SCORING_RULES.SR_60_TO_80;
      details.push(`SR ${stats.strikeRate.toFixed(1)} (60-80) = ${SCORING_RULES.SR_60_TO_80}`);
    } else if (stats.strikeRate < 100) {
      bonus += SCORING_RULES.SR_80_TO_100;
      details.push(`SR ${stats.strikeRate.toFixed(1)} (80-100) = ${SCORING_RULES.SR_80_TO_100}`);
    }
  }

  // ─── Advanced: Economy Rate (only if enough overs bowled) ──
  if (stats.oversBowled >= SCORING_RULES.ECON_MIN_OVERS && stats.economyRate > 0) {
    if (stats.economyRate < 5) {
      bonus += SCORING_RULES.ECON_BELOW_5;
      details.push(`Econ ${stats.economyRate.toFixed(1)} (<5) = +${SCORING_RULES.ECON_BELOW_5}`);
    } else if (stats.economyRate < 6) {
      bonus += SCORING_RULES.ECON_5_TO_6;
      details.push(`Econ ${stats.economyRate.toFixed(1)} (5-6) = +${SCORING_RULES.ECON_5_TO_6}`);
    } else if (stats.economyRate < 7) {
      bonus += SCORING_RULES.ECON_6_TO_7;
      details.push(`Econ ${stats.economyRate.toFixed(1)} (6-7) = +${SCORING_RULES.ECON_6_TO_7}`);
    } else if (stats.economyRate > 12) {
      bonus += SCORING_RULES.ECON_ABOVE_12;
      details.push(`Econ ${stats.economyRate.toFixed(1)} (>12) = ${SCORING_RULES.ECON_ABOVE_12}`);
    } else if (stats.economyRate > 11) {
      bonus += SCORING_RULES.ECON_11_TO_12;
      details.push(`Econ ${stats.economyRate.toFixed(1)} (11-12) = ${SCORING_RULES.ECON_11_TO_12}`);
    } else if (stats.economyRate > 10) {
      bonus += SCORING_RULES.ECON_10_TO_11;
      details.push(`Econ ${stats.economyRate.toFixed(1)} (10-11) = ${SCORING_RULES.ECON_10_TO_11}`);
    }
  }

  const total = batting + bowling + fielding + bonus;

  return {
    total,
    breakdown: { batting, bowling, fielding, bonus, details },
  };
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
        strikeRate: 0,
        economyRate: 0,
        fantasyPoints: 0,
        breakdown: { batting: 0, bowling: 0, fielding: 0, bonus: 0, details: [] },
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

  // Calculate derived stats and fantasy points
  for (const [, stats] of statsMap) {
    // Strike rate
    if (stats.ballsFaced > 0) {
      stats.strikeRate = (stats.runs / stats.ballsFaced) * 100;
    }
    // Economy rate
    if (stats.oversBowled > 0) {
      stats.economyRate = stats.runsConceded / stats.oversBowled;
    }

    // Calculate fantasy points
    const { total, breakdown } = calculatePlayerPoints(stats);
    stats.fantasyPoints = total;
    stats.breakdown = breakdown;
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
    const multiplier = playerId === captainId
      ? SCORING_RULES.CAPTAIN
      : playerId === viceCaptainId
        ? SCORING_RULES.VICE_CAPTAIN
        : 1;
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
        fours: stats?.fours ?? 0,
        sixes: stats?.sixes ?? 0,
        batting: stats?.breakdown.batting ?? 0,
        bowling: stats?.breakdown.bowling ?? 0,
        fielding: stats?.breakdown.fielding ?? 0,
        bonus: stats?.breakdown.bonus ?? 0,
      },
    });

    totalPoints += pts;
  }

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
