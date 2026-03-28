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
