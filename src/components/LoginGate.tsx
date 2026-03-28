import { useState } from 'react';
import { Trophy } from 'lucide-react';
import { Button } from './Button';

interface LoginGateProps {
  onLogin: () => Promise<void>;
  onClose: () => void;
}

export function LoginGate({ onLogin, onClose }: LoginGateProps) {
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    try {
      await onLogin();
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white rounded-t-[2rem] p-6 pb-[max(2rem,env(safe-area-inset-bottom))] animate-slide-up">
        <div className="w-10 h-1 bg-surface-dim rounded-full mx-auto mb-6" />

        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-primary-container mx-auto mb-4 flex items-center justify-center">
            <Trophy className="text-primary" size={30} />
          </div>
          <h2 className="font-headline font-bold text-xl text-on-surface mb-2">
            Sign in to continue
          </h2>
          <p className="text-on-surface-variant text-sm leading-relaxed max-w-xs mx-auto">
            Sign in with Google to create groups, invite friends, and track your fantasy IPL results.
          </p>
        </div>

        <Button
          onClick={handleLogin}
          disabled={loading}
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
          {loading ? 'Signing in...' : 'Continue with Google'}
        </Button>

        <button
          onClick={onClose}
          className="w-full text-center mt-3 text-on-surface-variant font-medium text-sm py-2"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
