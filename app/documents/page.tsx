'use client';

import { useEffect, useState } from 'react';
import { Download, FileText, FileImage, File, Search, Trash2 } from 'lucide-react';
import NavBar from '../components/NavBar';
import { useAuth } from '../components/useAuth';
import { apiFetch, downloadUrl, getAuthHeaders, isAdmin } from '../lib/api';

interface Document {
  id: string;
  title: string;
  description?: string;
  category?: string;
  tags: string[];
  filename: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  uploadedBy?: { firstName?: string; lastName?: string };
}

function FileIcon({ mime }: { mime: string }) {
  if (mime.startsWith('image/')) return <FileImage className="w-6 h-6 text-blue-400" />;
  if (mime === 'application/pdf') return <FileText className="w-6 h-6 text-red-400" />;
  return <File className="w-6 h-6 text-gray-400" />;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const { user, loading } = useAuth();
  const [docs, setDocs] = useState<Document[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [query, setQuery] = useState('');
  const [fetching, setFetching] = useState(true);
  const admin = user ? isAdmin(user) : false;

  useEffect(() => {
    if (!user) return;
    apiFetch<string[]>('/documents/categories').then(setCategories).catch(() => {});
    fetchDocs('', '');
  }, [user]);

  async function fetchDocs(q: string, category: string) {
    setFetching(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (q) params.set('q', q);
      if (category) params.set('category', category);
      const data = await apiFetch<{ total: number; items: Document[] }>('/documents?' + params.toString());
      setDocs(data.items);
    } catch { setDocs([]); }
    finally { setFetching(false); }
  }

  function handleCategory(cat: string) {
    setActiveCategory(cat);
    fetchDocs(query, cat);
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

  async function handleDelete(doc: Document) {
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/documents/${doc.id}`, { method: 'DELETE' });
      fetchDocs(query, activeCategory);
    } catch { alert('Delete failed'); }
  }

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Loading…</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <NavBar />

      <div className="border-b border-gray-800 bg-gray-900 px-6 py-3 flex items-center gap-4">
        <h1 className="font-semibold text-white">All Documents</h1>
        <form onSubmit={handleSearch} className="flex-1 max-w-md ml-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
              placeholder="Filter documents…"
            />
          </div>
        </form>
      </div>

      <div className="flex">
        {categories.length > 0 && (
          <aside className="w-48 border-r border-gray-800 bg-gray-900 min-h-screen p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Categories</p>
            <button onClick={() => handleCategory('')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 transition-colors ${activeCategory === '' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
              All
            </button>
            {categories.map(cat => (
              <button key={cat} onClick={() => handleCategory(cat)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 transition-colors ${activeCategory === cat ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
                {cat}
              </button>
            ))}
          </aside>
        )}

        <main className="flex-1 p-6">
          {fetching ? (
            <div className="text-center py-16 text-gray-400">Loading…</div>
          ) : docs.length === 0 ? (
            <div className="text-center py-16 text-gray-500">No documents found</div>
          ) : (
            <div className="grid gap-3">
              {docs.map(doc => (
                <div key={doc.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start gap-4 hover:border-gray-600 transition-colors">
                  <div className="flex-shrink-0 mt-0.5"><FileIcon mime={doc.mimeType} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white">{doc.title}</p>
                    {doc.description && <p className="text-sm text-gray-400 mt-0.5 line-clamp-1">{doc.description}</p>}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {doc.category && <span className="px-2 py-0.5 bg-gray-800 text-gray-300 text-xs rounded-full border border-gray-700">{doc.category}</span>}
                      {doc.tags.map(tag => <span key={tag} className="px-2 py-0.5 bg-red-950/40 text-red-300 text-xs rounded-full border border-red-900/50">{tag}</span>)}
                      <span className="text-xs text-gray-600 ml-auto">{formatBytes(doc.fileSize)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {admin && (
                      <button onClick={() => handleDelete(doc)} className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => handleDownload(doc)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-red-600 border border-gray-700 hover:border-red-600 text-gray-300 hover:text-white text-sm rounded-lg transition-colors">
                      <Download className="w-4 h-4" /> Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
