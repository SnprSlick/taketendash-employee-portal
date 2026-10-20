"use client";

import { useState } from "react";
import type { Role, RoleGroup } from "@/lib/workflow/flow/types";

export function RolePicker({
  roles,
  groups = [],
  roleId,
  groupId,
  onChangeRole,
  onChangeGroup,
  onManageRoles,
}: {
  roles: Role[];
  groups?: RoleGroup[];
  roleId: string | undefined;
  groupId: string | undefined;
  onChangeRole: (roleId: string | undefined) => void;
  onChangeGroup: (groupId: string | undefined) => void;
  onManageRoles?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const activeRole = roles.find((r) => r.id === roleId);
  const activeGroup = groups.find((g) => g.id === groupId);
  const swatchColor = activeGroup?.color ?? activeRole?.color ?? "#cbd5e1";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-4 w-4 rounded-full border border-black/10 shadow-sm"
        style={{ backgroundColor: swatchColor }}
        title={activeGroup ? `${activeGroup.title} (group)` : activeRole ? activeRole.title : "Assign role"}
      />
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="nodrag absolute right-0 top-6 z-20 w-52 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
            <button
              type="button"
              onClick={() => {
                onChangeRole(undefined);
                onChangeGroup(undefined);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-slate-50 ${
                !roleId && !groupId ? "font-medium text-slate-900" : "text-slate-500"
              }`}
            >
              <span className="h-3 w-3 rounded-full border border-slate-300 bg-slate-100" />
              None
            </button>
            {roles.length > 0 && (
              <>
                <div className="my-1 border-t border-slate-100" />
                <div className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Roles</div>
                {roles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    title={role.description ?? undefined}
                    onClick={() => {
                      onChangeRole(role.id);
                      onChangeGroup(undefined);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-slate-50 ${
                      roleId === role.id ? "font-medium text-slate-900" : "text-slate-600"
                    }`}
                  >
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: role.color }} />
                    <span className="truncate">{role.title}</span>
                  </button>
                ))}
              </>
            )}
            {groups.length > 0 && (
              <>
                <div className="my-1 border-t border-slate-100" />
                <div className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Groups</div>
                {groups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    title={group.roles.map((r) => r.title).join(", ")}
                    onClick={() => {
                      onChangeGroup(group.id);
                      onChangeRole(undefined);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-slate-50 ${
                      groupId === group.id ? "font-medium text-slate-900" : "text-slate-600"
                    }`}
                  >
                    <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: group.color }} />
                    <span className="truncate">{group.title}</span>
                  </button>
                ))}
              </>
            )}
            {onManageRoles && (
              <>
                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onManageRoles();
                  }}
                  className="w-full rounded px-2 py-1.5 text-left text-xs text-blue-600 hover:bg-blue-50"
                >
                  Manage roles...
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
