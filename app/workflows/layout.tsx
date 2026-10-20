'use client';

import { useAuth } from '../components/useAuth';
import NavBar from '../components/NavBar';

export default function WorkflowsLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading || !user) return null;
  return (
    <div className="flex h-screen flex-col">
      <NavBar />
      <div className="min-h-0 flex-1 overflow-auto bg-slate-50 text-slate-900">{children}</div>
    </div>
  );
}
