'use client';

import { useEffect, useState } from 'react';
import { Pin, Trash2, Pencil, PinOff, X, Check } from 'lucide-react';
import NavBar from '../components/NavBar';
import { useAuth } from '../components/useAuth';
import { apiFetch, isAdmin } from '../lib/api';

interface Announcement {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  author?: { firstName?: string; lastName?: string };
}

interface EditForm { title: string; body: string; pinned: boolean; }

export default function AnnouncementsPage() {
  const { user, loading } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [fetching, setFetching] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ title: '', body: '', pinned: false });
  const admin = user ? isAdmin(user) : false;

  useEffect(() => {
    if (!user) return;
    loadAnnouncements();
  }, [user]);

  async function loadAnnouncements() {
    setFetching(true);
    apiFetch<Announcement[]>('/announcements')
      .then(setAnnouncements)
      .catch(() => {})
      .finally(() => setFetching(false));
  }

  async function handleDelete(a: Announcement) {
    if (!confirm(`Delete "${a.title}"?`)) return;
    await apiFetch(`/announcements/${a.id}`, { method: 'DELETE' });
    loadAnnouncements();
  }

  async function togglePin(a: Announcement) {
    await apiFetch(`/announcements/${a.id}`, { method: 'PATCH', body: JSON.stringify({ pinned: !a.pinned }) });
    loadAnnouncements();
  }

  function startEdit(a: Announcement) {
    setEditingId(a.id);
    setEditForm({ title: a.title, body: a.body, pinned: a.pinned });
  }

  async function saveEdit(id: string) {
    await apiFetch(`/announcements/${id}`, { method: 'PATCH', body: JSON.stringify(editForm) });
    setEditingId(null);
    loadAnnouncements();
  }

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Loading…</div>;

  const pinned = announcements.filter(a => a.pinned);
  const rest = announcements.filter(a => !a.pinned);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <NavBar />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-white mb-6">Announcements</h1>
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
                    <AnnouncementCard key={a.id} a={a} highlighted admin={admin}
                      editingId={editingId} editForm={editForm} setEditForm={setEditForm}
                      onDelete={handleDelete} onTogglePin={togglePin} onEdit={startEdit}
                      onSaveEdit={saveEdit} onCancelEdit={() => setEditingId(null)} />
                  ))}
                </div>
              </section>
            )}
            {rest.length > 0 && (
              <section>
                {pinned.length > 0 && <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">All Updates</h2>}
                <div className="space-y-4">
                  {rest.map(a => (
                    <AnnouncementCard key={a.id} a={a} admin={admin}
                      editingId={editingId} editForm={editForm} setEditForm={setEditForm}
                      onDelete={handleDelete} onTogglePin={togglePin} onEdit={startEdit}
                      onSaveEdit={saveEdit} onCancelEdit={() => setEditingId(null)} />
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

interface CardProps {
  a: Announcement; highlighted?: boolean; admin: boolean;
  editingId: string | null; editForm: EditForm;
  setEditForm: React.Dispatch<React.SetStateAction<EditForm>>;
  onDelete: (a: Announcement) => void; onTogglePin: (a: Announcement) => void;
  onEdit: (a: Announcement) => void; onSaveEdit: (id: string) => void; onCancelEdit: () => void;
}

function AnnouncementCard({ a, highlighted, admin, editingId, editForm, setEditForm, onDelete, onTogglePin, onEdit, onSaveEdit, onCancelEdit }: CardProps) {
  const authorName = a.author?.firstName ? `${a.author.firstName} ${a.author.lastName || ''}`.trim() : null;
  const isEditing = editingId === a.id;

  if (isEditing) {
    return (
      <div className={`rounded-xl p-5 border ${highlighted ? 'bg-gray-900 border-red-800/50' : 'bg-gray-900 border-gray-800'}`}>
        <div className="space-y-3">
          <input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
          <textarea className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500" rows={4}
            value={editForm.body} onChange={e => setEditForm(f => ({ ...f, body: e.target.value }))} />
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
            <input type="checkbox" checked={editForm.pinned} onChange={e => setEditForm(f => ({ ...f, pinned: e.target.checked }))} className="accent-red-500" />
            Pinned
          </label>
          <div className="flex gap-2">
            <button onClick={() => onSaveEdit(a.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs rounded-lg transition-colors">
              <Check className="w-3 h-3" /> Save
            </button>
            <button onClick={onCancelEdit} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg transition-colors">
              <X className="w-3 h-3" /> Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl p-6 border ${highlighted ? 'bg-gray-900 border-red-800/50' : 'bg-gray-900 border-gray-800'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {highlighted && <div className="w-2 h-2 mt-2 rounded-full bg-red-500 flex-shrink-0" />}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white text-lg">{a.title}</h3>
            <p className="text-gray-300 mt-2 whitespace-pre-wrap leading-relaxed">{a.body}</p>
          </div>
        </div>
        {admin && (
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={() => onTogglePin(a)} className={`p-1.5 rounded-lg transition-colors ${a.pinned ? 'text-red-400 hover:bg-red-950/40' : 'text-gray-500 hover:text-white hover:bg-gray-700'}`} title={a.pinned ? 'Unpin' : 'Pin'}>
              {a.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
            </button>
            <button onClick={() => onEdit(a)} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-700 transition-colors" title="Edit">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={() => onDelete(a)} className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-950/40 transition-colors" title="Delete">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      <div className="mt-4 pt-4 border-t border-gray-800 flex items-center gap-3 text-xs text-gray-500">
        <span>{new Date(a.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
        {authorName && <><span>·</span><span>{authorName}</span></>}
      </div>
    </div>
  );
}
