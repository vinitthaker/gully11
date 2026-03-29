import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Crown } from 'lucide-react';
import { useStore } from '../store';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { PullToRefresh } from '../components/PullToRefresh';
import { usePageTitle } from '../hooks/usePageTitle';
import { getAvatarColor, getInitial } from '../utils/avatarColor';
import { calculateBalances } from '../utils/balance';
import { formatAmount } from '../utils/currency';

export function LeaderboardPage() {
  usePageTitle('Leaderboard | Gully11');
  const { id } = useParams<{ id: string }>();
  const { groups, transactions, fantasyTeams, matchResults, currentUser, fetchFromSupabase } = useStore();

  const group = groups.find((g) => g.id === id);
  const groupTransactions = transactions.filter((t) => t.groupId === id);
  const balances = calculateBalances(groupTransactions);

  // Count matches played and total fantasy points per member
  const memberStats = useMemo(() => {
    if (!group) return {};
    const stats: Record<string, { matchesPlayed: number; totalPoints: number; wins: number }> = {};

    for (const m of group.members) {
      const memberTeams = fantasyTeams.filter((t) => t.userId === m.id);
      const memberResults = matchResults.filter((r) => r.groupId === id && r.userId === m.id);
      const wins = memberResults.filter((r) => r.rank === 1).length;

      stats[m.id] = {
        matchesPlayed: memberTeams.length,
        totalPoints: memberTeams.reduce((sum, t) => sum + (t.totalPoints || 0), 0),
        wins,
      };
    }
    return stats;
  }, [group, fantasyTeams, matchResults, id]);

  const leaderboard = useMemo(() => {
    if (!group) return [];
    return group.members
      .map((m) => ({
        ...m,
        balance: balances[m.id] || 0,
        ...memberStats[m.id],
      }))
      .sort((a, b) => b.balance - a.balance);
  }, [group, balances, memberStats]);

  if (!group) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-on-surface-variant">League not found</p>
      </div>
    );
  }

  const hasAnyData = groupTransactions.length > 0 || fantasyTeams.length > 0;

  return (
    <div className="min-h-screen bg-surface">
      <Header variant="page" title="Leaderboard" showBack />
      <PullToRefresh onRefresh={fetchFromSupabase}>
      <main className="px-6 pb-8 max-w-2xl mx-auto">
        {!hasAnyData ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-[1.5rem] bg-primary-container/40 mx-auto mb-5 flex items-center justify-center">
              <Crown className="text-primary" size={32} strokeWidth={1.5} />
            </div>
            <h2 className="font-headline font-bold text-xl text-on-surface mb-2">
              No results yet
            </h2>
            <p className="text-on-surface-variant leading-relaxed max-w-xs mx-auto">
              The leaderboard will update once match results are entered.
            </p>
          </div>
        ) : (
          <div className="mt-4">
            <Card className="!p-0">
              {leaderboard.map((member, i) => {
                const colors = getAvatarColor(member.name);
                const isMe = member.id === currentUser.id;
                const rank = i + 1;

                return (
                  <div
                    key={member.id}
                    className={`flex items-center gap-3 px-5 py-4 ${
                      i < leaderboard.length - 1 ? 'border-b border-surface-dim' : ''
                    } ${isMe ? 'bg-primary-container/10' : ''}`}
                  >
                    {/* Rank */}
                    <div className="w-8 text-center shrink-0">
                      {rank === 1 ? (
                        <Crown className="text-amber-500 mx-auto" size={20} />
                      ) : (
                        <span className="font-headline font-bold text-on-surface-variant">
                          {rank}
                        </span>
                      )}
                    </div>

                    {/* Avatar */}
                    <div
                      className={`w-11 h-11 rounded-full ${colors.bg} ${colors.text} flex items-center justify-center text-sm font-bold shrink-0`}
                    >
                      {getInitial(member.name)}
                    </div>

                    {/* Name + stats */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-on-surface truncate">
                        {isMe ? 'You' : member.name}
                      </p>
                      <div className="flex gap-2 text-[10px] text-on-surface-variant mt-0.5">
                        {member.matchesPlayed !== undefined && member.matchesPlayed > 0 && (
                          <span>{member.matchesPlayed} matches</span>
                        )}
                        {member.wins !== undefined && member.wins > 0 && (
                          <span>· {member.wins} {member.wins === 1 ? 'win' : 'wins'}</span>
                        )}
                      </div>
                    </div>

                    {/* Balance */}
                    <p
                      className={`font-headline font-bold shrink-0 ${
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
            </Card>
          </div>
        )}
      </main>
      </PullToRefresh>
    </div>
  );
}
