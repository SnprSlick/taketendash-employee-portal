'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Bell, LogOut, FileText, Pin } from 'lucide-react';
import { useAuth } from './components/useAuth';
import { apiFetch, clearAuth } from './lib/api';

interface Announcement {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  author?: { firstName?: string; lastName?: string };
}

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [query, setQuery] = useState('');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    apiFetch<Announcement[]>('/announcements')
      .then(setAnnouncements)
      .catch(() => {})
      .finally(() => setAnnouncementsLoading(false));
  }, [user]);

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (query.trim()) router.push('/search?q=' + encodeURIComponent(query.trim()));
  }

  function handleLogout() {
    clearAuth();
    router.push('/login');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Loading…</div>
      </div>
    );
  }

  const pinned = announcements.filter(a => a.pinned);
  const recent = announcements.filter(a => !a.pinned).slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">TT</span>
          </div>
          <span className="font-semibold text-white">Employee Portal</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/documents')} className="text-sm text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors">
            <FileText className="w-4 h-4" /> Documents
          </button>
          <button onClick={() => router.push('/announcements')} className="text-sm text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors">
            <Bell className="w-4 h-4" /> Announcements
          </button>
          <div className="h-4 w-px bg-gray-700" />
          <span className="text-sm text-gray-400">{user?.firstName || user?.username}</span>
          <button onClick={handleLogout} className="text-gray-500 hover:text-white transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex flex-col items-center px-4 pt-24 pb-16">
        <h1 className="text-4xl font-bold text-white mb-2 text-center">What are you looking for?</h1>
        <p className="text-gray-400 mb-10 text-center">Search policies, procedures, forms, and more</p>

        <form onSubmit={handleSearch} className="w-full max-w-2xl">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search documents…"
              className="w-full pl-12 pr-28 py-4 bg-gray-800 border border-gray-700 rounded-xl text-white text-lg placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent shadow-lg"
              autoFocus
            />
            <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors">
              Search
            </button>
          </div>
        </form>

        <div className="mt-6 flex flex-wrap gap-2 justify-center">
          {['Policy', 'Forms', 'Training', 'Safety', 'HR'].map(tag => (
            <button key={tag} onClick={() => router.push('/search?q=' + encodeURIComponent(tag))}
              className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 transition-colors">
              {tag}
            </button>
          ))}
        </div>

        {!announcementsLoading && pinned.length > 0 && (
          <div className="mt-16 w-full max-w-2xl">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Pin className="w-4 h-4" /> Pinned
            </h2>
            <div className="space-y-3">
              {pinned.map(a => (
                <div key={a.id} onClick={() => router.push('/announcements')}
                  className="bg-gray-900 border border-red-800/50 rounded-xl p-4 cursor-pointer hover:border-red-600 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 mt-1.5 rounded-full bg-red-500 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-white">{a.title}</p>
                      <p className="text-sm text-gray-400 mt-0.5 line-clamp-2">{a.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!announcementsLoading && recent.length > 0 && (
          <div className="mt-8 w-full max-w-2xl">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Recent Updates</h2>
            <div className="space-y-2">
              {recent.map(a => (
                <div key={a.id} onClick={() => router.push('/announcements')}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-4 cursor-pointer hover:border-gray-600 transition-colors">
                  <p className="font-medium text-white text-sm">{a.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(a.createdAt).toLocaleDateString()}
                    {a.author?.firstName ? ` · ${a.author.firstName} ${a.author.lastName || ''}` : ''}
                  </p>
                </div>
              ))}
            </div>
            <button onClick={() => router.push('/announcements')} className="mt-3 text-sm text-red-400 hover:text-red-300 transition-colors">
              View all announcements →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
