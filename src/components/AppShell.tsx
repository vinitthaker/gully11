import type { ReactNode } from 'react';
import { TabBar } from './TabBar';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="pb-24">{children}</div>
      <TabBar />
    </>
  );
}
