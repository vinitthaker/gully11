import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useStore } from '../store';
import { Header } from '../components/Header';
import { usePageTitle } from '../hooks/usePageTitle';
import { useLiveScoring } from '../hooks/useLiveScoring';
import { getAvatarColor, getInitial } from '../utils/avatarColor';
import { IPL_PLAYERS } from '../utils/players';
import type { TeamScore } from '../lib/scoring';
import type { FantasyTeam } from '../types';

export function CompareTeamsPage() {
  const { id: groupId, matchId: matchIdStr, compareUserId } = useParams<{
    id: string;
    matchId: string;
    compareUserId: string;
  }>();
  const matchId = Number(matchIdStr);
  usePageTitle('Compare Teams | Gully11');

  const { groups, iplSchedule, currentUser, getFantasyTeamsByMatch } = useStore();
  const authUser = useStore((s) => s.authUser);
  const group = groups.find((g) => g.id === groupId);
  const match = iplSchedule.find((m) => m.id === matchId);
  const allTeams = getFantasyTeamsByMatch(matchId);
  const matchStarted = match ? Date.now() > match.matchDate : false;
  const isAdmin = group?.members.find((m) => m.id === currentUser.id)?.isAdmin;

  const myTeam = allTeams.find((t) => t.userId === currentUser.id);
  const theirTeam = allTeams.find((t) => t.userId === compareUserId);
  const theirMember = group?.members.find((m) => m.id === compareUserId);

  const { teamScores, playerIdMap } = useLiveScoring({
    cricbuzzMatchId: match?.cricbuzzMatchId,
    matchId,
    matchStarted,
    teams: allTeams,
    enabled: matchStarted && allTeams.length > 0,
    isAdmin: !!isAdmin,
    authUserId: authUser?.id,
  });

  const scoresByUser = useMemo(() => {
    const map: Record<string, TeamScore> = {};
    teamScores.forEach((ts) => { map[ts.userId] = ts; });
    return map;
  }, [teamScores]);

  const myScore = scoresByUser[currentUser.id];
  const theirScore = compareUserId ? scoresByUser[compareUserId] : undefined;

  const { isScheduleLoaded } = useStore();

  if ((!group || !match) && !isScheduleLoaded) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <RefreshCw size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!group || !match || !myTeam || !theirTeam || !theirMember) {
    return (
      <div className="min-h-screen bg-surface">
        <Header variant="page" title="Compare" showBack />
        <div className="flex items-center justify-center py-16">
          <p className="text-on-surface-variant">Team not found</p>
        </div>
      </div>
    );
  }

  const myColors = getAvatarColor(currentUser.name);
  const theirColors = getAvatarColor(theirMember.name);
  const pointDiff = (myScore?.totalPoints ?? 0) - (theirScore?.totalPoints ?? 0);

  // Build enriched player lists
  function enrichPlayers(team: FantasyTeam, score?: TeamScore) {
    const roleOrder = ['WK', 'BAT', 'AR', 'BOWL'];
    return team.players
      .map((pick) => {
        const player = IPL_PLAYERS.find((p) => p.id === pick.playerId);
        const mappedId = playerIdMap.get(pick.playerId) || pick.playerId;
        const playerScore = score?.playerScores.find((ps) => ps.playerId === mappedId);
        const isCaptain = team.captainId === pick.playerId;
        const isVC = team.viceCaptainId === pick.playerId;
        return {
          id: pick.playerId,
          name: player?.name || pick.playerId,
          role: pick.role,
          team: player?.team || '',
          isCaptain,
          isVC,
          points: playerScore?.totalPoints ?? 0,
          basePoints: playerScore?.basePoints ?? 0,
          multiplier: playerScore?.multiplier ?? 1,
          breakdown: playerScore?.breakdown,
        };
      })
      .sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role));
  }

  const myPlayers = enrichPlayers(myTeam, myScore);
  const theirPlayers = enrichPlayers(theirTeam, theirScore);

  // Find common and unique picks
  const myPlayerIds = new Set(myPlayers.map((p) => p.id));
  const theirPlayerIds = new Set(theirPlayers.map((p) => p.id));
  const commonIds = new Set([...myPlayerIds].filter((id) => theirPlayerIds.has(id)));

  // Category totals
  function getCategoryTotals(score?: TeamScore) {
    if (!score) return { batting: 0, bowling: 0, fielding: 0, bonus: 0 };
    return {
      batting: score.playerScores.reduce((s, p) => s + (p.breakdown.batting || 0), 0),
      bowling: score.playerScores.reduce((s, p) => s + (p.breakdown.bowling || 0), 0),
      fielding: score.playerScores.reduce((s, p) => s + (p.breakdown.fielding || 0), 0),
      bonus: score.playerScores.reduce((s, p) => s + (p.breakdown.bonus || 0), 0),
    };
  }

  const myCats = getCategoryTotals(myScore);
  const theirCats = getCategoryTotals(theirScore);

  return (
    <div className="min-h-screen bg-surface">
      <Header variant="page" title="Compare Teams" showBack />

      <main className="px-4 pb-8 max-w-2xl mx-auto">
        {/* Summary Header */}
        <div className="mt-4 mb-5 bg-white rounded-2xl card-shadow p-4">
          <div className="flex items-center justify-between mb-4">
            {/* My side */}
            <div className="flex items-center gap-2 flex-1">
              <div className={`w-10 h-10 rounded-full ${myColors.bg} ${myColors.text} flex items-center justify-center text-sm font-bold shrink-0`}>
                {getInitial(currentUser.name)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-primary truncate">You</p>
                <p className="font-headline font-bold text-lg text-on-surface">
                  {myScore?.totalPoints ?? 0}
                </p>
              </div>
            </div>

            {/* Diff */}
            <div className="text-center px-3">
              <p className="text-[10px] text-on-surface-variant mb-0.5">DIFF</p>
              <p className={`font-headline font-bold text-lg ${
                pointDiff > 0 ? 'text-owed' : pointDiff < 0 ? 'text-owe' : 'text-on-surface-variant'
              }`}>
                {pointDiff > 0 ? '+' : ''}{pointDiff}
              </p>
            </div>

            {/* Their side */}
            <div className="flex items-center gap-2 flex-1 justify-end">
              <div className="min-w-0 text-right">
                <p className="text-sm font-semibold text-on-surface truncate">{theirMember.name}</p>
                <p className="font-headline font-bold text-lg text-on-surface">
                  {theirScore?.totalPoints ?? 0}
                </p>
              </div>
              <div className={`w-10 h-10 rounded-full ${theirColors.bg} ${theirColors.text} flex items-center justify-center text-sm font-bold shrink-0`}>
                {getInitial(theirMember.name)}
              </div>
            </div>
          </div>

          {/* Category breakdown bars */}
          <div className="space-y-2">
            {(['batting', 'bowling', 'fielding', 'bonus'] as const).map((cat) => {
              const myVal = myCats[cat];
              const theirVal = theirCats[cat];
              const max = Math.max(Math.abs(myVal), Math.abs(theirVal), 1);
              return (
                <div key={cat} className="flex items-center gap-2">
                  <span className="text-[10px] text-on-surface-variant w-11 text-right capitalize">{cat}</span>
                  <div className="flex-1 flex items-center gap-1">
                    {/* My bar (right-aligned, grows left) */}
                    <div className="flex-1 flex justify-end">
                      <div
                        className="h-3 rounded-full bg-primary/70 transition-all"
                        style={{ width: `${(Math.abs(myVal) / max) * 100}%`, minWidth: myVal ? 4 : 0 }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-on-surface w-7 text-center">{myVal}</span>
                    <span className="text-[10px] text-on-surface-variant">|</span>
                    <span className="text-[10px] font-bold text-on-surface w-7 text-center">{theirVal}</span>
                    {/* Their bar (left-aligned, grows right) */}
                    <div className="flex-1">
                      <div
                        className="h-3 rounded-full bg-on-surface-variant/30 transition-all"
                        style={{ width: `${(Math.abs(theirVal) / max) * 100}%`, minWidth: theirVal ? 4 : 0 }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Player-by-player comparison */}
        <p className="text-label text-on-surface-variant mb-3">PLAYER COMPARISON</p>

        {/* Common picks */}
        {commonIds.size > 0 && (
          <div className="mb-4">
            <p className="text-[10px] font-semibold text-on-surface-variant mb-2 px-1">
              COMMON PICKS ({commonIds.size})
            </p>
            <div className="bg-white rounded-2xl card-shadow overflow-hidden">
              {myPlayers.filter((p) => commonIds.has(p.id)).map((myP, i, arr) => {
                const theirP = theirPlayers.find((p) => p.id === myP.id)!;
                const diff = myP.points - theirP.points;
                return (
                  <div key={myP.id} className={`px-4 py-3 ${i < arr.length - 1 ? 'border-b border-surface-dim' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-[9px] font-bold text-on-surface-variant/50 w-7 shrink-0">{myP.role}</span>
                        <span className="text-[13px] font-medium text-on-surface truncate">{myP.name}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {/* My points + badge */}
                        <div className="text-right w-12">
                          <span className="text-xs font-bold text-primary">{myP.points}</span>
                          {myP.isCaptain && <span className="ml-0.5 text-[8px] font-bold text-white bg-primary rounded-full w-[14px] h-[14px] inline-flex items-center justify-center">C</span>}
                          {myP.isVC && <span className="ml-0.5 text-[8px] font-bold text-white bg-on-surface-variant rounded-full w-[14px] h-[14px] inline-flex items-center justify-center">V</span>}
                        </div>
                        {/* Diff */}
                        {diff !== 0 && (
                          <span className={`text-[10px] font-bold w-8 text-center ${diff > 0 ? 'text-owed' : 'text-owe'}`}>
                            {diff > 0 ? '+' : ''}{diff}
                          </span>
                        )}
                        {diff === 0 && <span className="text-[10px] text-on-surface-variant w-8 text-center">=</span>}
                        {/* Their points + badge */}
                        <div className="text-left w-12">
                          {theirP.isCaptain && <span className="mr-0.5 text-[8px] font-bold text-white bg-primary rounded-full w-[14px] h-[14px] inline-flex items-center justify-center">C</span>}
                          {theirP.isVC && <span className="mr-0.5 text-[8px] font-bold text-white bg-on-surface-variant rounded-full w-[14px] h-[14px] inline-flex items-center justify-center">V</span>}
                          <span className="text-xs font-bold text-on-surface">{theirP.points}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Unique picks */}
        {(myPlayerIds.size > commonIds.size || theirPlayerIds.size > commonIds.size) && (
          <div className="mb-4">
            <p className="text-[10px] font-semibold text-on-surface-variant mb-2 px-1">
              DIFFERENT PICKS
            </p>
            <div className="grid grid-cols-2 gap-3">
              {/* My unique */}
              <div>
                <p className="text-[10px] text-primary font-semibold mb-1.5 px-1">You</p>
                <div className="bg-white rounded-2xl card-shadow overflow-hidden">
                  {myPlayers.filter((p) => !commonIds.has(p.id)).map((p, i, arr) => (
                    <div key={p.id} className={`px-3 py-2.5 ${i < arr.length - 1 ? 'border-b border-surface-dim' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] font-bold text-on-surface-variant/50">{p.role}</span>
                            {p.isCaptain && <span className="text-[8px] font-bold text-white bg-primary rounded-full w-[14px] h-[14px] inline-flex items-center justify-center">C</span>}
                            {p.isVC && <span className="text-[8px] font-bold text-white bg-on-surface-variant rounded-full w-[14px] h-[14px] inline-flex items-center justify-center">V</span>}
                          </div>
                          <p className="text-[12px] font-medium text-on-surface truncate">{p.name}</p>
                        </div>
                        <span className={`text-xs font-bold shrink-0 ${p.points > 0 ? 'text-owed' : p.points < 0 ? 'text-owe' : 'text-on-surface-variant'}`}>
                          {p.points}
                        </span>
                      </div>
                    </div>
                  ))}
                  {myPlayers.filter((p) => !commonIds.has(p.id)).length === 0 && (
                    <p className="text-[11px] text-on-surface-variant text-center py-3">None</p>
                  )}
                </div>
              </div>

              {/* Their unique */}
              <div>
                <p className="text-[10px] text-on-surface font-semibold mb-1.5 px-1">{theirMember.name.split(' ')[0]}</p>
                <div className="bg-white rounded-2xl card-shadow overflow-hidden">
                  {theirPlayers.filter((p) => !commonIds.has(p.id)).map((p, i, arr) => (
                    <div key={p.id} className={`px-3 py-2.5 ${i < arr.length - 1 ? 'border-b border-surface-dim' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] font-bold text-on-surface-variant/50">{p.role}</span>
                            {p.isCaptain && <span className="text-[8px] font-bold text-white bg-primary rounded-full w-[14px] h-[14px] inline-flex items-center justify-center">C</span>}
                            {p.isVC && <span className="text-[8px] font-bold text-white bg-on-surface-variant rounded-full w-[14px] h-[14px] inline-flex items-center justify-center">V</span>}
                          </div>
                          <p className="text-[12px] font-medium text-on-surface truncate">{p.name}</p>
                        </div>
                        <span className={`text-xs font-bold shrink-0 ${p.points > 0 ? 'text-owed' : p.points < 0 ? 'text-owe' : 'text-on-surface-variant'}`}>
                          {p.points}
                        </span>
                      </div>
                    </div>
                  ))}
                  {theirPlayers.filter((p) => !commonIds.has(p.id)).length === 0 && (
                    <p className="text-[11px] text-on-surface-variant text-center py-3">None</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick stats */}
        <div className="bg-white rounded-2xl card-shadow p-4">
          <p className="text-[10px] font-semibold text-on-surface-variant mb-3">QUICK STATS</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-[10px] text-on-surface-variant">Common</p>
              <p className="font-headline font-bold text-on-surface">{commonIds.size}/11</p>
            </div>
            <div>
              <p className="text-[10px] text-on-surface-variant">Your unique</p>
              <p className="font-headline font-bold text-primary">{11 - commonIds.size}</p>
            </div>
            <div>
              <p className="text-[10px] text-on-surface-variant">{theirMember.name.split(' ')[0]}'s unique</p>
              <p className="font-headline font-bold text-on-surface">{11 - commonIds.size}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
