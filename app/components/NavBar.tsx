'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Settings, LogOut, Megaphone, Home, Calculator, LayoutDashboard, DollarSign, Menu, X } from 'lucide-react';
import { useAuth } from './useAuth';
import { clearAuth, isAdmin } from '../lib/api';

export default function NavBar() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  function logout() {
    clearAuth();
    router.replace('/login');
  }

  const navLink = (href: string, label: string, Icon: React.ElementType) => (
    <Link
      href={href}
      onClick={() => setMenuOpen(false)}
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

  return (
    <header className="border-b border-gray-800 bg-gray-900 px-4 sm:px-6 py-3 flex items-center gap-4 sticky top-0 z-40">
      {/* Logo */}
      <Link href="/" className="font-bold text-white text-lg tracking-tight mr-2 shrink-0">
        Take<span className="text-red-500">Ten</span>
      </Link>

      {/* Mobile menu button */}
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
      >
        {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Nav links - hidden on mobile, visible on md+ */}
      <nav className="hidden md:flex items-center gap-1">
        {navLink('/', 'Home', Home)}
        {navLink('/announcements', 'Announcements', Megaphone)}
        {navLink('/commission', 'Commission', DollarSign)}
        {navLink('/calculator', 'Pricing', Calculator)}
      </nav>

      {/* Right side - hidden on mobile */}
      <div className="ml-auto hidden md:flex items-center gap-2">
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

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="absolute top-full left-0 right-0 bg-gray-900 border-b border-gray-800 p-4 flex flex-col gap-2 md:hidden z-50">
          {navLink('/', 'Home', Home)}
          {navLink('/announcements', 'Announcements', Megaphone)}
          {navLink('/commission', 'Commission', DollarSign)}
          {navLink('/calculator', 'Pricing', Calculator)}
          <div className="border-t border-gray-800 my-1" />
          <a
            href="https://dash.taketentire.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </a>
          {user && isAdmin(user) && (
            <Link
              href="/settings"
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname === '/settings'
                  ? 'bg-red-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Settings className="w-4 h-4" />
              Admin Settings
            </Link>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </div>
      )}
    </header>
  );
}
