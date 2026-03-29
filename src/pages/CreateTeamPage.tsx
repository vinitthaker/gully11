import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, ChevronLeft } from 'lucide-react';
import { useStore } from '../store';
import { usePageTitle } from '../hooks/usePageTitle';
import { getMatchPlayers, type Player, type PlayerRole } from '../utils/players';
import { getTeamByName } from '../utils/ipl';
import { generateId } from '../utils/id';
import type { FantasyTeam, FantasyPick } from '../types';

type Step = 'select' | 'captain' | 'preview';
type TabRole = 'ALL' | PlayerRole;

const ROLES: PlayerRole[] = ['WK', 'BAT', 'AR', 'BOWL'];
const TABS: TabRole[] = ['ALL', 'WK', 'BAT', 'AR', 'BOWL'];
const TAB_LABELS: Record<TabRole, string> = { ALL: 'All', WK: 'WK', BAT: 'BAT', AR: 'AR', BOWL: 'BOWL' };
const ROLE_LABELS: Record<PlayerRole, string> = { WK: 'WK', BAT: 'BAT', AR: 'AR', BOWL: 'BOWL' };
const ROLE_CONSTRAINTS: Record<PlayerRole, { min: number; max: number }> = {
  WK: { min: 1, max: 8 },
  BAT: { min: 1, max: 8 },
  AR: { min: 1, max: 8 },
  BOWL: { min: 1, max: 8 },
};
const TOTAL_PLAYERS = 11;
const TOTAL_BUDGET = 100;

export function CreateTeamPage() {
  usePageTitle('Create Team | Gully11');
  const { id: groupId, matchId: matchIdStr } = useParams<{ id: string; matchId: string }>();
  const matchId = Number(matchIdStr);
  const navigate = useNavigate();
  // URL params like ?edit=true handled implicitly

  const { iplSchedule, currentUser, saveFantasyTeam, getFantasyTeam } = useStore();
  const match = iplSchedule.find((m) => m.id === matchId);

  const existingTeam = getFantasyTeam(matchId);

  // Always start in select mode (preview is shown on match detail page)
  const [step, setStep] = useState<Step>('select');
  const [activeTab, setActiveTab] = useState<TabRole>('ALL');
  const [selected, setSelected] = useState<Set<string>>(() => {
    if (existingTeam) return new Set(existingTeam.players.map((p) => p.playerId));
    return new Set();
  });
  const [captainId, setCaptainId] = useState<string>(existingTeam?.captainId ?? '');
  const [viceCaptainId, setViceCaptainId] = useState<string>(existingTeam?.viceCaptainId ?? '');

  const home = match ? getTeamByName(match.teamHome) : undefined;
  const away = match ? getTeamByName(match.teamAway) : undefined;

  // Players for this match
  const allPlayers = useMemo(() => {
    if (!match) return [];
    return getMatchPlayers(match.teamHome, match.teamAway);
  }, [match]);

  // Count per role
  const roleCounts = useMemo(() => {
    const counts: Record<PlayerRole, number> = { WK: 0, BAT: 0, AR: 0, BOWL: 0 };
    for (const pid of selected) {
      const player = allPlayers.find((p) => p.id === pid);
      if (player) counts[player.role]++;
    }
    return counts;
  }, [selected, allPlayers]);

  const totalSelected = selected.size;

  // Credits used
  const creditsUsed = useMemo(() => {
    let total = 0;
    for (const pid of selected) {
      const player = allPlayers.find((p) => p.id === pid);
      if (player) total += player.credits;
    }
    return Math.round(total * 10) / 10;
  }, [selected, allPlayers]);

  const creditsRemaining = Math.round((TOTAL_BUDGET - creditsUsed) * 10) / 10;
  const slotsRemaining = TOTAL_PLAYERS - totalSelected;

  // Check if selecting a player is allowed
  const canSelect = useCallback(
    (player: Player): boolean => {
      if (selected.has(player.id)) return true; // can always deselect
      if (totalSelected >= TOTAL_PLAYERS) return false;

      // Budget check
      if (creditsUsed + player.credits > TOTAL_BUDGET) return false;

      const role = player.role;
      const currentCount = roleCounts[role];

      // Would exceed max for this role
      if (currentCount >= ROLE_CONSTRAINTS[role].max) return false;

      // Check if selecting this player would make it impossible to fill remaining slots
      const remaining = TOTAL_PLAYERS - totalSelected - 1;
      let minNeeded = 0;
      for (const r of ROLES) {
        if (r === role) {
          const stillNeeded = Math.max(0, ROLE_CONSTRAINTS[r].min - (currentCount + 1));
          minNeeded += stillNeeded;
        } else {
          const stillNeeded = Math.max(0, ROLE_CONSTRAINTS[r].min - roleCounts[r]);
          minNeeded += stillNeeded;
        }
      }
      return minNeeded <= remaining;
    },
    [selected, totalSelected, roleCounts, creditsUsed]
  );

  // Players filtered by active role tab, sorted by credits desc
  const filteredPlayers = useMemo(
    () => allPlayers
      .filter((p) => activeTab === 'ALL' || p.role === activeTab)
      .sort((a, b) => b.credits - a.credits),
    [allPlayers, activeTab]
  );

  // Side-by-side players for "All" tab
  const sideBySidePlayers = useMemo(() => {
    if (activeTab !== 'ALL' || !match) return { home: [], away: [], pairs: [] };
    const homeCode = home?.code ?? '';
    const awayCode = away?.code ?? '';
    const homePlayers = allPlayers
      .filter((p) => p.team === homeCode)
      .sort((a, b) => b.credits - a.credits);
    const awayPlayers = allPlayers
      .filter((p) => p.team === awayCode)
      .sort((a, b) => b.credits - a.credits);
    // Pair them by index for side-by-side display
    const maxLen = Math.max(homePlayers.length, awayPlayers.length);
    const pairs: { home: Player | null; away: Player | null }[] = [];
    for (let i = 0; i < maxLen; i++) {
      pairs.push({
        home: homePlayers[i] ?? null,
        away: awayPlayers[i] ?? null,
      });
    }
    return { home: homePlayers, away: awayPlayers, pairs };
  }, [allPlayers, activeTab, match]);

  // Selected players list (for captain/preview steps)
  const selectedPlayers = useMemo(
    () => allPlayers.filter((p) => selected.has(p.id)),
    [allPlayers, selected]
  );

  function togglePlayer(player: Player) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(player.id)) {
        next.delete(player.id);
        if (captainId === player.id) setCaptainId('');
        if (viceCaptainId === player.id) setViceCaptainId('');
      } else if (canSelect(player)) {
        next.add(player.id);
      }
      return next;
    });
  }


  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!groupId || !captainId || !viceCaptainId || saving) return;
    setSaving(true);
    const picks: FantasyPick[] = selectedPlayers.map((p) => ({
      playerId: p.id,
      role: p.role,
    }));
    const team: FantasyTeam = {
      id: existingTeam?.id ?? generateId(),
      groupId: groupId || undefined,
      matchId,
      userId: currentUser.id,
      players: picks,
      captainId,
      viceCaptainId,
      totalPoints: 0,
      createdAt: existingTeam?.createdAt ?? Date.now(),
    };
    try {
      await saveFantasyTeam(team);
      navigate(`/group/${groupId}/match/${matchId}`);
    } catch (e) {
      console.error('Failed to save team:', e);
      setSaving(false);
    }
  }

  function handleBack() {
    if (step === 'preview') {
      setStep('captain');
    } else if (step === 'captain') {
      setStep('select');
    } else {
      // Back from select → match detail
      navigate(`/group/${groupId}/match/${matchId}`);
    }
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-on-surface-variant">Match not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* ─── Sticky Header ─── */}
      <header className="sticky top-0 z-20 glass px-4 py-3 flex items-center gap-3">
        <button
          onClick={handleBack}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-dim transition-colors shrink-0"
        >
          {step === 'select' ? (
            <ArrowLeft className="text-on-surface" size={22} />
          ) : (
            <ChevronLeft className="text-on-surface" size={22} />
          )}
        </button>
        <h1 className="font-headline font-bold text-lg text-on-surface flex-1 truncate">
          {step === 'select' && 'Create Team'}
          {step === 'captain' && 'Select Captain & VC'}
          {step === 'preview' && 'Preview Team'}
        </h1>
        {step === 'select' && (
          <span className="shrink-0 text-sm font-semibold px-3 py-1.5 rounded-full bg-primary-container text-on-primary-container">
            {totalSelected}/{TOTAL_PLAYERS}
          </span>
        )}
      </header>

      {/* ─── STEP: Select Players ─── */}
      {step === 'select' && (
        <>
          {/* Credit + role constraint bar */}
          <div className="px-4 py-2 border-b border-surface-dim bg-white">
            {/* Credits bar */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-label text-on-surface-variant">CREDITS</span>
                <span className="font-headline font-bold text-on-surface text-sm">
                  {creditsUsed}/{TOTAL_BUDGET}
                </span>
              </div>
              <div className="text-xs text-on-surface-variant">
                {slotsRemaining > 0 ? (
                  <span>{creditsRemaining} left · {slotsRemaining} {slotsRemaining === 1 ? 'player' : 'players'} to go</span>
                ) : (
                  <span className="text-owed font-semibold">Team complete</span>
                )}
              </div>
            </div>

            {/* Credit progress bar */}
            <div className="h-1.5 bg-surface-dim rounded-full overflow-hidden mb-3">
              <div
                className={`h-full rounded-full transition-all ${
                  creditsUsed > 95 ? 'bg-owe' : creditsUsed > 85 ? 'bg-amber-500' : 'bg-primary'
                }`}
                style={{ width: `${Math.min(100, (creditsUsed / TOTAL_BUDGET) * 100)}%` }}
              />
            </div>

            {/* Role counts */}
            <div className="flex gap-2">
              {ROLES.map((role) => {
                const count = roleCounts[role];
                const { min, max } = ROLE_CONSTRAINTS[role];
                const isFull = count >= max;
                const isSatisfied = count >= min;
                return (
                  <div
                    key={role}
                    className={`flex-1 text-center py-1 rounded-lg text-xs font-semibold ${
                      isFull
                        ? 'bg-primary-container/60 text-on-primary-container'
                        : isSatisfied
                          ? 'bg-green-50 text-owed'
                          : 'bg-surface-dim/50 text-on-surface-variant'
                    }`}
                  >
                    {ROLE_LABELS[role]} ({count})
                    <div className="text-[10px] font-normal opacity-70">
                      {min}-{max}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Role tabs */}
          <div className="px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all shrink-0 ${
                  activeTab === tab
                    ? 'sunset-gradient shadow-lg shadow-primary/20'
                    : 'bg-white card-shadow text-on-surface'
                }`}
              >
                {tab === 'ALL' ? `All (${totalSelected})` : `${TAB_LABELS[tab]} (${roleCounts[tab]})`}
              </button>
            ))}
          </div>

          {/* Player list */}
          <div className="flex-1 overflow-y-auto pb-28">
            {activeTab === 'ALL' && sideBySidePlayers.pairs ? (
              <>
                {/* Side-by-side header */}
                <div className="sticky top-0 z-10 flex items-center px-3 py-2.5 bg-surface-dim/80 backdrop-blur-sm border-b border-surface-dim text-xs font-semibold">
                  <div className="flex-1 flex items-center gap-1.5">
                    <span
                      className="inline-block w-4 h-4 rounded"
                      style={{ backgroundColor: home?.color ?? '#666' }}
                    />
                    <span className="text-on-surface">{home?.code ?? match.teamHome}</span>
                  </div>
                  <div className="px-3 text-on-surface-variant text-[10px]">Credits</div>
                  <div className="flex-1 flex items-center gap-1.5 justify-end">
                    <span className="text-on-surface">{away?.code ?? match.teamAway}</span>
                    <span
                      className="inline-block w-4 h-4 rounded"
                      style={{ backgroundColor: away?.color ?? '#666' }}
                    />
                  </div>
                </div>
                {/* Side-by-side rows */}
                <div className="px-1">
                  {sideBySidePlayers.pairs.map((pair, i) => (
                    <div key={i} className="flex items-stretch border-b border-surface-dim/50">
                      {/* Home player (left) */}
                      {pair.home ? (
                        <PlayerSideCell
                          player={pair.home}
                          isSelected={selected.has(pair.home.id)}
                          disabled={!selected.has(pair.home.id) && !canSelect(pair.home)}
                          onToggle={togglePlayer}
                          side="left"
                        />
                      ) : (
                        <div className="flex-1" />
                      )}
                      {/* Away player (right) */}
                      {pair.away ? (
                        <PlayerSideCell
                          player={pair.away}
                          isSelected={selected.has(pair.away.id)}
                          disabled={!selected.has(pair.away.id) && !canSelect(pair.away)}
                          onToggle={togglePlayer}
                          side="right"
                        />
                      ) : (
                        <div className="flex-1" />
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="px-4">
                {filteredPlayers.map((player) => {
                  const isSelected = selected.has(player.id);
                  const disabled = !isSelected && !canSelect(player);
                  const team = getTeamByName(player.team);

                  return (
                    <button
                      key={player.id}
                      onClick={() => !disabled && togglePlayer(player)}
                      disabled={disabled}
                      className={`w-full flex items-center gap-3 py-3 px-3 rounded-2xl mb-1 min-h-[52px] transition-all active:scale-[0.98] ${
                        isSelected
                          ? 'bg-primary-container/30'
                          : disabled
                            ? 'opacity-40'
                            : 'bg-white'
                      }`}
                    >
                      {/* Player info */}
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-semibold text-on-surface text-sm truncate">
                          {player.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold"
                            style={{
                              backgroundColor: team?.color ?? '#666',
                              color: team?.textColor ?? '#fff',
                            }}
                          >
                            {player.team}
                          </span>
                        </div>
                      </div>

                      {/* Credits */}
                      <span className={`text-sm font-bold shrink-0 mr-2 ${
                        isSelected ? 'text-primary' : 'text-on-surface-variant'
                      }`}>
                        {player.credits}
                      </span>

                      {/* Select circle */}
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                          isSelected
                            ? 'bg-primary text-white'
                            : 'border-2 border-surface-dim'
                        }`}
                      >
                        {isSelected && <Check size={16} strokeWidth={3} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sticky bottom bar */}
          <div className="fixed bottom-0 left-0 right-0 z-10 px-4 py-4 glass border-t border-surface-dim">
            <div className="max-w-2xl mx-auto">
              <button
                onClick={() => setStep('captain')}
                disabled={totalSelected !== TOTAL_PLAYERS}
                className="w-full sunset-gradient font-semibold shadow-lg shadow-primary/20 rounded-full px-6 py-3.5 text-base min-h-[52px] active:scale-[0.98] flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Next: Select Captain & VC
              </button>
            </div>
          </div>
        </>
      )}

      {/* ─── STEP: Captain & Vice Captain ─── */}
      {step === 'captain' && (
        <>
          {/* Info banner */}
          <div className="mx-4 mt-2 mb-3 rounded-2xl bg-primary-container/40 p-4">
            <p className="text-center text-sm font-medium text-on-surface mb-3">Select Captain and Vice Captain</p>
            <div className="flex items-center justify-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full sunset-gradient flex items-center justify-center text-xs font-bold text-white">C</div>
                <div>
                  <p className="text-[10px] text-on-surface-variant">Captain gets</p>
                  <p className="text-xs font-bold text-on-surface">2x points</p>
                </div>
              </div>
              <div className="w-px h-8 bg-surface-dim" />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-on-surface-variant flex items-center justify-center text-xs font-bold text-white">VC</div>
                <div>
                  <p className="text-[10px] text-on-surface-variant">Vice Captain gets</p>
                  <p className="text-xs font-bold text-on-surface">1.5x points</p>
                </div>
              </div>
            </div>
          </div>

          {/* Column headers */}
          <div className="flex items-center px-4 py-2 border-b border-surface-dim text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">
            <span className="w-10 text-center">Type</span>
            <span className="flex-1 ml-2">Player</span>
            <span className="w-12 text-center">C</span>
            <span className="w-12 text-center">VC</span>
          </div>

          <div className="flex-1 overflow-y-auto pb-28">
            {selectedPlayers.map((player) => {
              const isCaptain = captainId === player.id;
              const isVC = viceCaptainId === player.id;
              const team = getTeamByName(player.team);

              return (
                <div
                  key={player.id}
                  className={`flex items-center px-4 py-3 border-b border-surface-dim/50 ${
                    isCaptain || isVC ? 'bg-primary-container/20' : ''
                  }`}
                >
                  {/* Role badge */}
                  <div className="w-10 flex flex-col items-center gap-0.5 shrink-0">
                    <span
                      className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold"
                      style={{
                        backgroundColor: team?.color ?? '#666',
                        color: team?.textColor ?? '#fff',
                      }}
                    >
                      {player.team}
                    </span>
                    <span className="text-[9px] text-on-surface-variant font-medium">{ROLE_LABELS[player.role]}</span>
                  </div>

                  {/* Name + credits */}
                  <div className="flex-1 ml-2 min-w-0">
                    <p className="font-semibold text-on-surface text-sm truncate">{player.name}</p>
                    <p className="text-[10px] text-on-surface-variant">{player.credits} cr</p>
                  </div>

                  {/* Captain button */}
                  <button
                    onClick={() => {
                      if (isCaptain) {
                        setCaptainId('');
                      } else {
                        if (viceCaptainId === player.id) setViceCaptainId('');
                        setCaptainId(player.id);
                      }
                    }}
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold mx-1 transition-all active:scale-90 ${
                      isCaptain
                        ? 'sunset-gradient shadow-md'
                        : 'border-2 border-surface-dim text-on-surface-variant'
                    }`}
                  >
                    C
                  </button>

                  {/* Vice Captain button */}
                  <button
                    onClick={() => {
                      if (isVC) {
                        setViceCaptainId('');
                      } else {
                        if (captainId === player.id) setCaptainId('');
                        setViceCaptainId(player.id);
                      }
                    }}
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold mx-1 transition-all active:scale-90 ${
                      isVC
                        ? 'bg-gray-700 text-white shadow-md'
                        : 'border-2 border-surface-dim text-on-surface-variant'
                    }`}
                  >
                    VC
                  </button>
                </div>
              );
            })}
          </div>

          {/* Bottom bar */}
          <div className="fixed bottom-0 left-0 right-0 z-10 px-4 py-4 glass border-t border-surface-dim">
            <div className="max-w-2xl mx-auto">
              <button
                onClick={() => setStep('preview')}
                disabled={!captainId || !viceCaptainId}
                className="w-full sunset-gradient font-semibold shadow-lg shadow-primary/20 rounded-full px-6 py-3.5 text-base min-h-[52px] active:scale-[0.98] flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Preview Team
              </button>
            </div>
          </div>
        </>
      )}

      {/* ─── STEP: Preview (Dream11-style full-screen) ─── */}
      {step === 'preview' && (() => {
        const homeCount = selectedPlayers.filter((p) => p.team === (home?.code ?? '')).length;
        const awayCount = selectedPlayers.filter((p) => p.team === (away?.code ?? '')).length;

        return (
          <>
            {/* Stats header */}
            <div className="flex items-center justify-between px-5 py-2 bg-white border-b border-surface-dim">
              <div className="text-center">
                <p className="text-[10px] text-on-surface-variant">Players</p>
                <p className="font-headline font-bold text-on-surface text-sm">{totalSelected}/11</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold"
                  style={{ backgroundColor: home?.color ?? '#666', color: home?.textColor ?? '#fff' }}
                >
                  {home?.code}
                </span>
                <span className="font-headline font-bold text-on-surface text-sm">{homeCount} : {awayCount}</span>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold"
                  style={{ backgroundColor: away?.color ?? '#666', color: away?.textColor ?? '#fff' }}
                >
                  {away?.code}
                </span>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-on-surface-variant">Credits Left</p>
                <p className={`font-headline font-bold text-sm ${creditsRemaining < 5 ? 'text-owe' : 'text-on-surface'}`}>
                  {creditsRemaining}
                </p>
              </div>
            </div>

            {/* Full-screen green field */}
            <div className="flex-1 overflow-y-auto bg-gradient-to-b from-green-700 via-green-600 to-green-700 pb-28 relative">
              {/* Subtle pitch markings */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[14%] h-[18%] bg-amber-200/20 rounded-sm" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] h-[30%] rounded-[50%] border border-white/10" />

              {/* Role sections — WK top, BOWL bottom (like Dream11) */}
              <FieldRow label="WICKET-KEEPERS" players={selectedPlayers.filter((p) => p.role === 'WK')} captainId={captainId} viceCaptainId={viceCaptainId} homeColor={home?.color} awayColor={away?.color} homeCode={home?.code} awayCode={away?.code} />
              <FieldRow label="BATTERS" players={selectedPlayers.filter((p) => p.role === 'BAT')} captainId={captainId} viceCaptainId={viceCaptainId} homeColor={home?.color} awayColor={away?.color} homeCode={home?.code} awayCode={away?.code} />
              <FieldRow label="ALL-ROUNDERS" players={selectedPlayers.filter((p) => p.role === 'AR')} captainId={captainId} viceCaptainId={viceCaptainId} homeColor={home?.color} awayColor={away?.color} homeCode={home?.code} awayCode={away?.code} />
              <FieldRow label="BOWLERS" players={selectedPlayers.filter((p) => p.role === 'BOWL')} captainId={captainId} viceCaptainId={viceCaptainId} homeColor={home?.color} awayColor={away?.color} homeCode={home?.code} awayCode={away?.code} />
            </div>

            {/* Bottom bar */}
            <div className="fixed bottom-0 left-0 right-0 z-10 px-4 py-4 bg-green-800/95 backdrop-blur-md border-t border-white/10">
              <div className="max-w-2xl mx-auto flex gap-3">
                <button
                  onClick={() => { setStep('select'); }}
                  className="flex-1 bg-white/20 text-white font-semibold rounded-full px-6 py-3.5 text-base min-h-[52px] active:scale-[0.98] transition-all"
                >
                  Edit
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 sunset-gradient font-semibold shadow-lg shadow-primary/20 rounded-full px-6 py-3.5 text-base min-h-[52px] active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save Team'}
                </button>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}

/* ─── Field row sub-component (Dream11-style) ─── */
function FieldRow({
  label,
  players,
  captainId,
  viceCaptainId,
  homeColor,
  awayColor,
  homeCode,
  awayCode,
}: {
  label: string;
  players: Player[];
  captainId: string;
  viceCaptainId: string;
  homeColor?: string;
  awayColor?: string;
  homeCode?: string;
  awayCode?: string;
}) {
  if (players.length === 0) return null;

  return (
    <div className="py-5 px-3 relative">
      {/* Role label */}
      <p className="text-[10px] font-bold text-white/30 tracking-[0.2em] text-center mb-4 uppercase">
        {label}
      </p>

      {/* Players */}
      <div className="flex items-start justify-center gap-2 flex-wrap">
        {players.map((player) => {
          const isCaptain = captainId === player.id;
          const isVC = viceCaptainId === player.id;
          const initial = player.name.charAt(0).toUpperCase();
          const isHome = player.team === homeCode;
          const isAway = player.team === awayCode;
          const pillBg = isHome ? (homeColor ?? '#444') : isAway ? (awayColor ?? '#666') : '#444';
          const firstName = player.name.split(' ')[0]?.charAt(0) ?? '';
          const lastName = player.name.split(' ').slice(-1)[0] ?? player.name;
          const shortName = `${firstName} ${lastName}`;

          return (
            <div key={player.id} className="flex flex-col items-center w-[76px]">
              {/* Avatar */}
              <div className="relative mb-1.5">
                <div className="w-11 h-11 rounded-full bg-white text-on-surface flex items-center justify-center text-base font-bold shadow-lg border-2 border-white/80">
                  {initial}
                </div>
                {(isCaptain || isVC) && (
                  <span
                    className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center shadow-md border border-white/50 ${
                      isCaptain
                        ? 'bg-primary text-white'
                        : 'bg-on-surface-variant text-white'
                    }`}
                  >
                    {isCaptain ? 'C' : 'VC'}
                  </span>
                )}
              </div>

              {/* Name pill in team color */}
              <div
                className="rounded px-2 py-[3px] text-center max-w-full"
                style={{ backgroundColor: pillBg }}
              >
                <p className="text-[10px] font-semibold text-white truncate leading-tight">
                  {shortName}
                </p>
              </div>

              {/* Credits */}
              <p className="text-[10px] text-white/50 mt-1 font-medium">{player.credits} Cr</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlayerSideCell({
  player,
  isSelected,
  disabled,
  onToggle,
  side,
}: {
  player: Player;
  isSelected: boolean;
  disabled: boolean;
  onToggle: (p: Player) => void;
  side: 'left' | 'right';
}) {
  return (
    <button
      onClick={() => !disabled && onToggle(player)}
      disabled={disabled}
      className={`flex-1 flex items-center gap-1.5 py-2.5 px-2 transition-all active:scale-[0.98] ${
        side === 'left' ? 'border-r border-surface-dim/30' : ''
      } ${
        isSelected
          ? 'bg-primary-container/30'
          : disabled
            ? 'opacity-35'
            : ''
      }`}
    >
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all ${
          isSelected ? 'bg-primary text-white' : 'border-2 border-surface-dim'
        }`}
      >
        {isSelected && <Check size={12} strokeWidth={3} />}
      </div>
      <div className={`flex-1 min-w-0 ${side === 'left' ? 'text-left' : 'text-left'}`}>
        <p className="font-semibold text-on-surface text-xs truncate">{player.name}</p>
        <span className="text-[10px] text-on-surface-variant font-medium">{ROLE_LABELS[player.role]}</span>
      </div>
      <span className={`text-xs font-bold shrink-0 ${isSelected ? 'text-primary' : 'text-on-surface-variant'}`}>
        {player.credits}
      </span>
    </button>
  );
}
