import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Trash2, Share2, Check, Pencil, UserCheck, Clock } from 'lucide-react';
import { useStore } from '../store';
import { Header } from '../components/Header';
import { Button } from '../components/Button';
import { LoginGate } from '../components/LoginGate';
import { useAuth } from '../hooks/useAuth';
import { usePageTitle } from '../hooks/usePageTitle';
import { getAvatarColor, getInitial } from '../utils/avatarColor';
import { formatAmount } from '../utils/currency';

export function GroupSettingsPage() {
  usePageTitle('Group Settings | Gully11');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser, groups, deleteGroup, updateGroupName, isAuthenticated } = useStore();
  const { signInWithGoogle } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  const group = groups.find((g) => g.id === id);

  if (!group) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-on-surface-variant">League not found</p>
      </div>
    );
  }

  const isAdmin = group.members.find((m) => m.id === currentUser.id)?.isAdmin;

  function handleShare() {
    if (!group) return;
    if (!isAuthenticated) {
      setShowLogin(true);
      return;
    }

    if (!group.inviteCode) {
      alert('No invite code found. Try creating the league again.');
      return;
    }

    const inviteUrl = `${window.location.origin}/g/${group.inviteCode}`;

    if (navigator.share) {
      navigator.share({
        title: `Join ${group.name} on Gully11`,
        text: `Join "${group.name}" on Gully11 to play fantasy IPL together.`,
        url: inviteUrl,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  }

  async function handleDelete() {
    await deleteGroup(group!.id);
    navigate('/', { replace: true });
  }

  return (
    <div className="min-h-screen bg-surface">
      <Header variant="page" title="League Settings" showBack />

      <main className="px-6 pb-32 max-w-2xl mx-auto">
        {/* Group name */}
        <p className="text-label text-on-surface-variant mt-6 mb-3">LEAGUE NAME</p>
        <div className="bg-white rounded-2xl card-shadow p-4 flex items-center gap-3">
          {editingName ? (
            <>
              <input
                ref={nameInputRef}
                type="text"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && nameValue.trim()) {
                    updateGroupName(group!.id, nameValue.trim());
                    setEditingName(false);
                  }
                  if (e.key === 'Escape') setEditingName(false);
                }}
                className="flex-1 font-semibold text-on-surface bg-transparent border-b-2 border-primary outline-none py-1"
                autoFocus
              />
              <button
                onClick={() => {
                  if (nameValue.trim()) {
                    updateGroupName(group!.id, nameValue.trim());
                    setEditingName(false);
                  }
                }}
                className="text-primary font-semibold text-sm"
              >
                Save
              </button>
            </>
          ) : (
            <>
              <p className="flex-1 font-semibold text-on-surface">{group.name}</p>
              {isAdmin && (
                <button
                  onClick={() => { setNameValue(group!.name); setEditingName(true); }}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-dim transition-colors"
                >
                  <Pencil size={16} className="text-on-surface-variant" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Entry amount */}
        <p className="text-label text-on-surface-variant mt-6 mb-3">ENTRY AMOUNT</p>
        <div className="bg-white rounded-2xl card-shadow p-4">
          <p className="font-headline font-bold text-on-surface text-lg">
            {formatAmount(group.entryAmount)} <span className="text-sm font-normal text-on-surface-variant">per match</span>
          </p>
        </div>

        {/* Invite link */}
        <div className="mt-6">
          <Button
            onClick={handleShare}
            fullWidth
            variant="secondary"
            icon={copied ? <Check size={20} className="text-primary" /> : <Share2 size={20} />}
          >
            {copied ? 'Link Copied!' : 'Share Invite Link'}
          </Button>
        </div>

        {/* Members */}
        <p className="text-label text-on-surface-variant mt-8 mb-3">
          MEMBERS ({group.members.length})
        </p>
        <div className="bg-white rounded-2xl card-shadow overflow-hidden">
          {group.members.map((member, i) => {
            const isMe = member.id === currentUser.id;
            const colors = getAvatarColor(member.name);

            return (
              <div
                key={member.id}
                className={`p-4 flex items-center gap-3 ${
                  i < group.members.length - 1 ? 'border-b border-surface-dim' : ''
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-full ${colors.bg} ${colors.text} flex items-center justify-center text-sm font-bold shrink-0`}
                >
                  {getInitial(member.name)}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-on-surface">
                    {isMe ? 'You' : member.name}
                  </p>
                  <p className="text-xs text-on-surface-variant flex items-center gap-1">
                    {member.isRegistered ? (
                      <>
                        <UserCheck size={12} /> Joined
                      </>
                    ) : (
                      <>
                        <Clock size={12} /> Pending
                      </>
                    )}
                    {member.isAdmin && (
                      <span className="ml-1 text-primary font-semibold">Admin</span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Delete group */}
        {isAdmin && (
          <div className="mt-12">
            <p className="text-label text-on-surface-variant mb-3">DANGER ZONE</p>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex items-center gap-3 p-4 bg-white rounded-2xl card-shadow text-owe font-semibold hover:bg-red-50 transition-colors"
              >
                <Trash2 size={20} />
                Delete League
              </button>
            ) : (
              <div className="bg-white rounded-2xl card-shadow p-5">
                <p className="font-semibold text-on-surface mb-1">Delete "{group.name}"?</p>
                <p className="text-sm text-on-surface-variant mb-4">
                  This will permanently remove the league, all match results, and transaction history. This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <Button
                    onClick={() => setShowDeleteConfirm(false)}
                    variant="secondary"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <button
                    onClick={handleDelete}
                    className="flex-1 bg-red-500 text-white font-semibold py-3 rounded-2xl hover:bg-red-600 transition-colors active:scale-[0.98]"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {showLogin && (
        <LoginGate
          onLogin={signInWithGoogle}
          onClose={() => setShowLogin(false)}
        />
      )}
    </div>
  );
}
