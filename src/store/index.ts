import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { User, Group, IPLMatch, MatchResult, Transaction, FantasyTeam } from '../types';
import * as db from '../lib/db';
import { generateId } from '../utils/id';

interface AppState {
  // Auth
  authUser: SupabaseUser | null;
  isAuthenticated: boolean;

  // Persisted
  currentUser: User;
  groups: Group[];
  hasOnboarded: boolean;

  // Fantasy teams (persisted to localStorage)
  fantasyTeams: FantasyTeam[];

  // Cloud-only (not persisted)
  iplSchedule: IPLMatch[];
  matchResults: MatchResult[];
  transactions: Transaction[];

  // Auth actions
  setAuthUser: (user: SupabaseUser | null) => void;

  // User actions
  setCurrentUser: (name: string) => void;
  setOnboarded: () => void;

  // Group actions
  addGroup: (name: string, emoji?: string, entryAmount?: number) => Promise<Group>;
  updateGroupName: (groupId: string, name: string) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;

  // Match actions
  submitResults: (
    groupId: string,
    matchId: number,
    rankings: { userId: string; rank: number; payout: number; netAmount: number }[]
  ) => Promise<void>;

  // Fantasy team actions (teams are per match per user, shared across groups)
  saveFantasyTeam: (team: FantasyTeam) => Promise<void>;
  getFantasyTeam: (matchId: number) => FantasyTeam | undefined;
  getFantasyTeamsByMatch: (matchId: number) => FantasyTeam[];

  // Sync
  fetchIPLSchedule: () => Promise<void>;
  fetchFromSupabase: () => Promise<void>;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Auth
      authUser: null,
      isAuthenticated: false,

      // Persisted
      currentUser: { id: 'user-me', name: '' },
      groups: [],
      hasOnboarded: false,

      // Fantasy teams
      fantasyTeams: [],

      // Cloud-only
      iplSchedule: [],
      matchResults: [],
      transactions: [],

      setAuthUser: (user) => {
        set({
          authUser: user,
          isAuthenticated: !!user,
          // Immediately update currentUser from auth metadata
          ...(user
            ? {
                currentUser: {
                  id: user.id,
                  name: user.user_metadata?.full_name || user.email || '',
                  email: user.email,
                  avatarUrl: user.user_metadata?.avatar_url,
                },
              }
            : {}),
        });
      },

      setCurrentUser: (name) => {
        set((s) => ({
          currentUser: { ...s.currentUser, name },
        }));
      },

      setOnboarded: () => set({ hasOnboarded: true }),

      addGroup: async (name, emoji, entryAmount) => {
        const state = get();
        const creatorName = state.currentUser.name || 'You';
        const groupEmoji = emoji || '🏏';
        const amount = entryAmount || 100;

        if (state.isAuthenticated && state.authUser) {
          try {
            const group = await db.createGroup(
              name,
              groupEmoji,
              state.authUser.id,
              creatorName,
              amount
            );
            set((s) => ({ groups: [...s.groups, group] }));
            return group;
          } catch (e) {
            console.error('Failed to create group in Supabase:', e);
            throw e;
          }
        }

        // Local fallback (shouldn't happen — create requires auth)
        const group: Group = {
          id: generateId(),
          name,
          emoji: groupEmoji,
          inviteCode: generateId().slice(0, 8),
          entryAmount: amount,
          members: [{
            id: state.currentUser.id,
            name: creatorName,
            isRegistered: true,
            isAdmin: true,
          }],
        };
        set((s) => ({ groups: [...s.groups, group] }));
        return group;
      },

      updateGroupName: async (groupId, name) => {
        set((s) => ({
          groups: s.groups.map((g) =>
            g.id === groupId ? { ...g, name } : g
          ),
        }));
        try {
          await db.updateGroupName(groupId, name);
        } catch (e) {
          console.error('Failed to update group name:', e);
        }
      },

      deleteGroup: async (groupId) => {
        set((s) => ({
          groups: s.groups.filter((g) => g.id !== groupId),
          matchResults: s.matchResults.filter((r) => r.groupId !== groupId),
          transactions: s.transactions.filter((t) => t.groupId !== groupId),
        }));
        try {
          await db.deleteGroupFromDb(groupId);
        } catch (e) {
          console.error('Failed to delete group:', e);
        }
      },

      submitResults: async (groupId, matchId, rankings) => {
        await db.submitResults(groupId, matchId, rankings);

        // Update local state
        const newResults = rankings.map((r) => ({
          groupId,
          matchId,
          userId: r.userId,
          rank: r.rank,
          payout: r.payout,
        }));

        const newTxs = rankings.map((r) => ({
          id: generateId(),
          groupId,
          matchId,
          userId: r.userId,
          amount: r.netAmount,
          createdAt: Date.now(),
        }));

        set((s) => ({
          matchResults: [...s.matchResults, ...newResults],
          transactions: [...s.transactions, ...newTxs],
        }));
      },

      saveFantasyTeam: async (team) => {
        const state = get();

        // Save to Supabase first
        if (state.isAuthenticated && state.authUser) {
          try {
            const existingId = state.fantasyTeams.find(
              (t) => t.matchId === team.matchId && t.userId === team.userId
            )?.id;

            const saved = await db.saveFantasyTeam(
              team.groupId || null,
              team.matchId,
              state.authUser.id,
              team.players,
              team.captainId,
              team.viceCaptainId,
              existingId
            );

            // Update local state with Supabase-generated ID
            set((s) => {
              const idx = s.fantasyTeams.findIndex(
                (t) => t.matchId === team.matchId && t.userId === team.userId
              );
              if (idx >= 0) {
                const updated = [...s.fantasyTeams];
                updated[idx] = saved;
                return { fantasyTeams: updated };
              }
              return { fantasyTeams: [...s.fantasyTeams, saved] };
            });
            return;
          } catch (e) {
            console.error('Failed to save fantasy team to Supabase:', e);
            throw e;
          }
        }

        // Local fallback
        set((s) => {
          const idx = s.fantasyTeams.findIndex(
            (t) => t.matchId === team.matchId && t.userId === team.userId
          );
          if (idx >= 0) {
            const updated = [...s.fantasyTeams];
            updated[idx] = team;
            return { fantasyTeams: updated };
          }
          return { fantasyTeams: [...s.fantasyTeams, team] };
        });
      },

      // Teams are per match per user — shared across all groups
      getFantasyTeam: (matchId) => {
        const state = get();
        const userId = state.currentUser.id;
        return state.fantasyTeams.find(
          (t) => t.matchId === matchId && t.userId === userId
        );
      },

      getFantasyTeamsByMatch: (matchId) => {
        const state = get();
        return state.fantasyTeams.filter(
          (t) => t.matchId === matchId
        );
      },

      fetchIPLSchedule: async () => {
        try {
          const schedule = await db.fetchIPLSchedule();
          set({ iplSchedule: schedule });
        } catch (e) {
          console.error('Failed to fetch IPL schedule:', e);
        }
      },

      fetchFromSupabase: async () => {
        const state = get();
        if (!state.authUser) return;

        try {
          const [groups, schedule] = await Promise.all([
            db.fetchUserGroups(state.authUser.id),
            db.fetchIPLSchedule(),
          ]);

          // Fetch results, transactions for all groups + fantasy teams for user
          const groupIds = groups.map((g) => g.id);
          const [allResults, allTxs, allFantasyTeams] = await Promise.all([
            Promise.all(groupIds.map((id) => db.fetchGroupResults(id))),
            Promise.all(groupIds.map((id) => db.fetchGroupTransactions(id))),
            db.fetchFantasyTeams(), // Fetch all teams (not per group)
          ]);

          set({
            groups,
            iplSchedule: schedule,
            matchResults: allResults.flat(),
            transactions: allTxs.flat(),
            fantasyTeams: allFantasyTeams,
            currentUser: {
              id: state.authUser.id,
              name:
                state.authUser.user_metadata?.full_name ||
                state.authUser.email ||
                '',
              email: state.authUser.email,
              avatarUrl: state.authUser.user_metadata?.avatar_url,
            },
          });
        } catch (e) {
          console.error('Failed to fetch from Supabase:', e);
        }
      },
    }),
    {
      name: 'gully11-storage',
      partialize: (state) => ({
        currentUser: state.currentUser,
        groups: state.groups,
        hasOnboarded: state.hasOnboarded,
        fantasyTeams: state.fantasyTeams,
      }),
    }
  )
);
