"use client";

import { useState } from "react";
import type { Role, RoleGroup } from "@/lib/workflow/flow/types";
import { NODE_COLORS } from "@/components/workflow/canvas/ColorPicker";

const ROLE_COLORS = NODE_COLORS.filter((c) => c.value).map((c) => c.value as string);

export function RolesManagerModal({
  roles,
  onCreate,
  onUpdate,
  onDelete,
  groups,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onClose,
}: {
  roles: Role[];
  onCreate: (role: { title: string; description: string | null; color: string }) => void;
  onUpdate: (id: string, patch: { title?: string; description?: string | null; color?: string }) => void;
  onDelete: (id: string) => void;
  groups: RoleGroup[];
  onCreateGroup: (group: { title: string; description: string | null; color: string; roleIds: string[] }) => void;
  onUpdateGroup: (id: string, patch: { title?: string; description?: string | null; color?: string; roleIds?: string[] }) => void;
  onDeleteGroup: (id: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"roles" | "groups">("roles");
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<string>(ROLE_COLORS[0]);

  function submitCreate() {
    if (!title.trim()) return;
    onCreate({ title: title.trim(), description: description.trim() || null, color });
    setTitle("");
    setDescription("");
    setColor(ROLE_COLORS[0]);
    setCreating(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-800">Manage Roles</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            ✕
          </button>
        </div>

        <div className="flex border-b border-slate-100 px-5">
          <button
            onClick={() => setTab("roles")}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              tab === "roles" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            Roles
          </button>
          <button
            onClick={() => setTab("groups")}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              tab === "groups" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            Groups
          </button>
        </div>

        {tab === "roles" ? (
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {roles.length === 0 && !creating && (
              <p className="py-4 text-center text-sm text-slate-400">No roles yet.</p>
            )}

            <div className="flex flex-col gap-2">
              {roles.map((role) => (
                <RoleRow key={role.id} role={role} onUpdate={onUpdate} onDelete={onDelete} />
              ))}
            </div>

            {creating ? (
              <div className="mt-3 rounded-lg border border-slate-200 p-3">
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Role title (e.g. Manager)"
                  className="mb-2 w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description (optional)"
                  rows={2}
                  className="mb-2 w-full resize-none rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {ROLE_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className="h-6 w-6 rounded-full border border-black/10"
                      style={{
                        backgroundColor: c,
                        outline: color === c ? "2px solid #3b82f6" : undefined,
                        outlineOffset: 1,
                      }}
                    />
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setCreating(false)}
                    className="rounded px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitCreate}
                    disabled={!title.trim()}
                    className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
                  >
                    Add role
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="mt-3 w-full rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700"
              >
                + Add role
              </button>
            )}
          </div>
        ) : (
          <GroupsTab roles={roles} groups={groups} onCreateGroup={onCreateGroup} onUpdateGroup={onUpdateGroup} onDeleteGroup={onDeleteGroup} />
        )}
      </div>
    </div>
  );
}

function GroupsTab({
  roles,
  groups,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
}: {
  roles: Role[];
  groups: RoleGroup[];
  onCreateGroup: (group: { title: string; description: string | null; color: string; roleIds: string[] }) => void;
  onUpdateGroup: (id: string, patch: { title?: string; description?: string | null; color?: string; roleIds?: string[] }) => void;
  onDeleteGroup: (id: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<string>(ROLE_COLORS[0]);
  const [roleIds, setRoleIds] = useState<string[]>([]);

  function toggleRole(id: string) {
    setRoleIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  }

  function submitCreate() {
    if (!title.trim()) return;
    onCreateGroup({ title: title.trim(), description: description.trim() || null, color, roleIds });
    setTitle("");
    setDescription("");
    setColor(ROLE_COLORS[0]);
    setRoleIds([]);
    setCreating(false);
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4">
      {groups.length === 0 && !creating && <p className="py-4 text-center text-sm text-slate-400">No groups yet.</p>}

      <div className="flex flex-col gap-2">
        {groups.map((group) => (
          <GroupRow key={group.id} group={group} roles={roles} onUpdate={onUpdateGroup} onDelete={onDeleteGroup} />
        ))}
      </div>

      {creating ? (
        <div className="mt-3 rounded-lg border border-slate-200 p-3">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Group title (e.g. Warehouse Staff)"
            className="mb-2 w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-400"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="mb-2 w-full resize-none rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-400"
          />
          <div className="mb-3 flex flex-wrap gap-1.5">
            {ROLE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="h-6 w-6 rounded-full border border-black/10"
                style={{
                  backgroundColor: c,
                  outline: color === c ? "2px solid #3b82f6" : undefined,
                  outlineOffset: 1,
                }}
              />
            ))}
          </div>
          <div className="mb-3">
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Member roles</div>
            {roles.length === 0 ? (
              <p className="text-xs text-slate-400">No roles exist yet.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {roles.map((role) => (
                  <label key={role.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={roleIds.includes(role.id)} onChange={() => toggleRole(role.id)} />
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: role.color }} />
                    {role.title}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setCreating(false)} className="rounded px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100">
              Cancel
            </button>
            <button
              onClick={submitCreate}
              disabled={!title.trim()}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
            >
              Add group
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="mt-3 w-full rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700"
        >
          + Add group
        </button>
      )}
    </div>
  );
}

function GroupRow({
  group,
  roles,
  onUpdate,
  onDelete,
}: {
  group: RoleGroup;
  roles: Role[];
  onUpdate: (id: string, patch: { title?: string; description?: string | null; color?: string; roleIds?: string[] }) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(group.title);
  const [description, setDescription] = useState(group.description ?? "");
  const [roleIds, setRoleIds] = useState<string[]>(group.roles.map((r) => r.id));

  function toggleRole(id: string) {
    setRoleIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  }

  function submit() {
    onUpdate(group.id, { title: title.trim() || group.title, description: description.trim() || null, roleIds });
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-slate-200 p-3">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mb-2 w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-400"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="mb-2 w-full resize-none rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-400"
        />
        <div className="mb-3 flex flex-wrap gap-1.5">
          {ROLE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onUpdate(group.id, { color: c })}
              className="h-6 w-6 rounded-full border border-black/10"
              style={{
                backgroundColor: c,
                outline: group.color === c ? "2px solid #3b82f6" : undefined,
                outlineOffset: 1,
              }}
            />
          ))}
        </div>
        <div className="mb-3">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Member roles</div>
          <div className="flex flex-col gap-1">
            {roles.map((role) => (
              <label key={role.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={roleIds.includes(role.id)} onChange={() => toggleRole(role.id)} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: role.color }} />
                {role.title}
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={() => setEditing(false)} className="rounded px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100">
            Cancel
          </button>
          <button onClick={submit} className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start justify-between rounded-lg border border-slate-200 p-3">
      <button onClick={() => setEditing(true)} className="flex flex-1 items-start gap-2.5 text-left">
        <span className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-sm" style={{ backgroundColor: group.color }} />
        <div>
          <div className="text-sm font-medium text-slate-900">{group.title}</div>
          <div className="mt-0.5 text-xs text-slate-500">
            {group.roles.map((r) => r.title).join(", ") || "No roles in group"}
          </div>
        </div>
      </button>
      <button
        onClick={() => onDelete(group.id)}
        className="ml-2 rounded px-2 py-1 text-xs text-slate-400 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
      >
        Delete
      </button>
    </div>
  );
}

function RoleRow({
  role,
  onUpdate,
  onDelete,
}: {
  role: Role;
  onUpdate: (id: string, patch: { title?: string; description?: string | null; color?: string }) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(role.title);
  const [description, setDescription] = useState(role.description ?? "");

  function submit() {
    onUpdate(role.id, { title: title.trim() || role.title, description: description.trim() || null });
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-slate-200 p-3">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mb-2 w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-400"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="mb-2 w-full resize-none rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-400"
        />
        <div className="mb-3 flex flex-wrap gap-1.5">
          {ROLE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onUpdate(role.id, { color: c })}
              className="h-6 w-6 rounded-full border border-black/10"
              style={{
                backgroundColor: c,
                outline: role.color === c ? "2px solid #3b82f6" : undefined,
                outlineOffset: 1,
              }}
            />
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={() => setEditing(false)} className="rounded px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100">
            Cancel
          </button>
          <button onClick={submit} className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start justify-between rounded-lg border border-slate-200 p-3">
      <button onClick={() => setEditing(true)} className="flex flex-1 items-start gap-2.5 text-left">
        <span className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: role.color }} />
        <div>
          <div className="text-sm font-medium text-slate-900">{role.title}</div>
          {role.description && <div className="mt-0.5 text-xs text-slate-500">{role.description}</div>}
        </div>
      </button>
      <button
        onClick={() => onDelete(role.id)}
        className="ml-2 rounded px-2 py-1 text-xs text-slate-400 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
      >
        Delete
      </button>
    </div>
  );
}
