import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdateToast() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      // Check for updates every 30 minutes
      if (registration) {
        setInterval(() => registration.update(), 30 * 60 * 1000);
      }
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 max-w-md mx-auto animate-slide-up">
      <div
        className="bg-brand text-white rounded-xl px-4 py-3 shadow-lg flex items-center justify-between cursor-pointer"
        onClick={() => updateServiceWorker(true)}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🔄</span>
          <span className="font-medium text-sm">New version available</span>
        </div>
        <span className="text-sm font-semibold bg-white/20 rounded-lg px-3 py-1">
          Refresh
        </span>
      </div>
    </div>
  );
}
