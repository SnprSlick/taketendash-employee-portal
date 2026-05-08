'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Pin, Download, FileText, FileImage, File, ChevronRight } from 'lucide-react';
import { useAuth } from './components/useAuth';
import NavBar from './components/NavBar';
import { apiFetch, downloadUrl, getAuthHeaders } from './lib/api';

interface Announcement {
  id: string; title: string; body: string; pinned: boolean;
  createdAt: string; author?: { firstName?: string; lastName?: string };
}

interface Document {
  id: string; title: string; description?: string; category?: string;
  tags: string[]; keywords?: string[]; filename: string; mimeType: string;
  fileSize: number; uploadedAt: string;
}

function FileIcon({ mime, size = 'sm' }: { mime: string; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'w-8 h-8' : 'w-5 h-5';
  if (mime.startsWith('image/')) return <FileImage className={`${cls} text-blue-400`} />;
  if (mime === 'application/pdf') return <FileText className={`${cls} text-red-400`} />;
  return <File className={`${cls} text-gray-400`} />;
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  // Category sidebar
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Documents
  const [docs, setDocs] = useState<Document[]>([]);
  const [docTotal, setDocTotal] = useState(0);
  const [docLoading, setDocLoading] = useState(false);
  const [query, setQuery] = useState('');

  // Announcements
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    if (!user) return;
    apiFetch<string[]>('/documents/categories').then(setCategories).catch(() => {});
    apiFetch<Announcement[]>('/announcements').then(setAnnouncements).catch(() => {});
    fetchDocs('', null);
  }, [user]);

  async function fetchDocs(q: string, category: string | null) {
    setDocLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (q) params.set('q', q);
      if (category) params.set('category', category);
      const data = await apiFetch<{ total: number; items: Document[] }>('/documents?' + params);
      setDocs(data.items);
      setDocTotal(data.total);
    } catch { setDocs([]); }
    finally { setDocLoading(false); }
  }

  function selectCategory(cat: string | null) {
    setActiveCategory(cat);
    setQuery('');
    fetchDocs('', cat);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchDocs(query, activeCategory);
  }

  async function handleDownload(doc: Document) {
    const url = downloadUrl(doc.id);
    const res = await fetch(url, { headers: getAuthHeaders() });
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = doc.filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Loading…</div>;

  const pinned = announcements.filter(a => a.pinned);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <NavBar />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Sidebar ── */}
        <aside className="w-56 flex-shrink-0 border-r border-gray-800 bg-gray-900 flex flex-col overflow-y-auto">
          <div className="p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Documents</p>

            <button
              onClick={() => selectCategory(null)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors flex items-center justify-between ${
                activeCategory === null ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <span>All Documents</span>
              {activeCategory === null && <ChevronRight className="w-3 h-3" />}
            </button>

            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => selectCategory(cat)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors flex items-center justify-between ${
                  activeCategory === cat ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <span className="truncate">{cat}</span>
                {activeCategory === cat && <ChevronRight className="w-3 h-3 flex-shrink-0" />}
              </button>
            ))}
          </div>

          {/* Pinned announcements in sidebar */}
          {pinned.length > 0 && (
            <div className="mt-auto border-t border-gray-800 p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Pin className="w-3 h-3" /> Pinned
              </p>
              <div className="space-y-2">
                {pinned.map(a => (
                  <button
                    key={a.id}
                    onClick={() => router.push('/announcements')}
                    className="w-full text-left p-2 rounded-lg bg-gray-800/60 hover:bg-gray-800 transition-colors border border-red-900/30"
                  >
                    <p className="text-xs font-medium text-white line-clamp-1">{a.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.body}</p>
                  </button>
                ))}
                <button onClick={() => router.push('/announcements')} className="text-xs text-red-400 hover:text-red-300 transition-colors w-full text-left">
                  All announcements →
                </button>
              </div>
            </div>
          )}
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Header bar */}
          <div className="border-b border-gray-800 bg-gray-900 px-6 py-3 flex items-center gap-4 flex-shrink-0">
            <h1 className="font-semibold text-white">
              {activeCategory ?? 'All Documents'}
              <span className="ml-2 text-xs text-gray-500 font-normal">{docTotal} doc{docTotal !== 1 ? 's' : ''}</span>
            </h1>
            <form onSubmit={handleSearch} className="flex-1 max-w-md ml-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch(e as unknown as React.FormEvent)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                  placeholder="Search documents…"
                />
              </div>
            </form>
          </div>

          {/* Document grid */}
          <div className="flex-1 overflow-y-auto p-6">
            {docLoading ? (
              <div className="text-center py-16 text-gray-400">Loading…</div>
            ) : docs.length === 0 ? (
              <div className="text-center py-16 text-gray-500">No documents found</div>
            ) : (
              <div className="grid gap-3">
                {docs.map(doc => (
                  <div key={doc.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start gap-4 hover:border-gray-600 transition-colors">
                    <div className="flex-shrink-0 mt-0.5"><FileIcon mime={doc.mimeType} size="md" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white">{doc.title}</p>
                      {doc.description && <p className="text-sm text-gray-400 mt-0.5 line-clamp-1">{doc.description}</p>}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {doc.category && (
                          <button
                            onClick={() => selectCategory(doc.category!)}
                            className="px-2 py-0.5 bg-gray-800 text-gray-300 text-xs rounded-full border border-gray-700 hover:border-gray-500 hover:text-white transition-colors"
                          >
                            {doc.category}
                          </button>
                        )}
                        {doc.tags.map(t => (
                          <span key={t} className="px-2 py-0.5 bg-red-950/40 text-red-300 text-xs rounded-full border border-red-900/50">{t}</span>
                        ))}
                        {doc.keywords?.slice(0, 4).map(k => (
                          <span key={k} className="px-2 py-0.5 bg-blue-950/40 text-blue-300 text-xs rounded-full border border-blue-900/50">{k}</span>
                        ))}
                        <span className="text-xs text-gray-600 ml-auto">{formatBytes(doc.fileSize)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownload(doc)}
                      className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-red-600 border border-gray-700 hover:border-red-600 text-gray-300 hover:text-white text-sm rounded-lg transition-colors"
                    >
                      <Download className="w-4 h-4" /> Download
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
