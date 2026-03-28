import { useState } from 'react';
import { LogOut, Download, Share2, CheckCircle, Send } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useStore } from '../store';
import { useAuth } from '../hooks/useAuth';
import { IOSInstallGuide } from '../components/IOSInstallGuide';
import { Header } from '../components/Header';
import { Button } from '../components/Button';
import { LoginGate } from '../components/LoginGate';
import { getAvatarColor, getInitial } from '../utils/avatarColor';
import { usePageTitle } from '../hooks/usePageTitle';
import { shareApp } from '../utils/share';

export function SettingsPage() {
  usePageTitle('Settings | Gully11');
  const { currentUser, isAuthenticated } = useStore();
  const { signInWithGoogle, signOut } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const { canShow: canShowInstall, isIOS, install, isInstalled, showIOSGuide, closeIOSGuide } = usePWAInstall();
  const colors = getAvatarColor(currentUser.name);
  const [shareToast, setShareToast] = useState(false);

  return (
    <div className="min-h-screen bg-surface">
      <Header variant="page" title="Settings" showBack />

      <main className="px-6 pb-32 max-w-2xl mx-auto">
        {/* Profile card */}
        <div className="bg-white rounded-2xl card-shadow p-5 mt-4">
          <div className="flex items-center gap-4">
            {currentUser.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.name}
                className="w-14 h-14 rounded-full"
              />
            ) : (
              <div className={`w-14 h-14 rounded-full ${colors.bg} ${colors.text} flex items-center justify-center text-xl font-bold`}>
                {getInitial(currentUser.name || '?')}
              </div>
            )}
            <div>
              <p className="font-headline font-bold text-on-surface text-lg">
                {currentUser.name || 'Guest'}
              </p>
              <p className="text-sm text-on-surface-variant">
                {currentUser.email || 'Not signed in'}
              </p>
            </div>
          </div>
        </div>

        {/* Sign in with Google (when not authenticated) */}
        {!isAuthenticated && (
          <div className="mt-6">
            <Button
              onClick={() => setShowLogin(true)}
              fullWidth
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              }
            >
              Sign in with Google
            </Button>
            <p className="text-center text-on-surface-variant text-xs mt-2">
              Sign in to sync data across devices
            </p>
          </div>
        )}

        {/* App section */}
        <div className="mt-8">
          <p className="text-label text-on-surface-variant mb-3">APP</p>
          <div className="bg-white rounded-2xl card-shadow">
            {/* Install app */}
            {(canShowInstall || isInstalled) && (
              <button
                onClick={isInstalled ? undefined : install}
                className={`w-full px-5 py-4 flex items-center gap-3 ${isInstalled ? 'opacity-60' : 'active:bg-surface-dim transition-colors'}`}
                disabled={isInstalled}
              >
                <div className="w-9 h-9 rounded-xl bg-primary-container/60 flex items-center justify-center shrink-0">
                  {isInstalled ? (
                    <CheckCircle className="text-owed" size={18} strokeWidth={1.8} />
                  ) : isIOS ? (
                    <Share2 className="text-primary" size={18} strokeWidth={1.8} />
                  ) : (
                    <Download className="text-primary" size={18} strokeWidth={1.8} />
                  )}
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm text-on-surface">
                    {isInstalled ? 'App installed' : 'Install app'}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {isInstalled
                      ? 'Gully11 is installed on your device'
                      : isIOS
                        ? 'Tap Share then Add to Home Screen'
                        : 'Quick access to your fantasy leagues'}
                  </p>
                </div>
              </button>
            )}

            {/* Share app */}
            <button
              onClick={async () => {
                const shared = await shareApp({
                  title: 'Gully11 -- Fantasy IPL League',
                  text: 'Play fantasy IPL with friends on Gully11. Create leagues, predict rankings, settle up!',
                  url: window.location.origin,
                });
                if (shared && !navigator.share) {
                  setShareToast(true);
                  setTimeout(() => setShareToast(false), 2000);
                }
              }}
              className="w-full px-5 py-4 flex items-center gap-3 active:bg-surface-dim transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-primary-container/60 flex items-center justify-center shrink-0">
                <Send className="text-primary" size={18} strokeWidth={1.8} />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm text-on-surface">Share app</p>
                <p className="text-xs text-on-surface-variant mt-0.5">Tell your friends about Gully11</p>
              </div>
            </button>
          </div>
        </div>

        {/* Sign out */}
        {isAuthenticated && (
          <button
            onClick={signOut}
            className="w-full mt-8 text-center text-owe font-semibold py-3 flex items-center justify-center gap-2"
          >
            <LogOut size={20} />
            Sign Out
          </button>
        )}

        <p className="text-center text-on-surface-variant/40 text-sm mt-12">
          Gully11 v1.0
        </p>
      </main>

      {showLogin && (
        <LoginGate
          onLogin={signInWithGoogle}
          onClose={() => setShowLogin(false)}
        />
      )}

      <IOSInstallGuide show={showIOSGuide} onClose={closeIOSGuide} appName="Gully11" />

      {shareToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-on-surface text-white text-sm font-medium px-4 py-2 rounded-full shadow-lg z-50">
          Link copied!
        </div>
      )}
    </div>
  );
}
