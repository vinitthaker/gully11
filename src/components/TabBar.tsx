import { useLocation, useNavigate } from 'react-router-dom';
import { Trophy, Settings, type LucideIcon } from 'lucide-react';

const tabs: { key: string; label: string; path: string; icon: LucideIcon }[] = [
  { key: 'groups', label: 'GROUPS', path: '/', icon: Trophy },
  { key: 'settings', label: 'SETTINGS', path: '/settings', icon: Settings },
];

export function TabBar() {
  const location = useLocation();
  const navigate = useNavigate();

  function isActive(path: string) {
    if (path === '/') return location.pathname === '/' || location.pathname.startsWith('/group');
    return location.pathname.startsWith(path);
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20">
      <div className="max-w-2xl mx-auto bg-white/90 backdrop-blur-md border-t border-gray-100">
        <div className="flex items-center justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {tabs.map((tab) => {
            const active = isActive(tab.path);
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => navigate(tab.path)}
                className={`flex flex-col items-center gap-0.5 py-1.5 px-4 rounded-2xl min-w-[64px] transition-colors ${active ? 'bg-primary-container' : ''}`}
              >
                <Icon
                  size={22}
                  className={active ? 'text-primary' : 'text-on-surface-variant'}
                  strokeWidth={active ? 2.5 : 2}
                />
                <span className={`text-[0.6rem] font-bold tracking-wider ${active ? 'text-on-primary-container' : 'text-on-surface-variant'}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
