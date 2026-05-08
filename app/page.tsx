'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Pin, Download, FileText, FileImage, File, ChevronRight, Eye, X, Table2 } from 'lucide-react';
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
  fileSize: number; uploadedAt: string; browserViewable?: boolean;
}

const XLSX_MIMES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

function isXlsx(mime: string) { return XLSX_MIMES.includes(mime); }
function canPreview(doc: Document) {
  if (doc.mimeType === 'application/pdf' || doc.mimeType.startsWith('image/')) return true;
  if (isXlsx(doc.mimeType)) return !!doc.browserViewable;
  return false;
}

function FileIcon({ mime, size = 'sm' }: { mime: string; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'w-8 h-8' : 'w-5 h-5';
  if (mime.startsWith('image/')) return <FileImage className={`${cls} text-blue-400`} />;
  if (mime === 'application/pdf') return <FileText className={`${cls} text-red-400`} />;
  if (isXlsx(mime)) return <Table2 className={`${cls} text-green-400`} />;
  return <File className={`${cls} text-gray-400`} />;
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Spreadsheet viewer ────────────────────────────────────────────────────────
function SpreadsheetViewer({ docId, headers: authHeaders }: { docId: string; headers: Record<string, string> }) {
  const [sheets, setSheets] = useState<{ name: string; rows: string[][] }[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [error, setError] = useState(false);
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';

  useEffect(() => {
    fetch(`${backendUrl}/api/v1/documents/${docId}/spreadsheet`, { headers: authHeaders })
      .then(r => r.json())
      .then(data => setSheets(data.sheets ?? []))
      .catch(() => setError(true));
  }, [docId, backendUrl, authHeaders]);

  if (error) return <p className="text-gray-400">Failed to parse spreadsheet.</p>;
  if (!sheets.length) return <p className="text-gray-400 animate-pulse">Parsing spreadsheet…</p>;

  const { rows } = sheets[activeSheet];
  const headers = rows[0] ?? [];
  const body = rows.slice(1);

  return (
    <div className="w-full h-full flex flex-col">
      {/* Sheet tabs */}
      {sheets.length > 1 && (
        <div className="flex gap-1 px-4 pt-3 pb-0 flex-shrink-0 flex-wrap">
          {sheets.map((s, i) => (
            <button
              key={s.name}
              onClick={() => setActiveSheet(i)}
              className={`px-3 py-1.5 text-sm rounded-t-lg border-b-2 transition-colors ${
                i === activeSheet
                  ? 'bg-gray-800 text-white border-green-500'
                  : 'bg-gray-900 text-gray-400 border-transparent hover:text-white'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto p-4">
        <table className="text-sm border-collapse w-full">
          {headers.length > 0 && (
            <thead>
              <tr>
                {headers.map((h, i) => (
                  <th
                    key={i}
                    className="px-3 py-2 text-left text-xs font-semibold text-gray-300 bg-gray-800 border border-gray-700 whitespace-nowrap sticky top-0"
                  >
                    {String(h)}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {body.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? 'bg-gray-900' : 'bg-gray-950'}>
                {headers.map((_, ci) => (
                  <td key={ci} className="px-3 py-1.5 text-gray-300 border border-gray-800 whitespace-nowrap max-w-xs truncate">
                    {String(row[ci] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {body.length === 0 && <p className="text-center py-8 text-gray-500">No data in this sheet</p>}
      </div>
    </div>
  );
}

// ── Unified Doc Viewer Modal ──────────────────────────────────────────────────
function DocViewer({ doc, onClose }: { doc: Document; onClose: () => void }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const authHeaders = getAuthHeaders();

  useEffect(() => {
    let url = '';
    (async () => {
      try {
        const res = await fetch(downloadUrl(doc.id), { headers: authHeaders });
        const blob = await res.blob();
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
      } catch { setError(true); }
    })();
    return () => { if (url) URL.revokeObjectURL(url); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const isPdf = doc.mimeType === 'application/pdf';
  const isImage = doc.mimeType.startsWith('image/');
  const isSpreadsheet = isXlsx(doc.mimeType);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-950/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-900 flex-shrink-0">
        <FileIcon mime={doc.mimeType} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white truncate">{doc.title}</p>
          {doc.description && <p className="text-xs text-gray-400 truncate">{doc.description}</p>}
        </div>
        <a
          href={blobUrl ?? '#'}
          download={doc.filename}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white text-sm rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" /> Download
        </a>
        <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" title="Close (Esc)">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex items-center justify-center">
        {error && <p className="text-gray-400">Failed to load document.</p>}
        {!blobUrl && !error && <p className="text-gray-400 animate-pulse">Loading…</p>}
        {blobUrl && isPdf && (
          <iframe src={blobUrl} className="w-full h-full" title={doc.title} />
        )}
        {blobUrl && isImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={blobUrl} alt={doc.title} className="max-w-full max-h-full object-contain rounded-lg p-4" />
        )}
        {blobUrl && isSpreadsheet && (
          <SpreadsheetViewer docId={doc.id} headers={authHeaders} />
        )}
        {blobUrl && !isPdf && !isImage && !isSpreadsheet && (
          <p className="text-gray-400">Preview not available. <a href={blobUrl} download={doc.filename} className="text-red-400 hover:underline">Download the file</a> to view it.</p>
        )}
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  // Category sidebar
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // 'search' = show search box; 'docs' = show document list
  const [view, setView] = useState<'search' | 'docs'>('search');

  // Documents
  const [docs, setDocs] = useState<Document[]>([]);
  const [docTotal, setDocTotal] = useState(0);
  const [docLoading, setDocLoading] = useState(false);
  const [query, setQuery] = useState('');

  // Viewer
  const [viewerDoc, setViewerDoc] = useState<Document | null>(null);

  // Announcements
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    if (!user) return;
    apiFetch<string[]>('/documents/categories').then(setCategories).catch(() => {});
    apiFetch<Announcement[]>('/announcements').then(setAnnouncements).catch(() => {});
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

  function selectCategory(cat: string) {
    setActiveCategory(cat);
    setQuery('');
    setView('docs');
    fetchDocs('', cat);
  }

  function goSearch() {
    setActiveCategory(null);
    setQuery('');
    setView('search');
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setView('docs');
    fetchDocs(query, null);
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

  const closeViewer = useCallback(() => setViewerDoc(null), []);

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Loading…</div>;

  const pinned = announcements.filter(a => a.pinned);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <NavBar />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Sidebar ── */}
        <aside className="w-56 flex-shrink-0 border-r border-gray-800 bg-gray-900 flex flex-col overflow-y-auto">
          <div className="p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Categories</p>

            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => selectCategory(cat)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors flex items-center justify-between ${
                  activeCategory === cat && view === 'docs' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <span className="truncate">{cat}</span>
                {activeCategory === cat && view === 'docs' && <ChevronRight className="w-3 h-3 flex-shrink-0" />}
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
          {view === 'search' ? (
            /* ── Search / Landing view ── */
            <div className="flex-1 flex flex-col items-center justify-start px-4 pt-20 pb-16 overflow-y-auto">
              <h1 className="text-4xl font-bold text-white mb-2 text-center">What are you looking for?</h1>
              <p className="text-gray-400 mb-10 text-center">Search documents or pick a category on the left</p>
              <form onSubmit={handleSearch} className="w-full max-w-2xl">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search documents…"
                    className="w-full pl-12 pr-28 py-4 bg-gray-800 border border-gray-700 rounded-xl text-white text-lg placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 shadow-lg"
                    autoFocus
                  />
                  <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors">
                    Search
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* ── Document list view ── */
            <>
              <div className="border-b border-gray-800 bg-gray-900 px-6 py-3 flex items-center gap-4 flex-shrink-0">
                <button
                  onClick={goSearch}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <Search className="w-4 h-4" /> Search
                </button>
                <span className="text-gray-700">|</span>
                <h1 className="font-semibold text-white">
                  {activeCategory ?? 'Search Results'}
                  <span className="ml-2 text-xs text-gray-500 font-normal">{docTotal} doc{docTotal !== 1 ? 's' : ''}</span>
                </h1>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {docLoading ? (
                  <div className="text-center py-16 text-gray-400">Loading…</div>
                ) : docs.length === 0 ? (
                  <div className="text-center py-16 text-gray-500">No documents found</div>
                ) : (
                  <div className="grid gap-3">
                    {docs.map(doc => {
                      const showPreview = canPreview(doc);
                      return (
                        <div key={doc.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start gap-4 hover:border-gray-600 transition-colors">
                          <div className="flex-shrink-0 mt-0.5 cursor-pointer" onClick={() => setViewerDoc(doc)}>
                            <FileIcon mime={doc.mimeType} size="md" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className="font-semibold text-white cursor-pointer hover:text-red-400 transition-colors"
                              onClick={() => setViewerDoc(doc)}
                            >
                              {doc.title}
                            </p>
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
                          <div className="flex-shrink-0 flex items-center gap-2">
                            {showPreview && (
                              <button
                                onClick={() => setViewerDoc(doc)}
                                className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-blue-700 border border-gray-700 hover:border-blue-600 text-gray-300 hover:text-white text-sm rounded-lg transition-colors"
                                title="View in browser"
                              >
                                <Eye className="w-4 h-4" /> View
                              </button>
                            )}
                            <button
                              onClick={() => handleDownload(doc)}
                              className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-red-600 border border-gray-700 hover:border-red-600 text-gray-300 hover:text-white text-sm rounded-lg transition-colors"
                            >
                              <Download className="w-4 h-4" /> Download
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* ── PDF / Image Viewer Modal ── */}
      {viewerDoc && <DocViewer doc={viewerDoc} onClose={closeViewer} />}
    </div>
  );
}
