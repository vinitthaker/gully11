import { useState, useRef, useCallback, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

const THRESHOLD = 60; // px to pull before triggering refresh
const MAX_PULL = 100; // max pull distance

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isRefreshing) return;
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    }
  }, [isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current || isRefreshing) return;

    // Re-check scroll position (user might have scrolled up to 0 mid-touch)
    if (window.scrollY > 0) {
      pulling.current = false;
      setPullDistance(0);
      return;
    }

    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) {
      // Dampen the pull (feels more natural)
      const dampened = Math.min(delta * 0.4, MAX_PULL);
      setPullDistance(dampened);
    } else {
      setPullDistance(0);
    }
  }, [isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current || isRefreshing) return;
    pulling.current = false;

    if (pullDistance >= THRESHOLD) {
      setIsRefreshing(true);
      setPullDistance(THRESHOLD); // Snap to threshold during refresh
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, isRefreshing, onRefresh]);

  const progress = Math.min(pullDistance / THRESHOLD, 1);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-200 ease-out"
        style={{ height: pullDistance > 0 || isRefreshing ? `${pullDistance}px` : 0 }}
      >
        <RefreshCw
          size={20}
          className={`text-primary transition-opacity ${isRefreshing ? 'animate-spin' : ''}`}
          style={{
            opacity: progress,
            transform: `rotate(${progress * 360}deg)`,
          }}
        />
      </div>

      {children}
    </div>
  );
}
