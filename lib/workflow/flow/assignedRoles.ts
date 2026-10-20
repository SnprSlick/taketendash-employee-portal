import type { Role, RoleGroup } from "./types";

// A node's single assignment slot holds either a roleId or a groupId (never both).
// This resolves either into the flat list of roles it represents, so every
// consumer (node badges, PDF export, minimap coloring) can treat them the same way.
export function resolveAssignedRoles(
  data: { roleId?: string; groupId?: string },
  roles: Role[],
  groups: RoleGroup[],
): Role[] {
  if (data.groupId) {
    const group = groups.find((g) => g.id === data.groupId);
    return group ? group.roles : [];
  }
  if (data.roleId) {
    const role = roles.find((r) => r.id === data.roleId);
    return role ? [role] : [];
  }
  return [];
}

export function assignedColor(data: { roleId?: string; groupId?: string }, roles: Role[], groups: RoleGroup[]): string | null {
  if (data.groupId) return groups.find((g) => g.id === data.groupId)?.color ?? null;
  if (data.roleId) return roles.find((r) => r.id === data.roleId)?.color ?? null;
  return null;
}

export function assignedTitle(data: { roleId?: string; groupId?: string }, roles: Role[], groups: RoleGroup[]): string | null {
  if (data.groupId) return groups.find((g) => g.id === data.groupId)?.title ?? null;
  if (data.roleId) return roles.find((r) => r.id === data.roleId)?.title ?? null;
  return null;
}
