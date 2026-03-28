import { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Trophy, Users, Pencil, Clock, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { useStore } from '../store';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { usePageTitle } from '../hooks/usePageTitle';
import { getTeamByName, calculatePayouts } from '../utils/ipl';
import { getAvatarColor, getInitial } from '../utils/avatarColor';
import { formatAmount } from '../utils/currency';
import { IPL_PLAYERS } from '../utils/players';
import * as cricapi from '../lib/cricapi';

export function MatchDetailPage() {
  const { id: groupId, matchId: matchIdStr } = useParams<{ id: string; matchId: string }>();
  const matchId = Number(matchIdStr);
  const navigate = useNavigate();
  const { groups, iplSchedule, matchResults, currentUser, submitResults, getFantasyTeam, getFantasyTeamsByMatch } = useStore();

  const group = groups.find((g) => g.id === groupId);
  const match = iplSchedule.find((m) => m.id === matchId);
  usePageTitle(match ? `Match #${matchId} | Gully11` : 'Gully11');

  const [showEnterResults, setShowEnterResults] = useState(false);
  const [rankings, setRankings] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  // Live scores
  const [liveScore, setLiveScore] = useState<{ t1s?: string; t2s?: string; status?: string } | null>(null);
  const [, setLoadingScore] = useState(false);

  // Fantasy points
  const [calculatingPoints, setCalculatingPoints] = useState(false);
  const [matchPoints, setMatchPoints] = useState<cricapi.MatchPointsResponse | null>(null);

  // Expanded member teams
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  const existingResults = useMemo(() => {
    return matchResults.filter((r) => r.groupId === groupId && r.matchId === matchId);
  }, [matchResults, groupId, matchId]);

  const hasResults = existingResults.length > 0;
  const isAdmin = group?.members.find((m) => m.id === currentUser.id)?.isAdmin;
  const existingFantasyTeam = groupId ? getFantasyTeam(groupId, matchId) : undefined;
  const allTeams = groupId ? getFantasyTeamsByMatch(groupId, matchId) : [];

  // Match started?
  const matchStarted = match ? Date.now() > match.matchDate : false;
  const matchEnded = match ? Date.now() > match.matchDate + 4 * 60 * 60 * 1000 : false; // ~4h after start

  // Fetch live scores when match is live
  const fetchLiveScore = useCallback(async () => {
    if (!match) return;
    setLoadingScore(true);
    try {
      const scores = await cricapi.getLiveScores();
      const homeCode = getTeamByName(match.teamHome)?.code;
      const awayCode = getTeamByName(match.teamAway)?.code;

      const liveMatch = scores.find((s) => {
        const teams = s.teams?.map((t) => cricapi.resolveTeamCode(t)).filter(Boolean) || [];
        return teams.includes(homeCode!) && teams.includes(awayCode!);
      });

      if (liveMatch) {
        const scoreArr = (liveMatch as any).score || [];

        const findScore = (code: string | undefined) => {
          const entry = scoreArr.find((s: any) => {
            const teamCode = cricapi.resolveTeamCode(s.inning?.split(' Inning')?.[0] || '');
            return teamCode === code;
          });
          return entry ? `${entry.r}/${entry.w} (${entry.o})` : undefined;
        };

        setLiveScore({
          t1s: findScore(homeCode),
          t2s: findScore(awayCode),
          status: liveMatch.status,
        });
      }
    } catch (e) {
      console.error('Failed to fetch live score:', e);
    } finally {
      setLoadingScore(false);
    }
  }, [match]);

  useEffect(() => {
    if (matchStarted && !matchEnded) {
      fetchLiveScore();
      const interval = setInterval(fetchLiveScore, 60_000); // refresh every minute
      return () => clearInterval(interval);
    }
  }, [matchStarted, matchEnded, fetchLiveScore]);

  if (!group || !match) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-on-surface-variant">Match not found</p>
      </div>
    );
  }

  const home = getTeamByName(match.teamHome);
  const away = getTeamByName(match.teamAway);
  const memberCount = group.members.length;
  const entryAmount = group.entryAmount;
  const pool = memberCount * entryAmount;
  const payoutTable = calculatePayouts(memberCount, entryAmount);

  // For "Enter Results" preview
  const assignedRanks = Object.values(rankings);
  const allAssigned = assignedRanks.length === memberCount && new Set(assignedRanks).size === memberCount;

  function handleRankChange(memberId: string, rank: number) {
    setRankings((prev) => {
      const next = { ...prev };
      for (const [key, val] of Object.entries(next)) {
        if (val === rank && key !== memberId) {
          delete next[key];
        }
      }
      next[memberId] = rank;
      return next;
    });
  }

  async function handleSubmit() {
    if (!allAssigned || submitting) return;
    setSubmitting(true);
    try {
      const rankedResults = group!.members.map((m) => {
        const rank = rankings[m.id];
        const payout = payoutTable[rank - 1] || 0;
        const netAmount = payout - entryAmount;
        return { userId: m.id, rank, payout, netAmount };
      });
      await submitResults(groupId!, matchId, rankedResults);
      setShowEnterResults(false);
      setRankings({});
    } catch (e) {
      console.error('Failed to submit results:', e);
    } finally {
      setSubmitting(false);
    }
  }

  // Calculate team points from match points
  const teamPointsMap = useMemo(() => {
    if (!matchPoints) return {};
    const map: Record<string, { totalPoints: number; playerPoints: Record<string, number> }> = {};
    for (const team of allTeams) {
      const playerIds = team.players.map((p) => p.playerId);
      map[team.userId] = cricapi.calculateTeamPoints(matchPoints, playerIds, team.captainId, team.viceCaptainId);
    }
    return map;
  }, [matchPoints, allTeams]);

  // Sort teams by points
  const sortedTeams = useMemo(() => {
    return [...allTeams].sort((a, b) => {
      const pa = teamPointsMap[a.userId]?.totalPoints ?? 0;
      const pb = teamPointsMap[b.userId]?.totalPoints ?? 0;
      return pb - pa;
    });
  }, [allTeams, teamPointsMap]);

  // Render a member's team inline
  function renderMemberTeam(team: typeof allTeams[0], rank?: number) {
    const member = group!.members.find((m) => m.id === team.userId);
    if (!member) return null;
    const colors = getAvatarColor(member.name);
    const isMe = member.id === currentUser.id;
    const isExpanded = expandedTeam === team.userId;
    const pts = teamPointsMap[team.userId];

    const picks = team.players.map((pick) => {
      const player = IPL_PLAYERS.find((p) => p.id === pick.playerId);
      return player ? { ...player, pickRole: pick.role, fantasyPts: pts?.playerPoints[pick.playerId] ?? null } : null;
    }).filter(Boolean) as (typeof IPL_PLAYERS[0] & { pickRole: string; fantasyPts: number | null })[];

    const roleOrder = ['WK', 'BAT', 'AR', 'BOWL'];
    picks.sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role));

    return (
      <div key={team.userId} className="mb-2">
        <button
          onClick={() => setExpandedTeam(isExpanded ? null : team.userId)}
          className="w-full flex items-center gap-3 bg-white rounded-2xl card-shadow px-4 py-3 active:scale-[0.99] transition-all"
        >
          {/* Rank */}
          {rank !== undefined && (
            <div className="w-6 text-center shrink-0">
              {rank === 1 ? (
                <Trophy className="text-amber-500" size={16} />
              ) : (
                <span className="font-headline font-bold text-on-surface-variant text-xs">#{rank}</span>
              )}
            </div>
          )}

          {/* Avatar */}
          <div
            className={`w-8 h-8 rounded-full ${colors.bg} ${colors.text} flex items-center justify-center text-xs font-bold shrink-0`}
          >
            {getInitial(member.name)}
          </div>

          {/* Name */}
          <p className={`flex-1 text-sm font-medium text-on-surface text-left truncate ${isMe ? 'text-primary' : ''}`}>
            {isMe ? 'You' : member.name}
          </p>

          {/* Points */}
          {pts && (
            <span className="font-headline font-bold text-sm text-primary shrink-0">
              {pts.totalPoints} pts
            </span>
          )}

          {/* Expand icon */}
          {isExpanded ? <ChevronUp size={16} className="text-on-surface-variant shrink-0" /> : <ChevronDown size={16} className="text-on-surface-variant shrink-0" />}
        </button>

        {/* Expanded team */}
        {isExpanded && (
          <div className="mt-1 bg-white rounded-2xl card-shadow px-4 py-3 animate-fade-in">
            {picks.map((player) => {
              const isCaptain = team.captainId === player.id;
              const isVC = team.viceCaptainId === player.id;
              const multiplier = isCaptain ? 2 : isVC ? 1.5 : 1;
              const rawPts = player.fantasyPts;
              const displayPts = rawPts !== null ? Math.round(rawPts * multiplier * 10) / 10 : null;

              return (
                <div key={player.id} className="flex items-center gap-2 py-[6px]">
                  <span className="text-[9px] font-bold text-on-surface-variant/50 w-7 shrink-0">{player.role}</span>
                  <span className="text-[13px] text-on-surface flex-1 truncate font-medium">
                    {player.name}
                  </span>
                  {isCaptain && (
                    <span className="text-[8px] font-bold text-white bg-primary rounded-full w-[16px] h-[16px] flex items-center justify-center shrink-0">C</span>
                  )}
                  {isVC && (
                    <span className="text-[8px] font-bold text-white bg-on-surface-variant rounded-full w-[16px] h-[16px] flex items-center justify-center shrink-0">V</span>
                  )}
                  {displayPts !== null && (
                    <span className={`text-xs font-bold shrink-0 min-w-[35px] text-right ${displayPts > 0 ? 'text-owed' : displayPts < 0 ? 'text-owe' : 'text-on-surface-variant'}`}>
                      {displayPts > 0 ? '+' : ''}{displayPts}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Fetch fantasy points from CricAPI
  async function handleFetchPoints() {
    if (!match?.cricapiMatchId || calculatingPoints) return;
    setCalculatingPoints(true);
    try {
      const pts = await cricapi.getMatchPoints(match.cricapiMatchId);
      setMatchPoints(pts);
    } catch (e) {
      console.error('Failed to fetch match points:', e);
      alert('Failed to fetch points from CricAPI. The match might not have started or ended yet.');
    } finally {
      setCalculatingPoints(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      <Header variant="page" title={`Match #${matchId}`} showBack />

      <main className="px-6 pb-8 max-w-2xl mx-auto">
        {/* Big match display */}
        <div className="mt-4 mb-6">
          <Card>
            <div className="flex items-center justify-between gap-4 py-2">
              {/* Home Team */}
              <div className="flex-1 text-center">
                <div
                  className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-sm font-bold shadow-md"
                  style={{
                    backgroundColor: home?.color || '#666',
                    color: home?.textColor || '#fff',
                  }}
                >
                  {home?.code || match.teamHome.slice(0, 3).toUpperCase()}
                </div>
                <p className="text-sm font-bold text-on-surface">
                  {home?.shortName || match.teamHome}
                </p>
                {liveScore?.t1s && (
                  <p className="text-xs font-bold text-primary mt-1">{liveScore.t1s}</p>
                )}
              </div>

              {/* VS */}
              <div className="text-center shrink-0">
                <p className="font-headline font-bold text-on-surface-variant text-2xl">VS</p>
              </div>

              {/* Away Team */}
              <div className="flex-1 text-center">
                <div
                  className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-sm font-bold shadow-md"
                  style={{
                    backgroundColor: away?.color || '#666',
                    color: away?.textColor || '#fff',
                  }}
                >
                  {away?.code || match.teamAway.slice(0, 3).toUpperCase()}
                </div>
                <p className="text-sm font-bold text-on-surface">
                  {away?.shortName || match.teamAway}
                </p>
                {liveScore?.t2s && (
                  <p className="text-xs font-bold text-primary mt-1">{liveScore.t2s}</p>
                )}
              </div>
            </div>

            {/* Live status */}
            {liveScore?.status && (
              <div className="text-center mt-3 pt-3 border-t border-surface-dim">
                <p className="text-xs text-primary font-medium">{liveScore.status}</p>
              </div>
            )}

            {!liveScore?.status && (
              <div className="text-center mt-4 pt-4 border-t border-surface-dim">
                <p className="text-sm text-on-surface-variant">
                  {new Date(match.matchDate).toLocaleDateString('en-IN', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                  {' '}at{' '}
                  {new Date(match.matchDate).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <p className="text-xs text-on-surface-variant/60 mt-1 truncate">
                  {match.venue}
                </p>
              </div>
            )}
          </Card>
        </div>

        {/* Results or Enter Results */}
        {hasResults ? (
          <>
            {/* Rankings Table */}
            <section className="mb-6">
              <p className="text-label text-on-surface-variant mb-3">RANKINGS</p>
              <Card className="!p-0">
                {existingResults
                  .sort((a, b) => a.rank - b.rank)
                  .map((result, i) => {
                    const member = group.members.find((m) => m.id === result.userId);
                    if (!member) return null;
                    const colors = getAvatarColor(member.name);
                    const netAmount = result.payout - entryAmount;
                    const isMe = member.id === currentUser.id;

                    return (
                      <div
                        key={result.userId}
                        className={`flex items-center gap-3 px-5 py-3.5 ${
                          i < existingResults.length - 1 ? 'border-b border-surface-dim' : ''
                        } ${isMe ? 'bg-primary-container/10' : ''}`}
                      >
                        <div className="w-8 text-center shrink-0">
                          {result.rank === 1 ? (
                            <Trophy className="text-amber-500 mx-auto" size={18} />
                          ) : (
                            <span className="font-headline font-bold text-on-surface-variant text-sm">
                              #{result.rank}
                            </span>
                          )}
                        </div>
                        <div
                          className={`w-9 h-9 rounded-full ${colors.bg} ${colors.text} flex items-center justify-center text-sm font-bold shrink-0`}
                        >
                          {getInitial(member.name)}
                        </div>
                        <p className="flex-1 font-medium text-on-surface text-sm truncate">
                          {isMe ? 'You' : member.name}
                        </p>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-on-surface-variant">
                            {formatAmount(result.payout)}
                          </p>
                          <p
                            className={`font-headline font-bold text-sm ${
                              netAmount > 0 ? 'text-owed' : netAmount < 0 ? 'text-owe' : 'text-on-surface-variant'
                            }`}
                          >
                            {netAmount >= 0 ? '+' : ''}
                            {formatAmount(netAmount)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </Card>
            </section>

            <div className="flex items-center justify-center gap-4 text-sm text-on-surface-variant">
              <span>Pool: {formatAmount(pool)}</span>
              <span className="w-1 h-1 rounded-full bg-on-surface-variant/30" />
              <span>Entry: {formatAmount(entryAmount)}</span>
            </div>
          </>
        ) : (
          <>
            {/* Fantasy team button + countdown */}
            <DeadlineSection
              matchDate={match.matchDate}
              hasTeam={!!existingFantasyTeam}
              onCreateTeam={() => navigate(`/group/${groupId}/match/${matchId}/create-team`)}
            />

            {/* Your team preview — only if match hasn't started */}
            {existingFantasyTeam && !matchStarted && (() => {
              const homeTeam = getTeamByName(match.teamHome);
              const awayTeam = getTeamByName(match.teamAway);
              const homeCode = homeTeam?.code ?? match.teamHome.slice(0, 3).toUpperCase();
              const awayCode = awayTeam?.code ?? match.teamAway.slice(0, 3).toUpperCase();

              const picks = existingFantasyTeam.players.map((pick) => {
                const player = IPL_PLAYERS.find((p) => p.id === pick.playerId);
                return player ? { ...player, pickRole: pick.role } : null;
              }).filter(Boolean) as (typeof IPL_PLAYERS[0] & { pickRole: string })[];

              const homePicks = picks.filter((p) => p.team === homeCode);
              const awayPicks = picks.filter((p) => p.team === awayCode);
              const totalCredits = picks.reduce((s, p) => s + p.credits, 0);

              const roleOrder = ['WK', 'BAT', 'AR', 'BOWL'];
              const sortByRole = (a: typeof picks[0], b: typeof picks[0]) =>
                roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role);

              homePicks.sort(sortByRole);
              awayPicks.sort(sortByRole);

              const renderPlayer = (player: typeof picks[0]) => {
                const isCaptain = existingFantasyTeam.captainId === player.id;
                const isVC = existingFantasyTeam.viceCaptainId === player.id;
                return (
                  <div key={player.id} className="flex items-center gap-1.5 py-[5px]">
                    <span className="text-[9px] font-bold text-on-surface-variant/50 w-6 shrink-0">{player.role}</span>
                    <span className="text-[13px] text-on-surface flex-1 truncate font-medium">
                      {player.name.split(' ').pop()}
                    </span>
                    <span className="text-[10px] text-on-surface-variant shrink-0">{player.credits}</span>
                    {isCaptain && (
                      <span className="text-[8px] font-bold text-white bg-primary rounded-full w-[18px] h-[18px] flex items-center justify-center shrink-0">C</span>
                    )}
                    {isVC && (
                      <span className="text-[8px] font-bold text-white bg-on-surface-variant rounded-full w-[18px] h-[18px] flex items-center justify-center shrink-0">V</span>
                    )}
                    {!isCaptain && !isVC && <span className="w-[18px] shrink-0" />}
                  </div>
                );
              };

              const deadline = match.matchDate - 30 * 60 * 1000;
              const canEdit = Date.now() <= deadline;

              return (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-label text-on-surface-variant">YOUR TEAM · {totalCredits}/100 cr</p>
                    {canEdit && (
                      <button
                        onClick={() => navigate(`/group/${groupId}/match/${matchId}/create-team`)}
                        className="flex items-center gap-1 text-xs font-semibold text-primary"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-white rounded-2xl card-shadow p-3 min-w-0">
                      <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-surface-dim">
                        <div
                          className="w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold shrink-0"
                          style={{ backgroundColor: homeTeam?.color ?? '#666', color: homeTeam?.textColor ?? '#fff' }}
                        >
                          {homeCode.slice(0, 2)}
                        </div>
                        <span className="text-xs font-bold text-on-surface">{homeCode}</span>
                        <span className="text-[10px] text-on-surface-variant ml-auto">{homePicks.length}</span>
                      </div>
                      {homePicks.map(renderPlayer)}
                    </div>
                    <div className="flex-1 bg-white rounded-2xl card-shadow p-3 min-w-0">
                      <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-surface-dim">
                        <div
                          className="w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold shrink-0"
                          style={{ backgroundColor: awayTeam?.color ?? '#666', color: awayTeam?.textColor ?? '#fff' }}
                        >
                          {awayCode.slice(0, 2)}
                        </div>
                        <span className="text-xs font-bold text-on-surface">{awayCode}</span>
                        <span className="text-[10px] text-on-surface-variant ml-auto">{awayPicks.length}</span>
                      </div>
                      {awayPicks.map(renderPlayer)}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* All members' teams — visible after match starts */}
            {matchStarted && allTeams.length > 0 && (
              <section className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-label text-on-surface-variant">
                    {matchPoints ? 'FANTASY LEADERBOARD' : 'ALL TEAMS'} ({allTeams.length})
                  </p>
                  {match.cricapiMatchId && !matchPoints && (
                    <button
                      onClick={handleFetchPoints}
                      disabled={calculatingPoints}
                      className="flex items-center gap-1 text-xs font-semibold text-primary disabled:opacity-50"
                    >
                      <Zap size={12} />
                      {calculatingPoints ? 'Loading...' : 'Get Points'}
                    </button>
                  )}
                  {matchPoints && (
                    <button
                      onClick={handleFetchPoints}
                      disabled={calculatingPoints}
                      className="flex items-center gap-1 text-xs font-semibold text-on-surface-variant disabled:opacity-50"
                    >
                      {calculatingPoints ? 'Refreshing...' : 'Refresh'}
                    </button>
                  )}
                </div>
                {sortedTeams.map((team, i) => renderMemberTeam(team, matchPoints ? i + 1 : undefined))}
              </section>
            )}

            {/* Admin actions */}
            {isAdmin && matchStarted && (
              <div className="space-y-3 mb-6">
                {!match.cricapiMatchId && (
                  <p className="text-xs text-on-surface-variant text-center">
                    CricAPI match ID not mapped. Use manual ranking below.
                  </p>
                )}
                <Button
                  onClick={() => setShowEnterResults(true)}
                  fullWidth
                  variant="secondary"
                  icon={<Trophy size={18} />}
                >
                  Enter Results Manually
                </Button>
              </div>
            )}

            {!matchStarted && !existingFantasyTeam && !isAdmin && (
              <div className="text-center py-8">
                <p className="text-on-surface-variant">
                  Create your team before the match starts to participate!
                </p>
              </div>
            )}

            {/* Pool info */}
            <div className="flex items-center justify-center gap-4 text-sm text-on-surface-variant mt-6">
              <span>Pool: {formatAmount(pool)}</span>
              <span className="w-1 h-1 rounded-full bg-on-surface-variant/30" />
              <span>Entry: {formatAmount(entryAmount)}</span>
              <span className="w-1 h-1 rounded-full bg-on-surface-variant/30" />
              <span>{memberCount} players</span>
            </div>
          </>
        )}
      </main>

      {/* Bottom Sheet: Enter Results */}
      {showEnterResults && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 animate-fade-in"
            onClick={() => { setShowEnterResults(false); setRankings({}); }}
          />

          <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
            <div className="max-w-2xl mx-auto bg-white rounded-t-3xl shadow-2xl px-6 pt-4 pb-8 max-h-[85vh] overflow-y-auto">
              <div className="w-10 h-1 rounded-full bg-surface-dim mx-auto mb-5" />

              <h3 className="font-headline font-bold text-lg text-on-surface mb-2">
                Enter Rankings
              </h3>
              <p className="text-sm text-on-surface-variant mb-5">
                Assign rank to each member based on their fantasy performance.
              </p>

              <div className="space-y-3 mb-6">
                {group.members.map((member) => {
                  const colors = getAvatarColor(member.name);
                  const rank = rankings[member.id];
                  const payout = rank ? payoutTable[rank - 1] || 0 : 0;
                  const net = rank ? payout - entryAmount : 0;

                  return (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 bg-surface-dim/30 rounded-2xl p-3"
                    >
                      <div
                        className={`w-9 h-9 rounded-full ${colors.bg} ${colors.text} flex items-center justify-center text-sm font-bold shrink-0`}
                      >
                        {getInitial(member.name)}
                      </div>
                      <p className="flex-1 font-medium text-on-surface text-sm truncate">
                        {member.id === currentUser.id ? 'You' : member.name}
                      </p>

                      <select
                        value={rank || ''}
                        onChange={(e) => handleRankChange(member.id, Number(e.target.value))}
                        className="bg-white rounded-xl px-3 py-2 text-sm font-semibold text-on-surface border border-surface-dim outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        <option value="">Rank</option>
                        {Array.from({ length: memberCount }, (_, i) => i + 1).map((r) => (
                          <option key={r} value={r}>
                            {r === 1 ? '1st' : r === 2 ? '2nd' : r === 3 ? '3rd' : `${r}th`}
                          </option>
                        ))}
                      </select>

                      {rank && (
                        <span
                          className={`text-sm font-bold min-w-[60px] text-right ${
                            net > 0 ? 'text-owed' : net < 0 ? 'text-owe' : 'text-on-surface-variant'
                          }`}
                        >
                          {net >= 0 ? '+' : ''}
                          {formatAmount(net)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {allAssigned && (
                <div className="bg-primary-container/20 rounded-2xl p-4 mb-5">
                  <p className="text-label text-on-surface-variant mb-2">PAYOUT PREVIEW</p>
                  <div className="text-sm text-on-surface-variant">
                    Pool: {formatAmount(pool)} &middot; Entry: {formatAmount(entryAmount)} per player
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => { setShowEnterResults(false); setRankings({}); }}
                  fullWidth
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!allAssigned || submitting}
                  fullWidth
                >
                  {submitting ? 'Submitting...' : 'Confirm Results'}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Countdown + deadline section ─── */
function DeadlineSection({
  matchDate,
  hasTeam,
  onCreateTeam,
}: {
  matchDate: number;
  hasTeam: boolean;
  onCreateTeam: () => void;
}) {
  const deadline = matchDate - 30 * 60 * 1000;
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const isLocked = now > deadline;
  const remaining = deadline - now;
  const deadlineStr = new Date(deadline).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const formatCountdown = (ms: number) => {
    if (ms <= 0) return '0:00:00';
    const totalSec = Math.floor(ms / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');

    if (days > 0) return `${days}d ${hours}h ${pad(minutes)}m`;
    if (hours > 0) return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
    return `${minutes}m ${pad(seconds)}s`;
  };

  const isUrgent = remaining > 0 && remaining < 60 * 60 * 1000;

  return (
    <div className="mb-4">
      {isLocked ? (
        <div className="text-center">
          {hasTeam ? (
            <div className="bg-green-50 rounded-2xl p-4 mb-2">
              <p className="text-sm font-semibold text-owed">Team submitted</p>
              <p className="text-xs text-on-surface-variant mt-1">Locked at {deadlineStr}</p>
            </div>
          ) : (
            <div className="bg-owe-container rounded-2xl p-4 mb-2">
              <p className="text-sm font-semibold text-owe">Team creation closed</p>
              <p className="text-xs text-on-surface-variant mt-1">Deadline was {deadlineStr}</p>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className={`rounded-2xl p-3 mb-3 flex items-center justify-center gap-2 ${
            isUrgent ? 'bg-owe-container' : 'bg-primary-container/30'
          }`}>
            <Clock size={14} className={isUrgent ? 'text-owe' : 'text-primary'} />
            <span className={`text-xs font-medium ${isUrgent ? 'text-owe' : 'text-on-surface-variant'}`}>
              Team locks in
            </span>
            <span className={`font-headline font-bold text-sm ${isUrgent ? 'text-owe' : 'text-primary'}`}>
              {formatCountdown(remaining)}
            </span>
          </div>

          <Button
            onClick={onCreateTeam}
            fullWidth
            variant={hasTeam ? 'secondary' : 'primary'}
            icon={<Users size={18} />}
          >
            {hasTeam ? 'View / Edit Team' : 'Create Fantasy Team'}
          </Button>
        </>
      )}
    </div>
  );
}
