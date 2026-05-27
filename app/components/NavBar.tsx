'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Settings, LogOut, Megaphone, Home, Calculator, LayoutDashboard } from 'lucide-react';
import { useAuth } from './useAuth';
import { clearAuth, isAdmin } from '../lib/api';

export default function NavBar() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  function logout() {
    clearAuth();
    router.replace('/login');
  }

  const navLink = (href: string, label: string, Icon: React.ElementType) => (
    <Link
      href={href}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
        pathname === href
          ? 'bg-red-600 text-white'
          : 'text-gray-400 hover:text-white hover:bg-gray-800'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </Link>
  );

  if (loading) return null;

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : user?.username;

  return (
    <header className="border-b border-gray-800 bg-gray-900 px-6 py-3 flex items-center gap-4 sticky top-0 z-40">
      {/* Logo */}
      <Link href="/" className="font-bold text-white text-lg tracking-tight mr-2 shrink-0">
        Take<span className="text-red-500">Ten</span>
      </Link>

      {/* Nav links */}
      <nav className="flex items-center gap-1">
        {navLink('/', 'Home', Home)}
        {navLink('/announcements', 'Announcements', Megaphone)}
        {navLink('/calculator', 'Pricing', Calculator)}
      </nav>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-2">
        <a
          href="https://dash.taketentire.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors"
          title="Back to TakeTen Dashboard"
        >
          <LayoutDashboard className="w-4 h-4" />
          <span className="hidden sm:inline">Dashboard</span>
        </a>

        {user && isAdmin(user) && (
          <Link
            href="/settings"
            className={`p-2 rounded-lg transition-colors ${
              pathname === '/settings'
                ? 'bg-red-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
            title="Admin Settings"
          >
            <Settings className="w-4 h-4" />
          </Link>
        )}

        <button
          onClick={logout}
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          title="Log out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
