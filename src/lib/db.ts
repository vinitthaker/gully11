import { supabase } from './supabase';
import type { IPLMatch, Group, MatchResult, Transaction } from '../types';
import { generateId } from '../utils/id';

// ─── IPL Schedule ───────────────────────────────────────────────

export async function fetchIPLSchedule(): Promise<IPLMatch[]> {
  const { data, error } = await supabase
    .from('gully11_ipl_schedule')
    .select('*')
    .order('id', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((m) => ({
    id: m.id,
    teamHome: m.team_home,
    teamAway: m.team_away,
    matchDate: new Date(m.match_date).getTime(),
    venue: m.venue,
  }));
}

// ─── Groups ─────────────────────────────────────────────────────

export async function fetchUserGroups(userId: string): Promise<Group[]> {
  // Get group IDs for user
  const { data: memberships, error: mErr } = await supabase
    .from('gully11_group_members')
    .select('group_id')
    .eq('user_id', userId);

  if (mErr) throw mErr;
  if (!memberships || memberships.length === 0) return [];

  const groupIds = memberships.map((m) => m.group_id);

  // Get groups
  const { data: groups, error: gErr } = await supabase
    .from('gully11_groups')
    .select('*')
    .in('id', groupIds);

  if (gErr) throw gErr;

  // Get all members for these groups
  const { data: members, error: memErr } = await supabase
    .from('gully11_group_members')
    .select('*')
    .in('group_id', groupIds);

  if (memErr) throw memErr;

  return (groups ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    emoji: g.emoji,
    inviteCode: g.invite_code,
    entryAmount: g.entry_amount,
    members: (members ?? [])
      .filter((m) => m.group_id === g.id)
      .map((m) => ({
        id: m.user_id,
        name: m.name,
        isRegistered: m.is_registered,
        isAdmin: m.is_admin,
      })),
  }));
}

export async function createGroup(
  name: string,
  emoji: string,
  createdBy: string,
  creatorName: string,
  entryAmount: number = 100
): Promise<Group> {
  const inviteCode = generateId().slice(0, 8);

  const { data: group, error: gErr } = await supabase
    .from('gully11_groups')
    .insert({
      name,
      emoji,
      invite_code: inviteCode,
      entry_amount: entryAmount,
      created_by: createdBy,
    })
    .select()
    .single();

  if (gErr) throw gErr;

  // Add creator as the only member (admin)
  const { error: mErr } = await supabase
    .from('gully11_group_members')
    .insert({
      group_id: group.id,
      user_id: createdBy,
      name: creatorName,
      is_registered: true,
      is_admin: true,
    });

  if (mErr) throw mErr;

  return {
    id: group.id,
    name: group.name,
    emoji: group.emoji,
    inviteCode: group.invite_code,
    entryAmount: group.entry_amount,
    members: [{
      id: createdBy,
      name: creatorName,
      isRegistered: true,
      isAdmin: true,
    }],
  };
}

// Join a group via invite code (anyone with the link can join)
export async function joinGroup(
  inviteCode: string,
  userId: string,
  userName: string
): Promise<string> {
  // Get group by invite code
  const { data: group, error: gErr } = await supabase
    .from('gully11_groups')
    .select('id')
    .eq('invite_code', inviteCode)
    .single();

  if (gErr || !group) throw new Error('Group not found');

  // Add user as a member
  const { error: mErr } = await supabase
    .from('gully11_group_members')
    .insert({
      group_id: group.id,
      user_id: userId,
      name: userName,
      is_registered: true,
      is_admin: false,
    });

  if (mErr) throw mErr;

  return group.id;
}

export async function getGroupByInviteCode(inviteCode: string): Promise<Group | null> {
  const { data: group, error: gErr } = await supabase
    .from('gully11_groups')
    .select('*')
    .eq('invite_code', inviteCode)
    .single();

  if (gErr || !group) return null;

  const { data: members } = await supabase
    .from('gully11_group_members')
    .select('*')
    .eq('group_id', group.id);

  return {
    id: group.id,
    name: group.name,
    emoji: group.emoji,
    inviteCode: group.invite_code,
    entryAmount: group.entry_amount,
    members: (members ?? []).map((m) => ({
      id: m.user_id,
      name: m.name,
      isRegistered: m.is_registered,
      isAdmin: m.is_admin,
    })),
  };
}

export async function deleteGroupFromDb(groupId: string): Promise<void> {
  const { error } = await supabase
    .from('gully11_groups')
    .delete()
    .eq('id', groupId);

  if (error) throw error;
}

export async function updateGroupName(groupId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('gully11_groups')
    .update({ name })
    .eq('id', groupId);

  if (error) throw error;
}

// ─── Match Results ──────────────────────────────────────────────

export async function fetchGroupResults(groupId: string): Promise<MatchResult[]> {
  const { data, error } = await supabase
    .from('gully11_match_results')
    .select('*')
    .eq('group_id', groupId);

  if (error) throw error;

  return (data ?? []).map((r) => ({
    groupId: r.group_id,
    matchId: r.match_id,
    userId: r.user_id,
    rank: r.rank,
    payout: Number(r.payout),
  }));
}

export async function submitResults(
  groupId: string,
  matchId: number,
  rankings: { userId: string; rank: number; payout: number; netAmount: number }[]
): Promise<void> {
  // Insert match results
  const resultRows = rankings.map((r) => ({
    group_id: groupId,
    match_id: matchId,
    user_id: r.userId,
    rank: r.rank,
    payout: r.payout,
  }));

  const { error: rErr } = await supabase
    .from('gully11_match_results')
    .insert(resultRows);

  if (rErr) throw rErr;

  // Insert transactions
  const txRows = rankings.map((r) => ({
    group_id: groupId,
    match_id: matchId,
    user_id: r.userId,
    amount: r.netAmount,
  }));

  const { error: tErr } = await supabase
    .from('gully11_transactions')
    .insert(txRows);

  if (tErr) throw tErr;
}

// ─── Transactions ───────────────────────────────────────────────

export async function fetchGroupTransactions(groupId: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('gully11_transactions')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((t) => ({
    id: t.id,
    groupId: t.group_id,
    matchId: t.match_id,
    userId: t.user_id,
    amount: Number(t.amount),
    createdAt: new Date(t.created_at).getTime(),
  }));
}

