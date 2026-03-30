import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, Trophy, ArrowRightLeft, Users, Settings, ChevronRight, Crown, Info, ChevronDown, RefreshCw } from 'lucide-react';
import { useStore } from '../store';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { PullToRefresh } from '../components/PullToRefresh';
import { usePageTitle } from '../hooks/usePageTitle';
import { getTeamByName, calculatePayouts } from '../utils/ipl';
import { getAvatarColor, getInitial } from '../utils/avatarColor';
import { calculateBalances } from '../utils/balance';
import { formatAmount } from '../utils/currency';

export function GroupDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { groups, iplSchedule, matchResults, transactions, currentUser, fetchFromSupabase } = useStore();

  const group = groups.find((g) => g.id === id);
  usePageTitle(group ? `${group.name} | Gully11` : 'Gully11');

  const { isScheduleLoaded } = useStore();

  // Show loading only if we have NO data at all (fresh load, not from cache)
  if (!group && !isScheduleLoaded) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <RefreshCw size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-on-surface-variant">League not found</p>
      </div>
    );
  }

  const groupResults = matchResults.filter((r) => r.groupId === id);
  const groupTransactions = transactions.filter((t) => t.groupId === id);
  const completedMatchIds = new Set(groupResults.map((r) => r.matchId));

  // Next 2 upcoming matches (hide past matches even if not finalized)
  const now = Date.now();
  const upcomingMatches = useMemo(() => {
    return iplSchedule
      .filter((m) => !completedMatchIds.has(m.id) && m.matchDate > now - 5 * 60 * 60 * 1000)
      .sort((a, b) => a.matchDate - b.matchDate)
      .slice(0, 2);
  }, [iplSchedule, completedMatchIds, now]);

  // Recent completed results (last 3)
  const recentCompleted = useMemo(() => {
    const completedIds = Array.from(completedMatchIds);
    return iplSchedule
      .filter((m) => completedIds.includes(m.id))
      .sort((a, b) => b.matchDate - a.matchDate)
      .slice(0, 3);
  }, [iplSchedule, completedMatchIds]);

  // Leaderboard: top 3
  const balances = calculateBalances(groupTransactions);
  const leaderboard = useMemo(() => {
    return group.members
      .map((m) => ({
        ...m,
        balance: balances[m.id] || 0,
      }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 3);
  }, [group.members, balances]);

  const isAdmin = group.members.find((m) => m.id === currentUser.id)?.isAdmin;
  const [showRules, setShowRules] = useState(false);

  const navItems = [
    { label: 'All Matches', icon: Calendar, path: `/group/${id}/matches` },
    { label: 'Leaderboard', icon: Trophy, path: `/group/${id}/leaderboard` },
    { label: 'Settlements', icon: ArrowRightLeft, path: `/group/${id}/settlements` },
    { label: 'Members', icon: Users, path: `/group/${id}/members` },
    { label: 'Settings', icon: Settings, path: `/group/${id}/settings` },
  ];

  return (
    <div className="min-h-screen bg-surface">
      <Header
        variant="page"
        title={group.name}
        showBack
        backTo="/"
        rightAction={
          isAdmin ? (
            <button
              onClick={() => navigate(`/group/${id}/settings`)}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-dim transition-colors"
            >
              <Settings size={20} className="text-on-surface-variant" />
            </button>
          ) : undefined
        }
      />
      <PullToRefresh onRefresh={fetchFromSupabase}>
      <main className="px-6 pb-8 max-w-2xl mx-auto">
        {/* Upcoming Matches */}
        {upcomingMatches.length > 0 && (
          <section className="mt-2 mb-6">
            <p className="text-label text-on-surface-variant mb-3">UPCOMING MATCHES</p>
            <div className="space-y-3">
              {upcomingMatches.map((match) => {
                const home = getTeamByName(match.teamHome);
                const away = getTeamByName(match.teamAway);
                const dateStr = new Date(match.matchDate).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                });
                const timeStr = new Date(match.matchDate).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <Card
                    key={match.id}
                    onClick={() => navigate(`/group/${id}/match/${match.id}`)}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 text-center">
                        <div
                          className="w-12 h-12 rounded-xl mx-auto mb-2 flex items-center justify-center text-xs font-bold"
                          style={{ backgroundColor: home?.color || '#666', color: home?.textColor || '#fff' }}
                        >
                          {home?.code || match.teamHome.slice(0, 3).toUpperCase()}
                        </div>
                        <p className="text-sm font-semibold text-on-surface truncate">
                          {home?.shortName || match.teamHome}
                        </p>
                      </div>

                      <div className="text-center shrink-0">
                        <p className="font-headline font-bold text-on-surface-variant text-lg">VS</p>
                        <p className="text-xs text-on-surface-variant mt-1">{dateStr}</p>
                        <p className="text-xs text-on-surface-variant">{timeStr}</p>
                      </div>

                      <div className="flex-1 text-center">
                        <div
                          className="w-12 h-12 rounded-xl mx-auto mb-2 flex items-center justify-center text-xs font-bold"
                          style={{ backgroundColor: away?.color || '#666', color: away?.textColor || '#fff' }}
                        >
                          {away?.code || match.teamAway.slice(0, 3).toUpperCase()}
                        </div>
                        <p className="text-sm font-semibold text-on-surface truncate">
                          {away?.shortName || match.teamAway}
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-on-surface-variant text-center mt-3 truncate">
                      {match.venue}
                    </p>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* Quick Leaderboard */}
        {leaderboard.length > 0 && groupTransactions.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-label text-on-surface-variant">LEADERBOARD</p>
              <button
                onClick={() => navigate(`/group/${id}/leaderboard`)}
                className="text-xs font-semibold text-primary"
              >
                View all
              </button>
            </div>
            <Card>
              <div className="space-y-3">
                {leaderboard.map((member, i) => {
                  const colors = getAvatarColor(member.name);
                  const isMe = member.id === currentUser.id;
                  return (
                    <div
                      key={member.id}
                      className={`flex items-center gap-3 ${isMe ? 'bg-primary-container/20 -mx-2 px-2 py-1.5 rounded-xl' : ''}`}
                    >
                      {/* Rank */}
                      <div className="w-7 text-center shrink-0">
                        {i === 0 ? (
                          <Crown className="text-amber-500 mx-auto" size={18} />
                        ) : (
                          <span className="font-headline font-bold text-on-surface-variant text-sm">
                            {i + 1}
                          </span>
                        )}
                      </div>

                      {/* Avatar */}
                      <div
                        className={`w-9 h-9 rounded-full ${colors.bg} ${colors.text} flex items-center justify-center text-sm font-bold shrink-0`}
                      >
                        {getInitial(member.name)}
                      </div>

                      {/* Name */}
                      <p className="flex-1 font-medium text-on-surface text-sm truncate">
                        {isMe ? 'You' : member.name}
                      </p>

                      {/* Balance */}
                      <p
                        className={`font-headline font-bold text-sm shrink-0 ${
                          member.balance > 0
                            ? 'text-owed'
                            : member.balance < 0
                              ? 'text-owe'
                              : 'text-on-surface-variant'
                        }`}
                      >
                        {member.balance >= 0 ? '+' : '-'}
                        {formatAmount(Math.abs(member.balance))}
                      </p>
                    </div>
                  );
                })}
              </div>
            </Card>
          </section>
        )}

        {/* Recent Results */}
        {recentCompleted.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-label text-on-surface-variant">RECENT RESULTS</p>
              <button
                onClick={() => navigate(`/group/${id}/matches`)}
                className="text-xs font-semibold text-primary"
              >
                View all
              </button>
            </div>
            <div className="space-y-2">
              {recentCompleted.map((match) => {
                const home = getTeamByName(match.teamHome);
                const away = getTeamByName(match.teamAway);
                return (
                  <Card
                    key={match.id}
                    onClick={() => navigate(`/group/${id}/match/${match.id}`)}
                    className="!p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
                          style={{ backgroundColor: home?.color || '#666', color: home?.textColor || '#fff' }}
                        >
                          {home?.code || match.teamHome.slice(0, 3).toUpperCase()}
                        </div>
                        <span className="text-xs text-on-surface-variant">vs</span>
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
                          style={{ backgroundColor: away?.color || '#666', color: away?.textColor || '#fff' }}
                        >
                          {away?.code || match.teamAway.slice(0, 3).toUpperCase()}
                        </div>
                        <span className="text-sm text-on-surface font-medium truncate ml-1">
                          Match #{match.id}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-owed bg-green-50 px-2 py-0.5 rounded-full shrink-0">
                        Results
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* League Rules */}
        <section className="mb-6">
          <button
            onClick={() => setShowRules(!showRules)}
            className="w-full flex items-center gap-3 bg-primary-container/30 rounded-2xl px-4 py-3.5 text-left active:scale-[0.98] transition-transform"
          >
            <div className="w-9 h-9 rounded-xl bg-primary-container/60 flex items-center justify-center shrink-0">
              <Info className="text-primary" size={18} strokeWidth={1.8} />
            </div>
            <span className="flex-1 font-semibold text-sm text-on-surface">League Rules</span>
            <ChevronDown
              size={18}
              className={`text-on-surface-variant transition-transform ${showRules ? 'rotate-180' : ''}`}
            />
          </button>

          {showRules && (
            <div className="bg-white rounded-2xl card-shadow p-5 mt-2 animate-fade-in">
              <div className="space-y-4">
                <div>
                  <p className="text-label text-on-surface-variant mb-2">ENTRY FEE</p>
                  <p className="text-sm text-on-surface">
                    Entry fee is <span className="font-bold">₹{group.entryAmount}</span> per match. Only members who create a fantasy team participate and pay — skip a match, no charge.
                  </p>
                </div>

                <div>
                  <p className="text-label text-on-surface-variant mb-2">HOW TO PLAY</p>
                  <p className="text-sm text-on-surface">
                    Play each IPL match on Dream11. After the match, the admin enters everyone's Dream11 ranking in this app.
                  </p>
                </div>

                <div>
                  <p className="text-label text-on-surface-variant mb-2">WINNINGS</p>
                  <p className="text-sm text-on-surface mb-2">
                    Total pool = {group.members.length} members × ₹{group.entryAmount} = <span className="font-bold">₹{group.members.length * group.entryAmount}</span> per match
                  </p>
                  {(() => {
                    const payouts = calculatePayouts(group.members.length, group.entryAmount);
                    return (
                      <div className="bg-surface-dim/30 rounded-xl p-3 space-y-1">
                        {payouts.map((payout, i) => {
                          const net = payout - group.entryAmount;
                          if (i >= group.members.length) return null;
                          return (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span className="text-on-surface-variant">
                                {i === 0 ? '1st' : i === 1 ? '2nd' : i === 2 ? '3rd' : `${i + 1}th`} place
                              </span>
                              <span className={`font-semibold ${net > 0 ? 'text-owed' : net < 0 ? 'text-owe' : 'text-on-surface-variant'}`}>
                                {net > 0 ? '+' : ''}{net === 0 ? 'Break even' : `₹${net}`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                <div>
                  <p className="text-label text-on-surface-variant mb-2">SETTLEMENTS</p>
                  <p className="text-sm text-on-surface">
                    The app tracks running balances across all matches. Settle balances at the end once IPL is complete — check the Settlements page to see who owes whom.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Navigation */}
        <section className="mt-2">
          <div className="bg-white rounded-2xl card-shadow overflow-hidden">
            {navItems.map((item, i) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-surface-dim/30 active:bg-surface-dim/50 transition-colors ${
                    i < navItems.length - 1 ? 'border-b border-surface-dim' : ''
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-primary-container/60 flex items-center justify-center shrink-0">
                    <Icon className="text-primary" size={18} strokeWidth={1.8} />
                  </div>
                  <span className="flex-1 font-medium text-on-surface text-sm">{item.label}</span>
                  <ChevronRight size={18} className="text-on-surface-variant/40" />
                </button>
              );
            })}
          </div>
        </section>
      </main>
      </PullToRefresh>
    </div>
  );
}
