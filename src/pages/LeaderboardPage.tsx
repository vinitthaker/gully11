import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Crown } from 'lucide-react';
import { useStore } from '../store';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { usePageTitle } from '../hooks/usePageTitle';
import { getAvatarColor, getInitial } from '../utils/avatarColor';
import { calculateBalances } from '../utils/balance';
import { formatAmount } from '../utils/currency';

export function LeaderboardPage() {
  usePageTitle('Leaderboard | Gully11');
  const { id } = useParams<{ id: string }>();
  const { groups, transactions, currentUser } = useStore();

  const group = groups.find((g) => g.id === id);
  const groupTransactions = transactions.filter((t) => t.groupId === id);
  const balances = calculateBalances(groupTransactions);

  const leaderboard = useMemo(() => {
    if (!group) return [];
    return group.members
      .map((m) => ({
        ...m,
        balance: balances[m.id] || 0,
      }))
      .sort((a, b) => b.balance - a.balance);
  }, [group, balances]);

  if (!group) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-on-surface-variant">League not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <Header variant="page" title="Leaderboard" showBack />

      <main className="px-6 pb-8 max-w-2xl mx-auto">
        {groupTransactions.length === 0 ? (
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

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-on-surface truncate">
                        {isMe ? 'You' : member.name}
                      </p>
                      {isMe && (
                        <p className="text-xs text-primary font-medium">Your position</p>
                      )}
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
    </div>
  );
}
