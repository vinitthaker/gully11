import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface HeaderProps {
  variant?: 'app' | 'page';
  title?: string;
  showBack?: boolean;
  rightAction?: ReactNode;
}

export function Header({ variant = 'page', title, showBack = false, rightAction }: HeaderProps) {
  const navigate = useNavigate();

  if (variant === 'app') {
    return (
      <header className="sticky top-0 z-10 glass px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl sunset-gradient shadow-lg shadow-primary/20 flex items-center justify-center">
            <span className="font-headline font-bold text-white text-sm">G11</span>
          </div>
          <h1 className="font-headline font-bold tracking-tight text-2xl text-on-surface">Gully11</h1>
        </div>
        {rightAction && <div className="flex items-center gap-2">{rightAction}</div>}
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-10 glass px-5 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {showBack && (
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-dim transition-colors -ml-1"
          >
            <ArrowLeft className="text-on-surface" size={22} />
          </button>
        )}
        <h1 className="font-headline font-bold text-xl text-on-surface truncate">{title}</h1>
      </div>
      {rightAction && <div className="flex items-center gap-2">{rightAction}</div>}
    </header>
  );
}
