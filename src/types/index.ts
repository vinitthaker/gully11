export interface User {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  isRegistered?: boolean;
}

export interface GroupMember extends User {
  isAdmin: boolean;
}

export interface Group {
  id: string;
  name: string;
  emoji?: string;
  inviteCode?: string;
  members: GroupMember[];
  entryAmount: number;
}

export interface IPLMatch {
  id: number;
  teamHome: string;
  teamAway: string;
  matchDate: number;
  venue: string;
  cricapiMatchId?: string; // CricAPI match ID (legacy)
  cricbuzzMatchId?: number; // Cricbuzz match ID for live scores & points
}

export interface MatchResult {
  groupId: string;
  matchId: number;
  userId: string;
  rank: number;
  payout: number;
}

export interface Transaction {
  id: string;
  groupId: string;
  matchId: number;
  userId: string;
  amount: number;
  createdAt: number;
}

export interface Debt {
  from: string;
  to: string;
  amount: number;
}

export interface FantasyTeam {
  id: string;
  groupId?: string; // Optional — teams are per match per user, shared across groups
  matchId: number;
  userId: string;
  players: FantasyPick[];
  captainId: string;
  viceCaptainId: string;
  totalPoints: number;
  createdAt: number;
}

export interface FantasyPick {
  playerId: string;
  role: 'WK' | 'BAT' | 'AR' | 'BOWL';
}

export interface PlayerMatchStats {
  matchId: number;
  playerId: string;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  isNotOut: boolean;
  oversBowled: number;
  runsConceded: number;
  wickets: number;
  maidens: number;
  catches: number;
  stumpings: number;
  runOuts: number;
  isInPlayingXi: boolean;
  isManOfMatch: boolean;
  fantasyPoints: number;
}

export interface TeamPoints {
  groupId: string;
  matchId: number;
  userId: string;
  teamId: string;
  totalPoints: number;
  rank: number;
  payout: number;
  netAmount: number;
}

export interface PointRule {
  id: number;
  category: string;
  action: string;
  points: number;
  description: string;
}
