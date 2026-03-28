import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowRight, CheckCircle } from 'lucide-react';
import { useStore } from '../store';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { usePageTitle } from '../hooks/usePageTitle';
import { getAvatarColor, getInitial } from '../utils/avatarColor';
import { calculateBalances, simplifyDebts } from '../utils/balance';
import { formatAmount } from '../utils/currency';

export function SettlementsPage() {
  usePageTitle('Settlements | Gully11');
  const { id } = useParams<{ id: string }>();
  const { groups, transactions } = useStore();

  const group = groups.find((g) => g.id === id);
  const groupTransactions = transactions.filter((t) => t.groupId === id);
  const balances = calculateBalances(groupTransactions);

  const debts = useMemo(() => simplifyDebts(balances), [balances]);

  // Create name lookup
  const nameMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (group) {
      for (const m of group.members) {
        map[m.id] = m.name;
      }
    }
    return map;
  }, [group]);

  if (!group) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-on-surface-variant">League not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <Header variant="page" title="Settlements" showBack />

      <main className="px-6 pb-8 max-w-2xl mx-auto">
        {debts.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-[1.5rem] bg-green-50 mx-auto mb-5 flex items-center justify-center">
              <CheckCircle className="text-owed" size={36} strokeWidth={1.5} />
            </div>
            <h2 className="font-headline font-bold text-xl text-on-surface mb-2">
              All settled up!
            </h2>
            <p className="text-on-surface-variant leading-relaxed max-w-xs mx-auto">
              {groupTransactions.length === 0
                ? 'No match results have been entered yet.'
                : 'Everyone in the league is even. No payments needed.'
              }
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {debts.map((debt, i) => {
              const fromName = nameMap[debt.from] || 'Unknown';
              const toName = nameMap[debt.to] || 'Unknown';
              const fromColors = getAvatarColor(fromName);
              const toColors = getAvatarColor(toName);

              return (
                <Card key={i}>
                  <div className="flex items-center gap-3">
                    {/* From */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-full ${fromColors.bg} ${fromColors.text} flex items-center justify-center text-sm font-bold shrink-0`}
                      >
                        {getInitial(fromName)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-on-surface text-sm truncate">{fromName}</p>
                        <p className="text-xs text-owe">pays</p>
                      </div>
                    </div>

                    {/* Arrow + Amount */}
                    <div className="flex flex-col items-center shrink-0 px-2">
                      <p className="font-headline font-bold text-on-surface">
                        {formatAmount(debt.amount)}
                      </p>
                      <ArrowRight size={16} className="text-on-surface-variant/40 mt-0.5" />
                    </div>

                    {/* To */}
                    <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                      <div className="min-w-0 text-right">
                        <p className="font-semibold text-on-surface text-sm truncate">{toName}</p>
                        <p className="text-xs text-owed">receives</p>
                      </div>
                      <div
                        className={`w-10 h-10 rounded-full ${toColors.bg} ${toColors.text} flex items-center justify-center text-sm font-bold shrink-0`}
                      >
                        {getInitial(toName)}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}

            <p className="text-center text-xs text-on-surface-variant/60 mt-4">
              {debts.length} {debts.length === 1 ? 'payment' : 'payments'} needed to settle all balances
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
