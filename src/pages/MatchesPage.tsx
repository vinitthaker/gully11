import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Clock, Radio } from 'lucide-react';
import { useStore } from '../store';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { usePageTitle } from '../hooks/usePageTitle';
import { getTeamByName } from '../utils/ipl';

export function MatchesPage() {
  usePageTitle('Matches | Gully11');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { iplSchedule, matchResults } = useStore();

  const groupResults = matchResults.filter((r) => r.groupId === id);
  const completedMatchIds = new Set(groupResults.map((r) => r.matchId));

  const now = Date.now();
  const { upcoming, live, completed } = useMemo(() => {
    const up: typeof iplSchedule = [];
    const lv: typeof iplSchedule = [];
    const done: typeof iplSchedule = [];

    for (const match of iplSchedule) {
      if (completedMatchIds.has(match.id)) {
        done.push(match);
      } else if (now > match.matchDate && now < match.matchDate + 4 * 60 * 60 * 1000) {
        lv.push(match);
      } else {
        up.push(match);
      }
    }

    up.sort((a, b) => a.matchDate - b.matchDate);
    lv.sort((a, b) => a.matchDate - b.matchDate);
    done.sort((a, b) => b.matchDate - a.matchDate);

    return { upcoming: up, live: lv, completed: done };
  }, [iplSchedule, completedMatchIds, now]);

  function MatchCard({ match, isCompleted, isLive }: { match: typeof iplSchedule[0]; isCompleted: boolean; isLive?: boolean }) {
    const home = getTeamByName(match.teamHome);
    const away = getTeamByName(match.teamAway);
    const dateStr = new Date(match.matchDate).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    const timeStr = new Date(match.matchDate).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <Card
        onClick={() => navigate(`/group/${id}/match/${match.id}`)}
        className="!p-4"
      >
        <div className="flex items-center justify-between gap-3 mb-3">
          <span className="text-xs font-semibold text-on-surface-variant">
            Match #{match.id}
          </span>
          {isCompleted ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-owed bg-green-50 px-2 py-0.5 rounded-full">
              <CheckCircle size={12} />
              Results
            </span>
          ) : isLive ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
              <Radio size={12} className="animate-pulse" />
              LIVE
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-on-surface-variant bg-surface-dim px-2 py-0.5 rounded-full">
              <Clock size={12} />
              Upcoming
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Home */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
              style={{ backgroundColor: home?.color || '#666', color: home?.textColor || '#fff' }}
            >
              {home?.code || match.teamHome.slice(0, 3).toUpperCase()}
            </div>
            <span className="text-sm font-semibold text-on-surface truncate">
              {home?.shortName || match.teamHome}
            </span>
          </div>

          <span className="text-xs font-bold text-on-surface-variant shrink-0">vs</span>

          {/* Away */}
          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            <span className="text-sm font-semibold text-on-surface truncate text-right">
              {away?.shortName || match.teamAway}
            </span>
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
              style={{ backgroundColor: away?.color || '#666', color: away?.textColor || '#fff' }}
            >
              {away?.code || match.teamAway.slice(0, 3).toUpperCase()}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-on-surface-variant">{dateStr} &middot; {timeStr}</p>
          <p className="text-xs text-on-surface-variant truncate max-w-[50%] text-right">{match.venue}</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <Header variant="page" title="Matches" showBack />

      <main className="px-6 pb-8 max-w-2xl mx-auto">
        {/* Live */}
        {live.length > 0 && (
          <section className="mt-2 mb-6">
            <p className="text-label text-red-600 mb-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              LIVE ({live.length})
            </p>
            <div className="space-y-3">
              {live.map((match) => (
                <MatchCard key={match.id} match={match} isCompleted={false} isLive />
              ))}
            </div>
          </section>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <section className="mt-2 mb-6">
            <p className="text-label text-on-surface-variant mb-3">
              UPCOMING ({upcoming.length})
            </p>
            <div className="space-y-3">
              {upcoming.map((match) => (
                <MatchCard key={match.id} match={match} isCompleted={false} />
              ))}
            </div>
          </section>
        )}

        {/* Completed */}
        {completed.length > 0 && (
          <section className="mb-6">
            <p className="text-label text-on-surface-variant mb-3">
              COMPLETED ({completed.length})
            </p>
            <div className="space-y-3">
              {completed.map((match) => (
                <MatchCard key={match.id} match={match} isCompleted={true} />
              ))}
            </div>
          </section>
        )}

        {iplSchedule.length === 0 && (
          <div className="text-center py-16">
            <p className="text-on-surface-variant">No matches found. Schedule may still be loading.</p>
          </div>
        )}
      </main>
    </div>
  );
}
