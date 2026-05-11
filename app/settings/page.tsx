'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload, Trash2, Pencil, Pin, PinOff, Plus, X, Check, FileText, FileImage, File, Megaphone, Tag, FileSearch, Eye, EyeOff, Search, ArrowUpDown, FolderOpen, Table2,
} from 'lucide-react';
import NavBar from '../components/NavBar';
import { useAuth } from '../components/useAuth';
import { apiFetch, apiUpload, isAdmin } from '../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Document {
  id: string;
  title: string;
  description?: string;
  category?: string;
  tags: string[];
  keywords: string[];
  filename: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  transcribedAt?: string | null;
  transcription?: string | null;
  browserViewable?: boolean;
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  author?: { firstName?: string; lastName?: string };
}

interface PendingFile { file: File; title: string; category: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ mime }: { mime: string }) {
  if (mime.startsWith('image/')) return <FileImage className="w-4 h-4 text-blue-400" />;
  if (mime === 'application/pdf') return <FileText className="w-4 h-4 text-red-400" />;
  return <File className="w-4 h-4 text-gray-400" />;
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
        active ? 'border-red-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
      }`}
    >
      {children}
    </button>
  );
}

function StatusBadge({ type, msg }: { type: 'success' | 'error'; msg: string }) {
  return (
    <div className={`text-sm px-4 py-2 rounded-lg ${type === 'success' ? 'bg-green-900/40 text-green-300 border border-green-800' : 'bg-red-900/40 text-red-300 border border-red-800'}`}>
      {msg}
    </div>
  );
}

function HighlightText({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length || !text) return <>{text}</>;
  const escaped = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(regex);
  const termSet = new Set(terms.map(t => t.toLowerCase()));
  return (
    <>
      {parts.map((part, i) =>
        termSet.has(part.toLowerCase())
          ? <mark key={i} className="bg-yellow-500/30 text-yellow-100 rounded-sm px-px not-italic">{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </>
  );
}

// ─── Documents Tab ────────────────────────────────────────────────────────────

function DocumentsTab() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', category: '', tags: '' });
  const [viewingTranscriptionId, setViewingTranscriptionId] = useState<string | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkEditForm, setBulkEditForm] = useState({ category: '', tags: '' });
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkWorking, setBulkWorking] = useState(false);

  // Filter / sort state
  const [filterSearch, setFilterSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'size' | 'category'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const visibleDocs = useMemo(() => {
    let result = [...docs];
    if (filterCategory) result = result.filter(d => d.category === filterCategory);
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      result = result.filter(d =>
        d.title.toLowerCase().includes(q) ||
        d.description?.toLowerCase().includes(q) ||
        d.tags.some(t => t.toLowerCase().includes(q)) ||
        d.keywords?.some(k => k.toLowerCase().includes(q)) ||
        d.filename.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'date') cmp = new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
      else if (sortBy === 'title') cmp = a.title.localeCompare(b.title);
      else if (sortBy === 'size') cmp = a.fileSize - b.fileSize;
      else if (sortBy === 'category') cmp = (a.category || '').localeCompare(b.category || '');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [docs, filterSearch, filterCategory, sortBy, sortDir]);

  function toggleSort(field: typeof sortBy) {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir(field === 'date' ? 'desc' : 'asc'); }
  }

  // Upload form state
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploadShared, setUploadShared] = useState({ description: '', category: '', tags: '' });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadDocs(); }, []); // fires after SettingsPage confirms auth

  async function loadDocs() {
    setLoading(true);
    try {
      const [docsData, cats] = await Promise.all([
        apiFetch<{ total: number; items: Document[] }>('/documents?limit=200'),
        apiFetch<string[]>('/documents/categories'),
      ]);
      setDocs(docsData.items);
      setCategories(cats);
    } catch { setDocs([]); }
    finally { setLoading(false); }
  }

  function flash(type: 'success' | 'error', msg: string) {
    setStatus({ type, msg });
    setTimeout(() => setStatus(null), 4000);
  }

  function handleFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).filter(f => f.size > 0);
    const entries: PendingFile[] = files.map(f => {
      const parts = f.webkitRelativePath ? f.webkitRelativePath.split('/') : [];
      const folderCategory = parts.length > 1 ? parts[parts.length - 2] : '';
      return {
        file: f,
        title: f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim(),
        category: folderCategory,
      };
    });
    setPendingFiles(prev => [...prev, ...entries]);
    e.target.value = '';
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (pendingFiles.length === 0) return flash('error', 'Select at least one file');
    if (pendingFiles.some(f => !f.title.trim())) return flash('error', 'All files need a title');
    setUploading(true);
    setUploadProgress({ done: 0, total: pendingFiles.length });
    let failed = 0;
    let done = 0;

    // Upload in batches of 5 concurrently
    const BATCH = 5;
    const snapshot = [...pendingFiles];
    for (let i = 0; i < snapshot.length; i += BATCH) {
      const batch = snapshot.slice(i, i + BATCH);
      await Promise.all(batch.map(async ({ file, title, category }) => {
        try {
          const form = new FormData();
          form.append('file', file);
          form.append('title', title.trim());
          if (uploadShared.description) form.append('description', uploadShared.description);
          const effectiveCategory = category || uploadShared.category;
          if (effectiveCategory) form.append('category', effectiveCategory);
          if (uploadShared.tags) form.append('tags', uploadShared.tags.split(',').map(t => t.trim()).filter(Boolean).join(','));
          await apiUpload('/documents/upload', form);
        } catch { failed++; }
        done++;
        setUploadProgress({ done, total: snapshot.length });
      }));
    }
    setPendingFiles([]);
    setUploadShared({ description: '', category: '', tags: '' });
    if (fileRef.current) fileRef.current.value = '';
    flash(
      failed === 0 ? 'success' : 'error',
      failed === 0
        ? `${pendingFiles.length} document${pendingFiles.length !== 1 ? 's' : ''} uploaded successfully`
        : `${pendingFiles.length - failed} uploaded, ${failed} failed`,
    );
    setUploading(false);
    loadDocs();
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/documents/${id}`, { method: 'DELETE' });
      flash('success', 'Document deleted');
      loadDocs();
    } catch (err: unknown) {
      flash('error', err instanceof Error ? err.message : 'Delete failed');
    }
  }

  async function handleTranscribe(id: string, title: string) {
    try {
      await apiFetch(`/documents/${id}/transcribe`, { method: 'POST' });
      flash('success', `"${title}" transcribed successfully`);
      loadDocs();
    } catch (err: unknown) {
      flash('error', err instanceof Error ? err.message : 'Transcription failed');
    }
  }

  async function handleToggleBrowserViewable(id: string, current: boolean) {
    try {
      await apiFetch(`/documents/${id}/browser-viewable`, {
        method: 'POST',
        body: JSON.stringify({ value: !current }),
      });
      setDocs(prev => prev.map(d => d.id === id ? { ...d, browserViewable: !current } : d));
    } catch (err: unknown) {
      flash('error', err instanceof Error ? err.message : 'Failed to update');
    }
  }

  function startEdit(doc: Document) {
    setEditingId(doc.id);
    setEditForm({ title: doc.title, description: doc.description || '', category: doc.category || '', tags: doc.tags.join(', ') });
  }

  async function saveEdit(id: string) {
    try {
      await apiFetch(`/documents/${id}`, {
        method: 'POST',
        body: JSON.stringify({
          title: editForm.title.trim(),
          description: editForm.description || undefined,
          category: editForm.category || undefined,
          tags: editForm.tags.split(',').map(t => t.trim()).filter(Boolean).join(','),
        }),
      });
      setEditingId(null);
      flash('success', 'Document updated');
      loadDocs();
    } catch (err: unknown) {
      flash('error', err instanceof Error ? err.message : 'Update failed');
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === visibleDocs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleDocs.map(d => d.id)));
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} document${selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    setBulkWorking(true);
    let failed = 0;
    for (const id of Array.from(selectedIds)) {
      try { await apiFetch(`/documents/${id}`, { method: 'DELETE' }); }
      catch { failed++; }
    }
    setBulkWorking(false);
    setSelectedIds(new Set());
    setBulkMode(false);
    flash(failed ? 'error' : 'success', failed ? `Deleted with ${failed} error(s)` : `${selectedIds.size} document${selectedIds.size !== 1 ? 's' : ''} deleted`);
    loadDocs();
  }

  async function handleBulkEdit() {
    if (selectedIds.size === 0) return;
    setBulkWorking(true);
    let failed = 0;
    for (const id of Array.from(selectedIds)) {
      try {
        const body: Record<string, string> = {};
        if (bulkEditForm.category.trim()) body.category = bulkEditForm.category.trim();
        if (bulkEditForm.tags.trim()) body.tags = bulkEditForm.tags.trim();
        await apiFetch(`/documents/${id}`, { method: 'POST', body: JSON.stringify(body) });
      } catch { failed++; }
    }
    setBulkWorking(false);
    setSelectedIds(new Set());
    setBulkMode(false);
    setShowBulkEdit(false);
    setBulkEditForm({ category: '', tags: '' });
    flash(failed ? 'error' : 'success', failed ? `Updated with ${failed} error(s)` : `${selectedIds.size} document${selectedIds.size !== 1 ? 's' : ''} updated`);
    loadDocs();
  }

  return (
    <div className="space-y-8">
      {status && <StatusBadge {...status} />}

      {/* Upload */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2"><Upload className="w-4 h-4 text-red-400" /> Upload Documents</h2>
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Category</label>
              <input
                list="cat-list"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="e.g. Policy, HR, Safety"
                value={uploadShared.category}
                onChange={e => setUploadShared(f => ({ ...f, category: e.target.value }))}
              />
              <datalist id="cat-list">
                {categories.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1"><Tag className="w-3 h-3" /> Tags <span className="text-gray-600">(comma separated)</span></label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="e.g. handbook, onboarding"
                value={uploadShared.tags}
                onChange={e => setUploadShared(f => ({ ...f, tags: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Description</label>
            <textarea
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              rows={2}
              placeholder="Brief description (optional, applied to all files)"
              value={uploadShared.description}
              onChange={e => setUploadShared(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Files <span className="text-red-500">*</span></label>
            <div className="flex gap-2">
              <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 hover:border-gray-500 hover:text-white cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" />
                Select files
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFilesChange}
                />
              </label>
              <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 hover:border-gray-500 hover:text-white cursor-pointer transition-colors">
                <FolderOpen className="w-3.5 h-3.5" />
                Upload folder
                <input
                  ref={folderRef}
                  type="file"
                  // @ts-expect-error webkitdirectory is non-standard
                  webkitdirectory=""
                  multiple
                  className="hidden"
                  onChange={handleFilesChange}
                />
              </label>
            </div>
            <p className="text-xs text-gray-600 mt-1">Folder uploads auto-set category from folder name</p>
          </div>
          {pendingFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-400">{pendingFiles.length} file{pendingFiles.length !== 1 ? 's' : ''} queued — edit titles/categories as needed:</p>
              {pendingFiles.map((pf, i) => (
                <div key={i} className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
                  <FileIcon mime={pf.file.type} />
                  <input
                    value={pf.title}
                    onChange={e => setPendingFiles(prev => prev.map((p, j) => j === i ? { ...p, title: e.target.value } : p))}
                    className="flex-1 min-w-0 bg-transparent text-sm text-white focus:outline-none border-b border-gray-600 focus:border-red-500 pb-0.5"
                    placeholder="Title"
                  />
                  <input
                    value={pf.category}
                    onChange={e => setPendingFiles(prev => prev.map((p, j) => j === i ? { ...p, category: e.target.value } : p))}
                    list="cat-list"
                    className="w-28 bg-transparent text-xs text-gray-400 focus:text-white focus:outline-none border-b border-gray-700 focus:border-red-500 pb-0.5 flex-shrink-0"
                    placeholder="Category"
                  />
                  <span className="text-xs text-gray-500 flex-shrink-0">{formatBytes(pf.file.size)}</span>
                  <button
                    type="button"
                    onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))}
                    className="p-0.5 text-gray-500 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={uploading || pendingFiles.length === 0}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {uploading
                ? `Uploading ${uploadProgress.done}/${uploadProgress.total}…`
                : pendingFiles.length > 1 ? `Upload ${pendingFiles.length} files` : 'Upload'}
            </button>
            {pendingFiles.length > 0 && !uploading && (
              <button
                type="button"
                onClick={() => { setPendingFiles([]); if (fileRef.current) fileRef.current.value = ''; if (folderRef.current) folderRef.current.value = ''; }}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
        </form>
      </section>

      {/* Document list */}
      <section>
        {/* Filter / Sort bar */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
            <input
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              placeholder="Filter by title, tag, keyword…"
              className="w-full pl-9 pr-8 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            {filterSearch && (
              <button onClick={() => setFilterSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="flex items-center gap-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-gray-500 mr-0.5" />
            {(['date', 'title', 'size', 'category'] as const).map(field => (
              <button
                key={field}
                onClick={() => toggleSort(field)}
                className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${sortBy === field ? 'bg-red-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'}`}
              >
                {field.charAt(0).toUpperCase() + field.slice(1)}
                {sortBy === field && <span className="ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {visibleDocs.length}{visibleDocs.length !== docs.length ? `/${docs.length}` : ''} doc{docs.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => { setBulkMode(m => !m); setSelectedIds(new Set()); setShowBulkEdit(false); }}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${bulkMode ? 'bg-red-700 border-red-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}
          >
            {bulkMode ? 'Cancel' : 'Bulk Select'}
          </button>
        </div>

        {/* Bulk action toolbar */}
        {bulkMode && (
          <div className="flex flex-wrap items-center gap-2 mb-3 p-3 bg-gray-900 border border-gray-700 rounded-xl">
            <input
              type="checkbox"
              checked={visibleDocs.length > 0 && selectedIds.size === visibleDocs.length}
              onChange={toggleSelectAll}
              className="w-4 h-4 accent-red-500 cursor-pointer"
            />
            <span className="text-xs text-gray-400">{selectedIds.size} selected</span>
            {selectedIds.size > 0 && (
              <>
                <button
                  onClick={() => setShowBulkEdit(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-xs rounded-lg transition-colors"
                >
                  <Pencil className="w-3 h-3" /> Bulk Edit
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkWorking}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" /> Delete {selectedIds.size}
                </button>
              </>
            )}
          </div>
        )}

        {/* Bulk edit form */}
        {bulkMode && showBulkEdit && selectedIds.size > 0 && (
          <div className="mb-3 p-4 bg-gray-900 border border-blue-800 rounded-xl space-y-3">
            <p className="text-xs text-blue-300 font-semibold">Apply to {selectedIds.size} selected document{selectedIds.size !== 1 ? 's' : ''} — leave blank to keep existing value</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Category</label>
                <input
                  list="cat-list"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Override category…"
                  value={bulkEditForm.category}
                  onChange={e => setBulkEditForm(f => ({ ...f, category: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Tags (comma separated)</label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Override tags…"
                  value={bulkEditForm.tags}
                  onChange={e => setBulkEditForm(f => ({ ...f, tags: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleBulkEdit} disabled={bulkWorking || (!bulkEditForm.category.trim() && !bulkEditForm.tags.trim())} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs rounded-lg transition-colors disabled:opacity-50">
                <Check className="w-3 h-3" /> Apply
              </button>
              <button onClick={() => setShowBulkEdit(false)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg transition-colors">
                <X className="w-3 h-3" /> Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : docs.length === 0 ? (
          <p className="text-gray-500 text-sm">No documents uploaded yet.</p>
        ) : visibleDocs.length === 0 ? (
          <p className="text-gray-500 text-sm">No documents match your filters.</p>
        ) : (
          <div className="space-y-2">
            {visibleDocs.map(doc => (
              <div key={doc.id} className={`bg-gray-900 border rounded-xl overflow-hidden transition-colors ${bulkMode && selectedIds.has(doc.id) ? 'border-red-600' : 'border-gray-800'}`}>
                {editingId === doc.id ? (
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Title</label>
                        <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                          value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Category</label>
                        <input list="cat-list" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                          value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Description</label>
                      <textarea className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500" rows={2}
                        value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Tags (comma separated)</label>
                      <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                        value={editForm.tags} onChange={e => setEditForm(f => ({ ...f, tags: e.target.value }))} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(doc.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs rounded-lg transition-colors">
                        <Check className="w-3 h-3" /> Save
                      </button>
                      <button onClick={() => setEditingId(null)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg transition-colors">
                        <X className="w-3 h-3" /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="p-4 flex items-start gap-3">
                      {bulkMode && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(doc.id)}
                          onChange={() => toggleSelect(doc.id)}
                          className="mt-1 w-4 h-4 accent-red-500 cursor-pointer flex-shrink-0"
                        />
                      )}
                      <div className="mt-0.5 flex-shrink-0"><FileIcon mime={doc.mimeType} /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">
                          {filterSearch
                            ? <HighlightText text={doc.title} terms={[filterSearch]} />
                            : doc.title}
                        </p>
                        {doc.description && (
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                            {filterSearch
                              ? <HighlightText text={doc.description} terms={[filterSearch]} />
                              : doc.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {doc.category && <span className="px-2 py-0.5 bg-gray-800 text-gray-300 text-xs rounded-full border border-gray-700">{doc.category}</span>}
                          {doc.tags.map(t => <span key={t} className="px-2 py-0.5 bg-red-950/40 text-red-300 text-xs rounded-full border border-red-900/50">{t}</span>)}
                          {doc.keywords?.slice(0, 8).map(k => (
                            <span key={k} className="px-2 py-0.5 bg-blue-950/40 text-blue-300 text-xs rounded-full border border-blue-900/50">{k}</span>
                          ))}
                          <span className="text-xs text-gray-600">{formatBytes(doc.fileSize)}</span>
                          <span className="text-xs text-gray-600">{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                          {doc.transcribedAt && (
                            <span className="text-xs text-green-600">✓ transcribed</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button onClick={() => startEdit(doc)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {doc.transcribedAt && (
                          <button
                            onClick={() => setViewingTranscriptionId(viewingTranscriptionId === doc.id ? null : doc.id)}
                            className={`p-1.5 rounded-lg transition-colors ${viewingTranscriptionId === doc.id ? 'text-blue-400 bg-blue-950/40' : 'text-gray-400 hover:text-blue-400 hover:bg-blue-950/40'}`}
                            title="View transcription"
                          >
                            {viewingTranscriptionId === doc.id ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        {doc.mimeType === 'application/pdf' && (
                          <button
                            onClick={() => handleTranscribe(doc.id, doc.title)}
                            className={`p-1.5 rounded-lg transition-colors ${doc.transcribedAt ? 'text-green-400 hover:text-green-300 hover:bg-green-950/40' : 'text-gray-400 hover:text-yellow-400 hover:bg-yellow-950/40'}`}
                            title={doc.transcribedAt ? 'Re-transcribe PDF' : 'Transcribe PDF'}
                          >
                            <FileSearch className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {(doc.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || doc.mimeType === 'application/vnd.ms-excel') && (
                          <button
                            onClick={() => handleToggleBrowserViewable(doc.id, !!doc.browserViewable)}
                            className={`p-1.5 rounded-lg transition-colors ${doc.browserViewable ? 'text-green-400 bg-green-950/40 hover:text-red-400 hover:bg-red-950/40' : 'text-gray-400 hover:text-green-400 hover:bg-green-950/40'}`}
                            title={doc.browserViewable ? 'Disable browser viewer' : 'Enable browser viewer'}
                          >
                            <Table2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => handleDelete(doc.id, doc.title)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-950/40 transition-colors" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {viewingTranscriptionId === doc.id && (
                      <div className="border-t border-gray-800 px-4 pb-4 pt-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Transcription</p>
                          {doc.keywords && doc.keywords.length > 0 && (
                            <p className="text-xs text-yellow-600">Keywords highlighted in yellow</p>
                          )}
                        </div>
                        <div className="text-xs text-gray-300 whitespace-pre-wrap break-words leading-relaxed max-h-80 overflow-y-auto bg-gray-950 rounded-lg p-3 border border-gray-800 font-mono">
                          {doc.transcription?.trim()
                            ? <HighlightText text={doc.transcription.trim()} terms={doc.keywords ?? []} />
                            : <span className="text-gray-600 italic">No transcription text available.</span>
                          }
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Announcements Tab ────────────────────────────────────────────────────────

function AnnouncementsTab() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', pinned: false });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: '', body: '', pinned: false });

  useEffect(() => { loadAnnouncements(); }, []);

  async function loadAnnouncements() {
    setLoading(true);
    try {
      const data = await apiFetch<Announcement[]>('/announcements');
      setAnnouncements(data);
    } catch { setAnnouncements([]); }
    finally { setLoading(false); }
  }

  function flash(type: 'success' | 'error', msg: string) {
    setStatus({ type, msg });
    setTimeout(() => setStatus(null), 4000);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return flash('error', 'Title and body are required');
    try {
      await apiFetch('/announcements', { method: 'POST', body: JSON.stringify(form) });
      setForm({ title: '', body: '', pinned: false });
      setCreating(false);
      flash('success', 'Announcement posted');
      loadAnnouncements();
    } catch (err: unknown) { flash('error', err instanceof Error ? err.message : 'Failed to post'); }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return;
    try {
      await apiFetch(`/announcements/${id}`, { method: 'DELETE' });
      flash('success', 'Announcement deleted');
      loadAnnouncements();
    } catch (err: unknown) { flash('error', err instanceof Error ? err.message : 'Delete failed'); }
  }

  async function togglePin(a: Announcement) {
    try {
      await apiFetch(`/announcements/${a.id}`, { method: 'PATCH', body: JSON.stringify({ pinned: !a.pinned }) });
      loadAnnouncements();
    } catch (err: unknown) { flash('error', err instanceof Error ? err.message : 'Failed to update'); }
  }

  function startEdit(a: Announcement) {
    setEditingId(a.id);
    setEditForm({ title: a.title, body: a.body, pinned: a.pinned });
  }

  async function saveEdit(id: string) {
    try {
      await apiFetch(`/announcements/${id}`, { method: 'PATCH', body: JSON.stringify(editForm) });
      setEditingId(null);
      flash('success', 'Announcement updated');
      loadAnnouncements();
    } catch (err: unknown) { flash('error', err instanceof Error ? err.message : 'Update failed'); }
  }

  return (
    <div className="space-y-6">
      {status && <StatusBadge {...status} />}

      {/* New announcement */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white flex items-center gap-2"><Megaphone className="w-4 h-4 text-red-400" /> New Announcement</h2>
          {!creating && (
            <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors">
              <Plus className="w-3.5 h-3.5" /> New
            </button>
          )}
        </div>

        {creating && (
          <form onSubmit={handleCreate} className="space-y-3">
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Title *"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
            <textarea
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              rows={4}
              placeholder="Announcement body *"
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
            />
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
              <input type="checkbox" checked={form.pinned} onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))} className="accent-red-500" />
              Pin to top
            </label>
            <div className="flex gap-2">
              <button type="submit" className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors">
                <Check className="w-3.5 h-3.5" /> Post
              </button>
              <button type="button" onClick={() => setCreating(false)} className="flex items-center gap-1.5 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors">
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Announcement list */}
      <section>
        <h2 className="text-base font-semibold text-white mb-3">All Announcements <span className="text-gray-500 font-normal text-sm">({announcements.length})</span></h2>
        {loading ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : announcements.length === 0 ? (
          <p className="text-gray-500 text-sm">No announcements yet.</p>
        ) : (
          <div className="space-y-2">
            {announcements.map(a => (
              <div key={a.id} className={`bg-gray-900 border rounded-xl overflow-hidden ${a.pinned ? 'border-red-800/50' : 'border-gray-800'}`}>
                {editingId === a.id ? (
                  <div className="p-4 space-y-3">
                    <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                      value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
                    <textarea className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500" rows={4}
                      value={editForm.body} onChange={e => setEditForm(f => ({ ...f, body: e.target.value }))} />
                    <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
                      <input type="checkbox" checked={editForm.pinned} onChange={e => setEditForm(f => ({ ...f, pinned: e.target.checked }))} className="accent-red-500" />
                      Pinned
                    </label>
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(a.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs rounded-lg transition-colors">
                        <Check className="w-3 h-3" /> Save
                      </button>
                      <button onClick={() => setEditingId(null)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg transition-colors">
                        <X className="w-3 h-3" /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 flex items-start gap-3">
                    {a.pinned && <div className="w-1.5 h-1.5 mt-2 rounded-full bg-red-500 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{a.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{a.body}</p>
                      <p className="text-xs text-gray-600 mt-1.5">{new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={() => togglePin(a)} className={`p-1.5 rounded-lg transition-colors ${a.pinned ? 'text-red-400 hover:bg-red-950/40' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`} title={a.pinned ? 'Unpin' : 'Pin'}>
                        {a.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => startEdit(a)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors" title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(a.id, a.title)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-950/40 transition-colors" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Categories Tab ───────────────────────────────────────────────────────────

function CategoriesTab() {
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<Document[]>([]);

  useEffect(() => {
    Promise.all([
      apiFetch<string[]>('/documents/categories'),
      apiFetch<{ total: number; items: Document[] }>('/documents?limit=200'),
    ]).then(([cats, docsData]) => {
      setCategories(cats);
      setDocs(docsData.items);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500 text-sm">Loading…</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">Categories are derived from document metadata. Add a category by setting it on a document during upload or edit.</p>
      {categories.length === 0 ? (
        <p className="text-gray-500 text-sm">No categories yet — upload a document and assign a category.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {categories.map(cat => {
            const count = docs.filter(d => d.category === cat).length;
            return (
              <div key={cat} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="font-medium text-white text-sm">{cat}</p>
                <p className="text-xs text-gray-500 mt-1">{count} document{count !== 1 ? 's' : ''}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Data Validation Tab ──────────────────────────────────────────────────────

interface DbSalesperson {
  salesperson: string;
  salesperson_name: string;
  site_no?: string;
  store_name?: string;
  total_parts: number;
  total_labor: number;
  total_fet: number;
  total_sell: number;
  total_gp: number;
  invoice_count?: number;
}

interface FileSalesperson {
  mechId: string;
  total_parts: number;
  total_labor: number;
  total_fet: number;
  total_sell: number;
}

function deltaClass(delta: number): string {
  const abs = Math.abs(delta);
  if (abs < 1) return 'text-green-400';
  if (abs < 50) return 'text-yellow-400';
  return 'text-red-400';
}

function fmt$(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function DeltaCell({ file, db }: { file: number; db: number }) {
  const delta = db - file;
  return (
    <td className={`px-3 py-2 text-right text-xs font-mono ${deltaClass(delta)}`}>
      {delta >= 0 ? '+' : ''}{fmt$(delta)}
    </td>
  );
}

function DataValidationTab() {
  const [fileRows, setFileRows] = useState<FileSalesperson[]>([]);
  const [dbRows, setDbRows] = useState<DbSalesperson[]>([]);
  const [stores, setStores] = useState<{ id: string; name: string; code: string }[]>([]);
  const [storeId, setStoreId] = useState('');
  const [month, setMonth] = useState(() => String(new Date().getMonth() + 1));
  const [year, setYear] = useState(() => String(new Date().getFullYear()));
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [compared, setCompared] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch<{ id: string; name: string; code: string }[]>('/stores').then(s => {
      const filtered = s.filter(st => st.code !== '1');
      setStores(filtered);
    }).catch(() => {});
  }, []);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus(null);
    setFileRows([]);
    setCompared(false);

    try {
      const { read, utils } = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = read(buf, { type: 'array' });

      // Find "Sales Data" sheet (or first sheet)
      const sheetName = wb.SheetNames.find(n => /sales.?data/i.test(n)) || wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const json: Record<string, unknown>[] = utils.sheet_to_json(ws, { defval: 0 });

      // Aggregate by MECH1
      const map = new Map<string, FileSalesperson>();
      for (const row of json) {
        const mechId = String(row['MECH1'] ?? row['Mech1'] ?? row['mech1'] ?? '').trim();
        if (!mechId) continue;
        const qty = Number(row['QTY'] ?? row['Qty'] ?? 1) || 1;
        const amount = Number(row['AMOUNT'] ?? row['Amount'] ?? 0);
        const labor = Number(row['LABOR'] ?? row['Labor'] ?? 0);
        const fetax = Number(row['FETAX'] ?? row['Fetax'] ?? row['FET'] ?? 0);
        const parts = amount * qty;
        const laborAmt = labor * qty;
        const fetAmt = fetax * qty;

        const existing = map.get(mechId) || { mechId, total_parts: 0, total_labor: 0, total_fet: 0, total_sell: 0 };
        existing.total_parts += parts;
        existing.total_labor += laborAmt;
        existing.total_fet += fetAmt;
        existing.total_sell += parts + laborAmt + fetAmt;
        map.set(mechId, existing);
      }

      setFileRows(Array.from(map.values()).sort((a, b) => b.total_sell - a.total_sell));
      setStatus({ type: 'success', msg: `Parsed ${json.length} rows from "${sheetName}" — ${map.size} salespersons found.` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setStatus({ type: 'error', msg: `Failed to parse file: ${msg}` });
    }

    // reset input
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleCompare() {
    if (!month || !year) return;
    setLoading(true);
    setStatus(null);
    try {
      const params = new URLSearchParams({ month, year });
      if (storeId) params.set('storeId', storeId);
      const res = await apiFetch<{ success: boolean; data: DbSalesperson[] }>(
        `/invoices/reports/salesperson-validation?${params}`
      );
      setDbRows(res.data);
      setCompared(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setStatus({ type: 'error', msg: `DB fetch failed: ${msg}` });
    } finally {
      setLoading(false);
    }
  }

  // Merge file + db rows into unified comparison
  const allMechIds = Array.from(new Set([
    ...fileRows.map(r => r.mechId),
    ...dbRows.map(r => r.salesperson),
  ]));

  const merged = allMechIds.map(id => {
    const f = fileRows.find(r => r.mechId === id);
    const d = dbRows.find(r => r.salesperson === id);
    return { id, f, d };
  }).sort((a, b) => {
    const aTotal = (a.f?.total_sell ?? 0) + (a.d?.total_sell ?? 0);
    const bTotal = (b.f?.total_sell ?? 0) + (b.d?.total_sell ?? 0);
    return bTotal - aTotal;
  });

  const totalFileSell = fileRows.reduce((s, r) => s + r.total_sell, 0);
  const totalDbSell = dbRows.reduce((s, r) => s + r.total_sell, 0);

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-white mb-1">Commission Data Validation</h2>
        <p className="text-xs text-gray-500">Upload the TireMaster &quot;Outside Sales Commission Compare&quot; Excel file, then compare it against live DB totals.</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* File upload */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Excel File</label>
          <label className="flex items-center gap-2 cursor-pointer bg-gray-800 border border-gray-700 hover:border-red-500 rounded-lg px-4 py-2.5 text-sm text-gray-300 transition-colors">
            <Upload className="w-4 h-4 text-red-400" />
            {fileRows.length > 0 ? `${fileRows.length} salespersons loaded` : 'Upload .xlsx'}
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
          </label>
        </div>

        {/* Month */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Month</label>
          <select
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
          >
            {MONTHS.map((m, i) => <option key={i + 1} value={String(i + 1)}>{m}</option>)}
          </select>
        </div>

        {/* Year */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Year</label>
          <select
            value={year}
            onChange={e => setYear(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
          >
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={String(y)}>{y}</option>)}
          </select>
        </div>

        {/* Store */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Store</label>
          <select
            value={storeId}
            onChange={e => setStoreId(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
          >
            <option value="">All Stores</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <button
          onClick={handleCompare}
          disabled={loading}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors"
        >
          {loading ? 'Loading…' : 'Compare'}
        </button>
      </div>

      {status && <StatusBadge type={status.type} msg={status.msg} />}

      {/* Summary totals */}
      {compared && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'File Total Sell', val: totalFileSell, sub: `${fileRows.length} salespersons` },
            { label: 'DB Total Sell', val: totalDbSell, sub: `${dbRows.length} salespersons` },
            { label: 'Overall Δ', val: totalDbSell - totalFileSell, sub: 'DB minus File', delta: true },
          ].map(({ label, val, sub, delta }) => (
            <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">{label}</p>
              <p className={`text-xl font-bold ${delta ? deltaClass(val) : 'text-white'}`}>
                {delta && val > 0 ? '+' : ''}{fmt$(val)}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Comparison table */}
      {compared && merged.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 border-b border-gray-800">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-widest">Salesperson</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-widest">TM ID</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-400">Parts (File)</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-400">Parts (DB)</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-400">Parts Δ</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-400">Labor (File)</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-400">Labor (DB)</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-400">Labor Δ</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-400">Total (File)</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-400">Total (DB)</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-400">Total Δ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {merged.map(({ id, f, d }) => (
                <tr key={id} className="hover:bg-gray-900/40">
                  <td className="px-3 py-2 text-white font-medium text-xs">{d?.salesperson_name ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-400 font-mono text-xs">{id}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-gray-300">{f ? fmt$(f.total_parts) : '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-gray-300">{d ? fmt$(d.total_parts) : '—'}</td>
                  {f && d ? <DeltaCell file={f.total_parts} db={d.total_parts} /> : <td className="px-3 py-2 text-right text-xs text-gray-600">—</td>}
                  <td className="px-3 py-2 text-right font-mono text-xs text-gray-300">{f ? fmt$(f.total_labor) : '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-gray-300">{d ? fmt$(d.total_labor) : '—'}</td>
                  {f && d ? <DeltaCell file={f.total_labor} db={d.total_labor} /> : <td className="px-3 py-2 text-right text-xs text-gray-600">—</td>}
                  <td className="px-3 py-2 text-right font-mono text-xs text-gray-300">{f ? fmt$(f.total_sell) : '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-gray-300">{d ? fmt$(d.total_sell) : '—'}</td>
                  {f && d ? <DeltaCell file={f.total_sell} db={d.total_sell} /> : <td className="px-3 py-2 text-right text-xs text-gray-600">—</td>}
                </tr>
              ))}
            </tbody>
            {/* Summary row */}
            <tfoot className="bg-gray-900/60 border-t-2 border-gray-700">
              <tr>
                <td colSpan={2} className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-widest">TOTALS</td>
                <td className="px-3 py-2 text-right font-mono text-xs font-bold text-white">{fmt$(fileRows.reduce((s, r) => s + r.total_parts, 0))}</td>
                <td className="px-3 py-2 text-right font-mono text-xs font-bold text-white">{fmt$(dbRows.reduce((s, r) => s + r.total_parts, 0))}</td>
                <td className={`px-3 py-2 text-right text-xs font-bold font-mono ${deltaClass(dbRows.reduce((s, r) => s + r.total_parts, 0) - fileRows.reduce((s, r) => s + r.total_parts, 0))}`}>
                  {(() => { const d = dbRows.reduce((s,r)=>s+r.total_parts,0) - fileRows.reduce((s,r)=>s+r.total_parts,0); return (d>=0?'+':'')+fmt$(d); })()}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs font-bold text-white">{fmt$(fileRows.reduce((s, r) => s + r.total_labor, 0))}</td>
                <td className="px-3 py-2 text-right font-mono text-xs font-bold text-white">{fmt$(dbRows.reduce((s, r) => s + r.total_labor, 0))}</td>
                <td className={`px-3 py-2 text-right text-xs font-bold font-mono ${deltaClass(dbRows.reduce((s, r) => s + r.total_labor, 0) - fileRows.reduce((s, r) => s + r.total_labor, 0))}`}>
                  {(() => { const d = dbRows.reduce((s,r)=>s+r.total_labor,0) - fileRows.reduce((s,r)=>s+r.total_labor,0); return (d>=0?'+':'')+fmt$(d); })()}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs font-bold text-white">{fmt$(totalFileSell)}</td>
                <td className="px-3 py-2 text-right font-mono text-xs font-bold text-white">{fmt$(totalDbSell)}</td>
                <td className={`px-3 py-2 text-right text-xs font-bold font-mono ${deltaClass(totalDbSell - totalFileSell)}`}>
                  {(() => { const d = totalDbSell - totalFileSell; return (d>=0?'+':'')+fmt$(d); })()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {!compared && fileRows.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-800 py-16 text-center">
          <p className="text-gray-600 text-xs font-semibold uppercase tracking-widest">Upload a file and click Compare to see results</p>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'documents' | 'announcements' | 'categories' | 'validation';

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('documents');

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Loading…</div>;

  if (!user) {
    router.replace('/login');
    return null;
  }

  if (!isAdmin(user)) {
    router.replace('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <NavBar />

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Admin Settings</h1>
          <p className="text-sm text-gray-400 mt-1">Manage documents, announcements, and portal content.</p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-800 mb-6 flex gap-1">
          <TabButton active={tab === 'documents'} onClick={() => setTab('documents')}>📄 Documents</TabButton>
          <TabButton active={tab === 'announcements'} onClick={() => setTab('announcements')}>📢 Announcements</TabButton>
          <TabButton active={tab === 'categories'} onClick={() => setTab('categories')}>🗂 Categories</TabButton>
          <TabButton active={tab === 'validation'} onClick={() => setTab('validation')}>✅ Data Validation</TabButton>
        </div>

        {tab === 'documents' && <DocumentsTab />}
        {tab === 'announcements' && <AnnouncementsTab />}
        {tab === 'categories' && <CategoriesTab />}
        {tab === 'validation' && <DataValidationTab />}
      </main>
    </div>
  );
}
