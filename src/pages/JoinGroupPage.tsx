import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle, Trophy } from 'lucide-react';
import { useStore } from '../store';
import { useAuth } from '../hooks/useAuth';
import { getAvatarColor, getInitial } from '../utils/avatarColor';
import * as db from '../lib/db';
import { usePageTitle } from '../hooks/usePageTitle';
import type { Group } from '../types';

type Status = 'loading' | 'preview' | 'signing-in' | 'joining' | 'joined' | 'error';

export function JoinGroupPage() {
  usePageTitle('Join League | Gully11');
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, authUser } = useStore();
  const { signInWithGoogle } = useAuth();
  const fetchFromSupabase = useStore((s) => s.fetchFromSupabase);

  const [status, setStatus] = useState<Status>('loading');
  const [group, setGroup] = useState<Group | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch group details
  useEffect(() => {
    if (!inviteCode) return;
    db.getGroupByInviteCode(inviteCode).then((data) => {
      if (!data) {
        setStatus('error');
        setErrorMsg('This invite link is invalid or expired.');
        return;
      }

      // If already a member, redirect straight to the group
      if (authUser && data.members.some((m) => m.id === authUser.id)) {
        navigate(`/group/${data.id}`, { replace: true });
        return;
      }

      setGroup(data);
      setStatus('preview');
    });
  }, [inviteCode, authUser, navigate]);

  // After OAuth redirect: check if we should auto-join
  useEffect(() => {
    if (!isAuthenticated || !authUser || !inviteCode) return;
    const pending = localStorage.getItem('gully11-pending-join');
    if (!pending) return;

    try {
      const { inviteCode: pendingCode } = JSON.parse(pending);
      localStorage.removeItem('gully11-pending-join');
      if (pendingCode === inviteCode) {
        handleJoin();
      }
    } catch {
      localStorage.removeItem('gully11-pending-join');
    }
  }, [isAuthenticated, authUser]);

  function handleJoinClick() {
    if (!isAuthenticated) {
      // Save join intent before OAuth redirect
      localStorage.setItem('gully11-pending-join', JSON.stringify({ inviteCode }));
      setStatus('signing-in');
      signInWithGoogle();
      return;
    }
    handleJoin();
  }

  async function handleJoin() {
    if (!authUser || !inviteCode || !group) return;
    setStatus('joining');
    try {
      const userName = authUser.user_metadata?.full_name || authUser.email || 'Player';
      await db.joinGroup(inviteCode, authUser.id, userName);
      await fetchFromSupabase();
      setStatus('joined');
      setTimeout(() => {
        navigate(`/group/${group.id}`, { replace: true });
      }, 1500);
    } catch (e) {
      setStatus('error');
      setErrorMsg('Failed to join league. You may already be a member.');
      console.error('Join error:', e);
    }
  }

  // Build context line from existing members
  const contextLine = (() => {
    if (!group || group.members.length === 0) return null;
    const names = group.members.slice(0, 2).map((m) => m.name);
    const rest = group.members.length - 2;
    if (rest > 0) return `with ${names.join(', ')} + ${rest} ${rest === 1 ? 'other' : 'others'}`;
    if (names.length === 2) return `with ${names.join(' & ')}`;
    return `with ${names[0]}`;
  })();

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="w-full max-w-sm">

        {/* Loading */}
        {status === 'loading' && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary-container mx-auto mb-5 flex items-center justify-center">
              <Loader2 className="animate-spin text-primary" size={28} />
            </div>
            <p className="text-on-surface-variant">Loading league...</p>
          </div>
        )}

        {/* Preview — show group info + join button */}
        {status === 'preview' && group && (
          <div>
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-primary-container mx-auto mb-4 flex items-center justify-center text-2xl">
                {group.emoji || <Trophy className="text-primary" size={28} strokeWidth={1.5} />}
              </div>
              <h1 className="font-headline font-bold text-2xl text-on-surface mb-1">
                Join {group.name}
              </h1>
              {contextLine && (
                <p className="text-sm text-on-surface-variant">{contextLine}</p>
              )}
              <p className="text-xs text-on-surface-variant/60 mt-2">
                ₹{group.entryAmount} per match · {group.members.length} {group.members.length === 1 ? 'member' : 'members'}
              </p>
            </div>

            {/* Current members */}
            {group.members.length > 0 && (
              <div className="bg-white rounded-2xl card-shadow p-4 mb-6">
                <p className="text-label text-on-surface-variant mb-3">MEMBERS</p>
                <div className="space-y-2">
                  {group.members.map((member) => {
                    const colors = getAvatarColor(member.name);
                    return (
                      <div key={member.id} className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full ${colors.bg} ${colors.text} flex items-center justify-center text-xs font-bold shrink-0`}>
                          {getInitial(member.name)}
                        </div>
                        <span className="text-sm text-on-surface font-medium">{member.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Join button */}
            {isAuthenticated ? (
              <button
                onClick={handleJoinClick}
                className="w-full sunset-gradient font-semibold shadow-lg shadow-primary/20 rounded-full px-6 py-3.5 text-base min-h-[52px] active:scale-[0.98] flex items-center justify-center gap-2"
              >
                Join {group.name}
              </button>
            ) : (
              <button
                onClick={handleJoinClick}
                className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-2xl border border-surface-dim bg-white font-medium text-on-surface card-shadow hover:bg-surface-dim/30 active:scale-[0.98] transition-all"
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Sign in with Google to join
              </button>
            )}

            <p className="text-center text-[11px] text-on-surface-variant/50 mt-3">
              Track fantasy IPL results with your league on Gully11
            </p>
          </div>
        )}

        {/* Signing in */}
        {status === 'signing-in' && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary-container mx-auto mb-5 flex items-center justify-center">
              <Loader2 className="animate-spin text-primary" size={28} />
            </div>
            <h2 className="font-headline font-bold text-lg text-on-surface mb-1">Signing you in</h2>
            <p className="text-sm text-on-surface-variant">You'll be redirected to Google...</p>
          </div>
        )}

        {/* Joining */}
        {status === 'joining' && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary-container mx-auto mb-5 flex items-center justify-center">
              <Loader2 className="animate-spin text-primary" size={28} />
            </div>
            <h2 className="font-headline font-bold text-lg text-on-surface mb-1">Joining league</h2>
            <p className="text-sm text-on-surface-variant">Setting things up...</p>
          </div>
        )}

        {/* Joined */}
        {status === 'joined' && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-green-50 mx-auto mb-5 flex items-center justify-center">
              <CheckCircle className="text-owed" size={32} />
            </div>
            <h1 className="font-headline font-bold text-2xl text-on-surface mb-1">
              You're in!
            </h1>
            <p className="text-sm text-on-surface-variant">
              Welcome to {group?.name}. Redirecting...
            </p>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-50 mx-auto mb-5 flex items-center justify-center">
              <XCircle className="text-owe" size={32} />
            </div>
            <h1 className="font-headline font-bold text-xl text-on-surface mb-1">
              Something went wrong
            </h1>
            <p className="text-sm text-on-surface-variant mb-6">{errorMsg}</p>
            <button
              onClick={() => navigate('/', { replace: true })}
              className="w-full sunset-gradient font-semibold shadow-lg shadow-primary/20 rounded-full px-6 py-3.5 text-base min-h-[52px] active:scale-[0.98] flex items-center justify-center"
            >
              Go to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
