import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store';
import { supabase } from './lib/supabase';
import { initAnalytics, trackOnce, identifyUser, resetUser } from './lib/analytics';
import { AppShell } from './components/AppShell';
import { HomePage } from './pages/HomePage';
import { GroupDashboardPage } from './pages/GroupDashboardPage';
import { MatchesPage } from './pages/MatchesPage';
import { MatchDetailPage } from './pages/MatchDetailPage';
import { CompareTeamsPage } from './pages/CompareTeamsPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { SettlementsPage } from './pages/SettlementsPage';
import { MembersPage } from './pages/MembersPage';
import { GroupSettingsPage } from './pages/GroupSettingsPage';
import { SettingsPage } from './pages/SettingsPage';
import { JoinGroupPage } from './pages/JoinGroupPage';
import { CreateTeamPage } from './pages/CreateTeamPage';
import { UpdateToast } from './components/UpdateToast';

function AuthListener() {
  const setAuthUser = useStore((s) => s.setAuthUser);
  const fetchFromSupabase = useStore((s) => s.fetchFromSupabase);
  const fetchIPLSchedule = useStore((s) => s.fetchIPLSchedule);

  useEffect(() => {
    initAnalytics();
    trackOnce('app_opened');

    // Always fetch IPL schedule on app load (doesn't require auth)
    fetchIPLSchedule();

    let handled = false;

    async function handleAuth(user: { id: string; user_metadata: Record<string, any>; email?: string }) {
      if (handled) return;
      handled = true;

      setAuthUser(user as any);
      identifyUser(user.id, user.email);

      // Clean up OAuth hash fragments from URL after session is detected
      if (window.location.hash.includes('access_token')) {
        const cleanUrl = window.location.pathname + window.location.search;
        window.history.replaceState(null, '', cleanUrl);
      }

      await fetchFromSupabase();
    }

    // Get initial session (page refresh or OAuth redirect)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        handleAuth(session.user);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          handleAuth(session.user);
        } else if (event === 'SIGNED_OUT') {
          setAuthUser(null);
          resetUser();
        }
      }
    );

    // Refresh data when app comes back to foreground (PWA / tab switch)
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        fetchIPLSchedule();
        const state = useStore.getState();
        if (state.authUser) {
          fetchFromSupabase();
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [setAuthUser, fetchFromSupabase]);

  return null;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AppShell><HomePage /></AppShell>} />
      <Route path="/group/:id" element={<AppShell><GroupDashboardPage /></AppShell>} />
      <Route path="/group/:id/matches" element={<AppShell><MatchesPage /></AppShell>} />
      <Route path="/group/:id/match/:matchId" element={<AppShell><MatchDetailPage /></AppShell>} />
      <Route path="/group/:id/match/:matchId/compare/:compareUserId" element={<AppShell><CompareTeamsPage /></AppShell>} />
      <Route path="/group/:id/leaderboard" element={<AppShell><LeaderboardPage /></AppShell>} />
      <Route path="/group/:id/settlements" element={<AppShell><SettlementsPage /></AppShell>} />
      <Route path="/group/:id/members" element={<AppShell><MembersPage /></AppShell>} />
      <Route path="/group/:id/settings" element={<AppShell><GroupSettingsPage /></AppShell>} />
      <Route path="/settings" element={<AppShell><SettingsPage /></AppShell>} />
      <Route path="/group/:id/match/:matchId/create-team" element={<CreateTeamPage />} />
      <Route path="/g/:inviteCode" element={<JoinGroupPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthListener />
      <UpdateToast />
      <div className="max-w-2xl mx-auto min-h-screen bg-surface">
        <AppRoutes />
      </div>
    </BrowserRouter>
  );
}
