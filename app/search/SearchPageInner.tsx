'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, ArrowLeft, Download, FileText, FileImage, File } from 'lucide-react';
import { useAuth } from '../components/useAuth';
import { apiFetch, downloadUrl, getAuthHeaders } from '../lib/api';

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
  if (mime.startsWith('image/')) return <FileImage className="w-8 h-8 text-blue-400" />;
  if (mime === 'application/pdf') return <FileText className="w-8 h-8 text-red-400" />;
  return <File className="w-8 h-8 text-gray-400" />;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SearchPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading } = useAuth();
  const [query, setQuery] = useState(params.get('q') || '');
  const [results, setResults] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = params.get('q');
    if (q) { setQuery(q); runSearch(q); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  async function runSearch(q: string) {
    setSearching(true);
    try {
      const data = await apiFetch<{ total: number; items: Document[] }>(
        `/documents?q=${encodeURIComponent(q)}&limit=50`
      );
      setResults(data.items);
      setTotal(data.total);
    } catch { setResults([]); }
    finally { setSearching(false); }
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (query.trim()) router.push('/search?q=' + encodeURIComponent(query.trim()));
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

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-3 flex items-center gap-4">
        <button onClick={() => router.push('/')} className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <form onSubmit={handleSearch} className="flex-1 max-w-2xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
              placeholder="Search documents…"
            />
          </div>
        </form>
        <span className="text-sm text-gray-400">{user?.firstName || user?.username}</span>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {searching ? (
          <div className="text-center py-16 text-gray-400">Searching…</div>
        ) : results.length === 0 && params.get('q') ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg">No documents found for &ldquo;{params.get('q')}&rdquo;</p>
            <p className="text-gray-600 text-sm mt-2">Try a different keyword or browse all documents</p>
            <button onClick={() => router.push('/documents')} className="mt-4 text-red-400 hover:text-red-300 text-sm">
              Browse all documents →
            </button>
          </div>
        ) : (
          <>
            {params.get('q') && (
              <p className="text-sm text-gray-400 mb-6">
                {total} result{total !== 1 ? 's' : ''} for &ldquo;{params.get('q')}&rdquo;
              </p>
            )}
            <div className="space-y-3">
              {results.map(doc => (
                <div key={doc.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start gap-4 hover:border-gray-600 transition-colors">
                  <div className="flex-shrink-0 mt-0.5">
                    <FileIcon mime={doc.mimeType} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white">{doc.title}</p>
                    {doc.description && <p className="text-sm text-gray-400 mt-0.5 line-clamp-2">{doc.description}</p>}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {doc.category && (
                        <span className="px-2 py-0.5 bg-gray-800 text-gray-300 text-xs rounded-full border border-gray-700">{doc.category}</span>
                      )}
                      {doc.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-red-950/40 text-red-300 text-xs rounded-full border border-red-900/50">{tag}</span>
                      ))}
                      <span className="text-xs text-gray-600 ml-auto">{formatBytes(doc.fileSize)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownload(doc)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-red-600 border border-gray-700 hover:border-red-600 text-gray-300 hover:text-white text-sm rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
