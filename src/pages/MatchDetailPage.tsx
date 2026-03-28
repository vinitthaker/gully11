import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { useStore } from '../store';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { usePageTitle } from '../hooks/usePageTitle';
import { getTeamByName, calculatePayouts } from '../utils/ipl';
import { getAvatarColor, getInitial } from '../utils/avatarColor';
import { formatAmount } from '../utils/currency';

export function MatchDetailPage() {
  const { id: groupId, matchId: matchIdStr } = useParams<{ id: string; matchId: string }>();
  const matchId = Number(matchIdStr);
  const { groups, iplSchedule, matchResults, currentUser, submitResults } = useStore();

  const group = groups.find((g) => g.id === groupId);
  const match = iplSchedule.find((m) => m.id === matchId);
  usePageTitle(match ? `Match #${matchId} | Gully11` : 'Gully11');

  const [showEnterResults, setShowEnterResults] = useState(false);
  const [rankings, setRankings] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const existingResults = useMemo(() => {
    return matchResults.filter((r) => r.groupId === groupId && r.matchId === matchId);
  }, [matchResults, groupId, matchId]);

  const hasResults = existingResults.length > 0;
  const isAdmin = group?.members.find((m) => m.id === currentUser.id)?.isAdmin;

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
      // Remove any other member with this rank
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
              </div>
            </div>

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
                        {/* Rank */}
                        <div className="w-8 text-center shrink-0">
                          {result.rank === 1 ? (
                            <Trophy className="text-amber-500 mx-auto" size={18} />
                          ) : (
                            <span className="font-headline font-bold text-on-surface-variant text-sm">
                              #{result.rank}
                            </span>
                          )}
                        </div>

                        {/* Avatar + Name */}
                        <div
                          className={`w-9 h-9 rounded-full ${colors.bg} ${colors.text} flex items-center justify-center text-sm font-bold shrink-0`}
                        >
                          {getInitial(member.name)}
                        </div>
                        <p className="flex-1 font-medium text-on-surface text-sm truncate">
                          {isMe ? 'You' : member.name}
                        </p>

                        {/* Payout + Net */}
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

            {/* Summary */}
            <div className="flex items-center justify-center gap-4 text-sm text-on-surface-variant">
              <span>Pool: {formatAmount(pool)}</span>
              <span className="w-1 h-1 rounded-full bg-on-surface-variant/30" />
              <span>Entry: {formatAmount(entryAmount)}</span>
            </div>
          </>
        ) : (
          <>
            {isAdmin && (
              <Button
                onClick={() => setShowEnterResults(true)}
                fullWidth
                icon={<Trophy size={18} />}
              >
                Enter Results
              </Button>
            )}

            {!isAdmin && (
              <div className="text-center py-8">
                <p className="text-on-surface-variant">
                  Results have not been entered yet. Ask the league admin to submit results after the match.
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
              {/* Handle */}
              <div className="w-10 h-1 rounded-full bg-surface-dim mx-auto mb-5" />

              <h3 className="font-headline font-bold text-lg text-on-surface mb-2">
                Enter Rankings
              </h3>
              <p className="text-sm text-on-surface-variant mb-5">
                Assign rank to each member based on their fantasy performance.
              </p>

              {/* Member list with rank assignment */}
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

                      {/* Rank selector */}
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

                      {/* Net preview */}
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

              {/* Payout preview */}
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
