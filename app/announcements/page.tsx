'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Pin } from 'lucide-react';
import { useAuth } from '../components/useAuth';
import { apiFetch } from '../lib/api';

interface Announcement {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  author?: { firstName?: string; lastName?: string };
}

export default function AnnouncementsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!user) return;
    apiFetch<Announcement[]>('/announcements')
      .then(setAnnouncements)
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [user]);

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Loading…</div>;

  const pinned = announcements.filter(a => a.pinned);
  const rest = announcements.filter(a => !a.pinned);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-3 flex items-center gap-4">
        <button onClick={() => router.push('/')} className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-semibold text-white">Announcements</h1>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        {fetching ? (
          <div className="text-center py-16 text-gray-400">Loading…</div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-16 text-gray-500">No announcements yet</div>
        ) : (
          <div className="space-y-6">
            {pinned.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Pin className="w-3 h-3" /> Pinned
                </h2>
                <div className="space-y-4">
                  {pinned.map(a => (
                    <AnnouncementCard key={a.id} a={a} highlighted />
                  ))}
                </div>
              </section>
            )}

            {rest.length > 0 && (
              <section>
                {pinned.length > 0 && <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">All Updates</h2>}
                <div className="space-y-4">
                  {rest.map(a => (
                    <AnnouncementCard key={a.id} a={a} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function AnnouncementCard({ a, highlighted }: { a: Announcement; highlighted?: boolean }) {
  const authorName = a.author?.firstName
    ? `${a.author.firstName} ${a.author.lastName || ''}`.trim()
    : null;

  return (
    <div className={`rounded-xl p-6 border ${highlighted ? 'bg-gray-900 border-red-800/50' : 'bg-gray-900 border-gray-800'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {highlighted && <div className="w-2 h-2 mt-2 rounded-full bg-red-500 flex-shrink-0" />}
          <div>
            <h3 className="font-semibold text-white text-lg">{a.title}</h3>
            <p className="text-gray-300 mt-2 whitespace-pre-wrap leading-relaxed">{a.body}</p>
          </div>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-800 flex items-center gap-3 text-xs text-gray-500">
        <span>{new Date(a.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
        {authorName && <><span>·</span><span>{authorName}</span></>}
      </div>
    </div>
  );
}
