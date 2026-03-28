import { supabase } from './supabase';
import type { IPLMatch, Group, MatchResult, Transaction, FantasyTeam, FantasyPick, PlayerMatchStats, PointRule } from '../types';
import { generateId } from '../utils/id';
import type { Player } from '../utils/players';

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

// ─── Players (from DB) ──────────────────────────────────────────

export async function fetchPlayers(teamCodes?: string[]): Promise<Player[]> {
  let query = supabase.from('gully11_players').select('*');
  if (teamCodes && teamCodes.length > 0) {
    query = query.in('team', teamCodes);
  }
  const { data, error } = await query.order('team').order('role');
  if (error) throw error;

  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    team: p.team,
    role: p.role as Player['role'],
    credits: Number(p.credits ?? 7.0),
  }));
}

// ─── Fantasy Teams ──────────────────────────────────────────────

export async function saveFantasyTeam(
  groupId: string,
  matchId: number,
  userId: string,
  players: FantasyPick[],
  captainId: string,
  viceCaptainId: string,
  existingTeamId?: string
): Promise<FantasyTeam> {
  // If editing, delete old team players first
  if (existingTeamId) {
    await supabase
      .from('gully11_fantasy_team_players')
      .delete()
      .eq('team_id', existingTeamId);

    // Update the team
    const { error: uErr } = await supabase
      .from('gully11_fantasy_teams')
      .update({
        captain_id: captainId,
        vice_captain_id: viceCaptainId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingTeamId);

    if (uErr) throw uErr;

    // Insert new players
    const { error: pErr } = await supabase
      .from('gully11_fantasy_team_players')
      .insert(players.map((p) => ({
        team_id: existingTeamId,
        player_id: p.playerId,
        role: p.role,
      })));

    if (pErr) throw pErr;

    return {
      id: existingTeamId,
      groupId,
      matchId,
      userId,
      players,
      captainId,
      viceCaptainId,
      totalPoints: 0,
      createdAt: Date.now(),
    };
  }

  // Create new team
  const { data: team, error: tErr } = await supabase
    .from('gully11_fantasy_teams')
    .insert({
      group_id: groupId,
      match_id: matchId,
      user_id: userId,
      captain_id: captainId,
      vice_captain_id: viceCaptainId,
    })
    .select()
    .single();

  if (tErr) throw tErr;

  // Insert players
  const { error: pErr } = await supabase
    .from('gully11_fantasy_team_players')
    .insert(players.map((p) => ({
      team_id: team.id,
      player_id: p.playerId,
      role: p.role,
    })));

  if (pErr) throw pErr;

  return {
    id: team.id,
    groupId,
    matchId,
    userId,
    players,
    captainId,
    viceCaptainId,
    totalPoints: 0,
    createdAt: new Date(team.created_at).getTime(),
  };
}

export async function fetchFantasyTeams(groupId: string): Promise<FantasyTeam[]> {
  const { data: teams, error: tErr } = await supabase
    .from('gully11_fantasy_teams')
    .select('*')
    .eq('group_id', groupId);

  if (tErr) throw tErr;
  if (!teams || teams.length === 0) return [];

  const teamIds = teams.map((t) => t.id);

  const { data: picks, error: pErr } = await supabase
    .from('gully11_fantasy_team_players')
    .select('*')
    .in('team_id', teamIds);

  if (pErr) throw pErr;

  return teams.map((t) => ({
    id: t.id,
    groupId: t.group_id,
    matchId: t.match_id,
    userId: t.user_id,
    captainId: t.captain_id,
    viceCaptainId: t.vice_captain_id,
    totalPoints: Number(t.total_points || 0),
    createdAt: new Date(t.created_at).getTime(),
    players: (picks ?? [])
      .filter((p) => p.team_id === t.id)
      .map((p) => ({
        playerId: p.player_id,
        role: p.role as FantasyPick['role'],
      })),
  }));
}

// ─── Player Match Stats ─────────────────────────────────────────

export async function savePlayerStats(
  matchId: number,
  stats: Omit<PlayerMatchStats, 'matchId' | 'fantasyPoints'>[]
): Promise<void> {
  const rows = stats.map((s) => ({
    match_id: matchId,
    player_id: s.playerId,
    runs: s.runs,
    balls_faced: s.ballsFaced,
    fours: s.fours,
    sixes: s.sixes,
    is_not_out: s.isNotOut,
    overs_bowled: s.oversBowled,
    runs_conceded: s.runsConceded,
    wickets: s.wickets,
    maidens: s.maidens,
    catches: s.catches,
    stumpings: s.stumpings,
    run_outs: s.runOuts,
    is_in_playing_xi: s.isInPlayingXi,
    is_man_of_match: s.isManOfMatch,
  }));

  const { error } = await supabase
    .from('gully11_player_match_stats')
    .upsert(rows, { onConflict: 'match_id,player_id' });

  if (error) throw error;
}

export async function fetchPlayerStats(matchId: number): Promise<PlayerMatchStats[]> {
  const { data, error } = await supabase
    .from('gully11_player_match_stats')
    .select('*')
    .eq('match_id', matchId);

  if (error) throw error;

  return (data ?? []).map((s) => ({
    matchId: s.match_id,
    playerId: s.player_id,
    runs: s.runs,
    ballsFaced: s.balls_faced,
    fours: s.fours,
    sixes: s.sixes,
    isNotOut: s.is_not_out,
    oversBowled: Number(s.overs_bowled),
    runsConceded: s.runs_conceded,
    wickets: s.wickets,
    maidens: s.maidens,
    catches: s.catches,
    stumpings: s.stumpings,
    runOuts: s.run_outs,
    isInPlayingXi: s.is_in_playing_xi,
    isManOfMatch: s.is_man_of_match,
    fantasyPoints: Number(s.fantasy_points),
  }));
}

// ─── Point Rules ────────────────────────────────────────────────

export async function fetchPointRules(): Promise<PointRule[]> {
  const { data, error } = await supabase
    .from('gully11_point_rules')
    .select('*')
    .order('id');

  if (error) throw error;

  return (data ?? []).map((r) => ({
    id: r.id,
    category: r.category,
    action: r.action,
    points: Number(r.points),
    description: r.description,
  }));
}

