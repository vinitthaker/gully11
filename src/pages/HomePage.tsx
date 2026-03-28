import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trophy, Users, Link2 } from 'lucide-react';
import { useStore } from '../store';
import { Header } from '../components/Header';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { usePageTitle } from '../hooks/usePageTitle';
import { getAvatarColor, getInitial } from '../utils/avatarColor';
import { LoginGate } from '../components/LoginGate';
import { useAuth } from '../hooks/useAuth';

export function HomePage() {
  usePageTitle('Gully11 — Fantasy IPL League');
  const navigate = useNavigate();
  const { groups, addGroup, isAuthenticated } = useStore();
  const { signInWithGoogle } = useAuth();
  const [showForm, setShowForm] = useState<'create' | 'join' | null>(null);
  const [groupName, setGroupName] = useState('');
  const [entryAmount, setEntryAmount] = useState('100');
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [showLoginGate, setShowLoginGate] = useState(false);
  const groupNameRef = useRef<HTMLInputElement>(null);

  const hasGroups = groups.length > 0;

  useEffect(() => {
    if (showForm === 'create' && groupNameRef.current) {
      setTimeout(() => groupNameRef.current?.focus(), 100);
    }
  }, [showForm]);

  function handleCreateClick() {
    if (!isAuthenticated) {
      setShowLoginGate(true);
      return;
    }
    setShowForm('create');
  }

  async function handleCreateGroup() {
    if (!groupName.trim() || creating) return;
    setCreating(true);
    try {
      const amount = parseInt(entryAmount) || 100;
      const group = await addGroup(groupName.trim(), '🏏', amount);
      setGroupName('');
      setEntryAmount('100');
      setShowForm(null);
      navigate(`/group/${group.id}`);
    } catch (e) {
      console.error('Failed to create group:', e);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      <Header variant="app" />

      <main className="px-6 pb-8 max-w-2xl mx-auto">
        {/* Empty state */}
        {!hasGroups && !showForm && (
          <div className="text-center py-16">
            <div className="w-24 h-24 rounded-[1.5rem] bg-primary-container/40 mx-auto mb-6 flex items-center justify-center">
              <Trophy className="text-primary" size={40} strokeWidth={1.5} />
            </div>

            <h2 className="font-headline font-bold text-2xl text-on-surface mb-2">
              Fantasy IPL with friends
            </h2>
            <p className="text-on-surface-variant leading-relaxed max-w-xs mx-auto mb-8">
              Create a league, track match rankings, and see who wins the bragging rights this IPL season
            </p>

            <div className="max-w-xs mx-auto space-y-3">
              <Button onClick={handleCreateClick} fullWidth icon={<Users size={18} />}>
                Create League
              </Button>
              <Button variant="ghost" onClick={() => setShowForm('join')} fullWidth icon={<Link2 size={18} />}>
                Join a League
              </Button>
            </div>
          </div>
        )}

        {/* Groups list */}
        {hasGroups && (
          <>
            <div className="flex justify-between items-center mb-4 mt-2">
              <h3 className="text-xl font-headline font-bold text-on-surface">Your Leagues</h3>
            </div>

            <div className="space-y-4">
              {groups.map((group) => {
                const displayMembers = group.members.slice(0, 3);
                const extraCount = group.members.length - 3;

                return (
                  <div
                    key={group.id}
                    onClick={() => navigate(`/group/${group.id}`)}
                    className="bg-white rounded-2xl card-shadow p-5 cursor-pointer active:scale-[0.98] transition-transform"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary-container/40 flex items-center justify-center text-2xl shrink-0">
                        {group.emoji || '🏏'}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="font-headline font-bold text-on-surface truncate">
                          {group.name}
                        </h4>
                        <p className="text-sm text-on-surface-variant">
                          {group.members.length} {group.members.length === 1 ? 'member' : 'members'} · ₹{group.entryAmount}/match
                        </p>
                      </div>

                      <div className="flex items-center -space-x-2 shrink-0">
                        {displayMembers.map((member) => {
                          const colors = getAvatarColor(member.name);
                          return (
                            <div
                              key={member.id}
                              className={`w-8 h-8 rounded-full ${colors.bg} ${colors.text} flex items-center justify-center text-xs font-bold border-2 border-white`}
                            >
                              {getInitial(member.name)}
                            </div>
                          );
                        })}
                        {extraCount > 0 && (
                          <div className="w-8 h-8 rounded-full bg-surface-dim flex items-center justify-center text-xs font-bold text-on-surface-variant border-2 border-white">
                            +{extraCount}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>

      {/* Bottom sheet: Create Group */}
      {showForm === 'create' && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 animate-fade-in"
            onClick={() => { setShowForm(null); setGroupName(''); setEntryAmount('100'); }}
          />

          <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
            <div className="max-w-2xl mx-auto bg-white rounded-t-3xl shadow-2xl px-6 pt-4 pb-8 max-h-[85vh] overflow-y-auto">
              <div className="w-10 h-1 rounded-full bg-surface-dim mx-auto mb-5" />

              <h3 className="font-headline font-bold text-lg text-on-surface mb-5">New League</h3>

              <div className="space-y-4">
                <Input
                  ref={groupNameRef}
                  label="LEAGUE NAME"
                  placeholder="e.g. Office IPL League"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />

                <Input
                  label="ENTRY PER MATCH (₹)"
                  type="number"
                  placeholder="100"
                  value={entryAmount}
                  onChange={(e) => setEntryAmount(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateGroup(); }}
                />

                {/* Rules summary */}
                <div className="bg-primary-container/30 rounded-2xl p-4">
                  <p className="text-label text-on-primary-container mb-2">HOW IT WORKS</p>
                  <ul className="space-y-1.5 text-xs text-on-surface-variant leading-relaxed">
                    <li className="flex gap-2"><span className="shrink-0">1.</span>Every member pays ₹{entryAmount || '100'} per match — whether you play or not</li>
                    <li className="flex gap-2"><span className="shrink-0">2.</span>Play on Dream11 and the admin enters rankings after each match</li>
                    <li className="flex gap-2"><span className="shrink-0">3.</span>Top rankers win from the pool, bottom rankers lose their entry</li>
                    <li className="flex gap-2"><span className="shrink-0">4.</span>Settle balances at any time via the Settlements page</li>
                  </ul>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="secondary"
                    onClick={() => { setShowForm(null); setGroupName(''); setEntryAmount('100'); }}
                    fullWidth
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateGroup}
                    disabled={!groupName.trim() || creating}
                    fullWidth
                  >
                    {creating ? 'Creating...' : 'Create League'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Bottom sheet: Join Group */}
      {showForm === 'join' && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 animate-fade-in"
            onClick={() => { setShowForm(null); setJoinCode(''); }}
          />

          <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
            <div className="max-w-2xl mx-auto bg-white rounded-t-3xl shadow-2xl px-6 pt-4 pb-8">
              <div className="w-10 h-1 rounded-full bg-surface-dim mx-auto mb-5" />

              <h3 className="font-headline font-bold text-lg text-on-surface mb-5">Join a League</h3>

              <div className="space-y-4">
                <Input
                  label="INVITE CODE"
                  placeholder="e.g. abc12345"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-3 pt-2">
                  <Button variant="secondary" onClick={() => { setShowForm(null); setJoinCode(''); }} fullWidth>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      const code = joinCode.trim();
                      if (!code) return;
                      const match = code.match(/\/g\/([a-zA-Z0-9-]+)/);
                      const inviteCode = match ? match[1] : code;
                      setJoinCode('');
                      setShowForm(null);
                      navigate(`/g/${inviteCode}`);
                    }}
                    disabled={!joinCode.trim()}
                    fullWidth
                  >
                    Join League
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* FAB */}
      {!showForm && hasGroups && (
        <button
          onClick={handleCreateClick}
          className="fixed bottom-24 right-6 max-w-2xl w-14 h-14 rounded-2xl sunset-gradient shadow-lg shadow-primary/30 flex items-center justify-center active:scale-95 transition-transform z-10"
        >
          <Plus className="text-white" size={24} />
        </button>
      )}

      {/* Login gate */}
      {showLoginGate && (
        <LoginGate
          onLogin={signInWithGoogle}
          onClose={() => setShowLoginGate(false)}
        />
      )}
    </div>
  );
}
