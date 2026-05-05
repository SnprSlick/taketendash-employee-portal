'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload, Trash2, Pencil, Pin, PinOff, Plus, X, Check, FileText, FileImage, File, Megaphone, Tag,
} from 'lucide-react';
import NavBar from '../components/NavBar';
import { useAuth } from '../components/useAuth';
import { apiFetch, apiUpload, isAdmin } from '../lib/api';
import DataValidationTab from '../components/settings/DataValidationTab';

// ─── Types ────────────────────────────────────────────────────────────────────

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
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  author?: { firstName?: string; lastName?: string };
}

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

// ─── Documents Tab ────────────────────────────────────────────────────────────

function DocumentsTab() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', category: '', tags: '' });

  // Upload form state
  const [uploadForm, setUploadForm] = useState({ title: '', description: '', category: '', tags: '' });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadDocs(); }, []);

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

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile || !uploadForm.title.trim()) return flash('error', 'Title and file are required');
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', uploadFile);
      form.append('title', uploadForm.title.trim());
      if (uploadForm.description) form.append('description', uploadForm.description);
      if (uploadForm.category) form.append('category', uploadForm.category);
      if (uploadForm.tags) form.append('tags', JSON.stringify(uploadForm.tags.split(',').map(t => t.trim()).filter(Boolean)));
      await apiUpload('/documents/upload', form);
      setUploadForm({ title: '', description: '', category: '', tags: '' });
      setUploadFile(null);
      if (fileRef.current) fileRef.current.value = '';
      flash('success', 'Document uploaded successfully');
      loadDocs();
    } catch (err: unknown) {
      flash('error', err instanceof Error ? err.message : 'Upload failed');
    } finally { setUploading(false); }
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
          tags: editForm.tags.split(',').map(t => t.trim()).filter(Boolean),
        }),
      });
      setEditingId(null);
      flash('success', 'Document updated');
      loadDocs();
    } catch (err: unknown) {
      flash('error', err instanceof Error ? err.message : 'Update failed');
    }
  }

  return (
    <div className="space-y-8">
      {status && <StatusBadge {...status} />}

      {/* Upload */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2"><Upload className="w-4 h-4 text-red-400" /> Upload Document</h2>
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Title <span className="text-red-500">*</span></label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Document title"
                value={uploadForm.title}
                onChange={e => setUploadForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Category</label>
              <input
                list="cat-list"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="e.g. Policy, HR, Safety"
                value={uploadForm.category}
                onChange={e => setUploadForm(f => ({ ...f, category: e.target.value }))}
              />
              <datalist id="cat-list">
                {categories.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Description</label>
            <textarea
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              rows={2}
              placeholder="Brief description (optional)"
              value={uploadForm.description}
              onChange={e => setUploadForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1"><Tag className="w-3 h-3" /> Tags <span className="text-gray-600">(comma separated)</span></label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="e.g. handbook, onboarding"
                value={uploadForm.tags}
                onChange={e => setUploadForm(f => ({ ...f, tags: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">File <span className="text-red-500">*</span></label>
              <input
                ref={fileRef}
                type="file"
                className="w-full text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-red-600 file:text-white file:cursor-pointer hover:file:bg-red-700"
                onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={uploading}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </form>
      </section>

      {/* Document list */}
      <section>
        <h2 className="text-base font-semibold text-white mb-3">All Documents <span className="text-gray-500 font-normal text-sm">({docs.length})</span></h2>
        {loading ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : docs.length === 0 ? (
          <p className="text-gray-500 text-sm">No documents uploaded yet.</p>
        ) : (
          <div className="space-y-2">
            {docs.map(doc => (
              <div key={doc.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
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
                  <div className="p-4 flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0"><FileIcon mime={doc.mimeType} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{doc.title}</p>
                      {doc.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{doc.description}</p>}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {doc.category && <span className="px-2 py-0.5 bg-gray-800 text-gray-300 text-xs rounded-full border border-gray-700">{doc.category}</span>}
                        {doc.tags.map(t => <span key={t} className="px-2 py-0.5 bg-red-950/40 text-red-300 text-xs rounded-full border border-red-900/50">{t}</span>)}
                        <span className="text-xs text-gray-600">{formatBytes(doc.fileSize)}</span>
                        <span className="text-xs text-gray-600">{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={() => startEdit(doc)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors" title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(doc.id, doc.title)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-950/40 transition-colors" title="Delete">
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

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'documents' | 'announcements' | 'categories' | 'validation';

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('documents');

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Loading…</div>;

  if (user && !isAdmin(user)) {
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
