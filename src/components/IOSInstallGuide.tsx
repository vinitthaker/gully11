import { Share, Plus, X } from 'lucide-react';

interface IOSInstallGuideProps {
  show: boolean;
  onClose: () => void;
  appName?: string;
}

export function IOSInstallGuide({ show, onClose, appName = 'Gully11' }: IOSInstallGuideProps) {
  if (!show) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />

      {/* Bottom sheet */}
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 animate-slide-up max-w-lg mx-auto">
        <div className="p-6">
          {/* Handle */}
          <div className="w-10 h-1 bg-on-surface-variant/20 rounded-full mx-auto mb-5" />

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-headline font-bold text-lg text-on-surface">Install {appName}</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-dim">
              <X size={18} className="text-on-surface-variant" />
            </button>
          </div>

          {/* Steps */}
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary-container/60 flex items-center justify-center shrink-0">
                <span className="font-headline font-bold text-primary text-sm">1</span>
              </div>
              <div className="flex-1 pt-1.5">
                <p className="font-semibold text-sm text-on-surface">
                  Tap the <span className="inline-flex items-center align-middle mx-0.5"><Share size={14} className="text-blue-500" /></span> Share button
                </p>
                <p className="text-xs text-on-surface-variant mt-1">
                  At the bottom of Safari (or top in some browsers)
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary-container/60 flex items-center justify-center shrink-0">
                <span className="font-headline font-bold text-primary text-sm">2</span>
              </div>
              <div className="flex-1 pt-1.5">
                <p className="font-semibold text-sm text-on-surface">
                  Scroll down and tap <span className="inline-flex items-center align-middle mx-0.5"><Plus size={14} className="text-blue-500" /></span> <span className="font-semibold">Add to Home Screen</span>
                </p>
                <p className="text-xs text-on-surface-variant mt-1">
                  You may need to scroll down in the share menu
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary-container/60 flex items-center justify-center shrink-0">
                <span className="font-headline font-bold text-primary text-sm">3</span>
              </div>
              <div className="flex-1 pt-1.5">
                <p className="font-semibold text-sm text-on-surface">
                  Tap <span className="font-semibold">Add</span> to confirm
                </p>
                <p className="text-xs text-on-surface-variant mt-1">
                  {appName} will appear on your home screen
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full mt-6 py-3.5 bg-primary text-white font-semibold rounded-2xl text-sm"
          >
            Got it
          </button>
        </div>
      </div>
    </>
  );
}
