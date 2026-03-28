import { useParams } from 'react-router-dom';
import { UserCheck, Clock, Shield } from 'lucide-react';
import { useStore } from '../store';
import { Header } from '../components/Header';
import { usePageTitle } from '../hooks/usePageTitle';
import { getAvatarColor, getInitial } from '../utils/avatarColor';
import { calculateBalances } from '../utils/balance';
import { formatAmount } from '../utils/currency';

export function MembersPage() {
  usePageTitle('Members | Gully11');
  const { id } = useParams<{ id: string }>();
  const { groups, transactions, currentUser } = useStore();

  const group = groups.find((g) => g.id === id);
  const groupTransactions = transactions.filter((t) => t.groupId === id);
  const balances = calculateBalances(groupTransactions);

  if (!group) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-on-surface-variant">League not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <Header variant="page" title="Members" showBack />

      <main className="px-6 pb-8 max-w-2xl mx-auto">
        <p className="text-label text-on-surface-variant mt-4 mb-3">
          {group.members.length} {group.members.length === 1 ? 'MEMBER' : 'MEMBERS'}
        </p>

        <div className="bg-white rounded-2xl card-shadow overflow-hidden">
          {group.members.map((member, i) => {
            const isMe = member.id === currentUser.id;
            const balance = balances[member.id] || 0;
            const colors = getAvatarColor(member.name);

            return (
              <div
                key={member.id}
                className={`p-4 flex items-center gap-3 ${
                  i < group.members.length - 1 ? 'border-b border-surface-dim' : ''
                } ${isMe ? 'bg-primary-container/10' : ''}`}
              >
                {/* Avatar */}
                <div
                  className={`w-11 h-11 rounded-full ${colors.bg} ${colors.text} flex items-center justify-center text-sm font-bold shrink-0`}
                >
                  {getInitial(member.name)}
                </div>

                {/* Name + Status */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-on-surface truncate">
                      {isMe ? 'You' : member.name}
                    </p>
                    {member.isAdmin && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary bg-primary-container/60 px-1.5 py-0.5 rounded-full">
                        <Shield size={10} />
                        Admin
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-0.5">
                    {member.isRegistered ? (
                      <>
                        <UserCheck size={12} className="text-owed" />
                        <span>Joined</span>
                      </>
                    ) : (
                      <>
                        <Clock size={12} className="text-on-surface-variant/60" />
                        <span>Pending invite</span>
                      </>
                    )}
                  </p>
                </div>

                {/* Balance */}
                <div className="text-right shrink-0">
                  {groupTransactions.length === 0 ? (
                    <span className="text-xs text-on-surface-variant">--</span>
                  ) : Math.abs(balance) < 0.01 ? (
                    <span className="text-sm text-on-surface-variant">settled</span>
                  ) : (
                    <p
                      className={`font-headline font-bold text-sm ${
                        balance > 0 ? 'text-owed' : 'text-owe'
                      }`}
                    >
                      {balance >= 0 ? '+' : '-'}
                      {formatAmount(Math.abs(balance))}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
