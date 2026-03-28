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

const ROLES: PlayerRole[] = ['WK', 'BAT', 'AR', 'BOWL'];
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

  const { iplSchedule, currentUser, saveFantasyTeam, getFantasyTeam } = useStore();
  const match = iplSchedule.find((m) => m.id === matchId);

  const existingTeam = getFantasyTeam(matchId);

  // State
  const [step, setStep] = useState<Step>(existingTeam ? 'preview' : 'select');
  const [isEditing, setIsEditing] = useState(false);
  const [activeRole, setActiveRole] = useState<PlayerRole>('WK');
  const [selected, setSelected] = useState<Set<string>>(() => {
    if (existingTeam) return new Set(existingTeam.players.map((p) => p.playerId));
    return new Set();
  });
  const [captainId, setCaptainId] = useState<string>(existingTeam?.captainId ?? '');
  const [viceCaptainId, setViceCaptainId] = useState<string>(existingTeam?.viceCaptainId ?? '');

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
      .filter((p) => p.role === activeRole)
      .sort((a, b) => b.credits - a.credits),
    [allPlayers, activeRole]
  );

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

  function handleCaptainTap(playerId: string) {
    if (captainId === playerId) {
      setCaptainId('');
    } else if (viceCaptainId === playerId) {
      setViceCaptainId('');
    } else if (!captainId) {
      setCaptainId(playerId);
    } else if (!viceCaptainId) {
      if (playerId !== captainId) setViceCaptainId(playerId);
    }
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
    if (step === 'preview' && !isEditing) {
      // Viewing existing team (not editing) — back goes to match detail
      navigate(`/group/${groupId}/match/${matchId}`);
    } else if (step === 'preview') {
      setStep('captain');
    } else if (step === 'captain') {
      setStep('select');
    } else if (step === 'select' && existingTeam && isEditing) {
      // Was editing, go back to preview
      setStep('preview');
      setIsEditing(false);
    } else {
      navigate(-1);
    }
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-on-surface-variant">Match not found</p>
      </div>
    );
  }

  const home = getTeamByName(match.teamHome);
  const away = getTeamByName(match.teamAway);

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
            {ROLES.map((role) => (
              <button
                key={role}
                onClick={() => setActiveRole(role)}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all shrink-0 ${
                  activeRole === role
                    ? 'sunset-gradient shadow-lg shadow-primary/20'
                    : 'bg-white card-shadow text-on-surface'
                }`}
              >
                {ROLE_LABELS[role]} ({roleCounts[role]})
              </button>
            ))}
          </div>

          {/* Player list */}
          <div className="flex-1 overflow-y-auto px-4 pb-28">
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
          <div className="px-4 pt-2 pb-1">
            <p className="text-sm text-on-surface-variant">
              Tap to select <span className="font-bold text-primary">Captain (2x)</span> and{' '}
              <span className="font-bold text-on-surface-variant">Vice Captain (1.5x)</span>
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-28">
            {selectedPlayers.map((player) => {
              const isCaptain = captainId === player.id;
              const isVC = viceCaptainId === player.id;
              const team = getTeamByName(player.team);

              return (
                <button
                  key={player.id}
                  onClick={() => handleCaptainTap(player.id)}
                  className={`w-full flex items-center gap-3 py-3.5 px-3 rounded-2xl mb-1 min-h-[52px] transition-all active:scale-[0.98] ${
                    isCaptain
                      ? 'bg-primary-container/40'
                      : isVC
                        ? 'bg-surface-dim/60'
                        : 'bg-white'
                  }`}
                >
                  {/* Badge */}
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      isCaptain
                        ? 'sunset-gradient shadow-md'
                        : isVC
                          ? 'bg-on-surface-variant text-white'
                          : 'bg-surface-dim text-on-surface-variant'
                    }`}
                  >
                    {isCaptain ? 'C' : isVC ? 'VC' : ROLE_LABELS[player.role]}
                  </div>

                  {/* Name + team */}
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
                      <span className="text-[10px] text-on-surface-variant">{player.credits} cr</span>
                    </div>
                  </div>

                  {/* Multiplier */}
                  {isCaptain && (
                    <span className="text-xs font-bold text-primary px-2 py-1 rounded-full bg-primary-container">
                      2x
                    </span>
                  )}
                  {isVC && (
                    <span className="text-xs font-bold text-on-surface-variant px-2 py-1 rounded-full bg-surface-dim">
                      1.5x
                    </span>
                  )}
                </button>
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
                  onClick={() => { setIsEditing(true); setStep('select'); }}
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
