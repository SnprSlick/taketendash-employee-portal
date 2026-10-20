"use client";

import type { Bin, FlowNode, Location, Role, RoleGroup, WorkflowSummary } from "@/lib/workflow/flow/types";

const TYPE_LABELS: Record<FlowNode["type"], string> = {
  start: "Start",
  step: "Step",
  decision: "Decision",
  end: "End",
  subworkflow: "Sub-Workflow",
  wait: "Wait",
};

export function PropertiesPanel({
  node,
  roles,
  groups,
  onRoleChange,
  onGroupChange,
  onManageRoles,
  bins,
  locations,
  onBinChange,
  onManageBins,
  subworkflows = [],
  onClose,
}: {
  node: FlowNode;
  roles: Role[];
  groups: RoleGroup[];
  onRoleChange: (roleId: string | undefined) => void;
  onGroupChange: (groupId: string | undefined) => void;
  onManageRoles: () => void;
  bins: Bin[];
  locations: Location[];
  onBinChange: (binId: string | undefined) => void;
  onManageBins: () => void;
  subworkflows?: WorkflowSummary[];
  onClose: () => void;
}) {
  const groupedBins = locations.map((loc) => ({
    location: loc,
    bins: bins.filter((b) => b.locationId === loc.id),
  }));

  if (node.type === "subworkflow") {
    return (
      <div className="flex w-72 shrink-0 flex-col border-l border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700">Properties</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="mb-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Node type</div>
            <div className="mt-1 text-sm text-slate-800">{TYPE_LABELS[node.type]}</div>
          </div>
          <div className="mb-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Referenced workflow</div>
            <div className="mt-1 text-sm text-slate-800 whitespace-pre-wrap">
              {node.data.refWorkflowId
                ? (subworkflows.find((w) => w.id === node.data.refWorkflowId)?.name ?? "(missing sub-workflow)")
                : "No sub-workflow selected yet"}
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Roles and bins for this step live inside the referenced sub-workflow itself. Double-click the node on the
            canvas to pick or change it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-72 shrink-0 flex-col border-l border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-700">Properties</h2>
        <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mb-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Node type</div>
          <div className="mt-1 text-sm text-slate-800">{TYPE_LABELS[node.type]}</div>
        </div>

        <div className="mb-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Label</div>
          <div className="mt-1 text-sm text-slate-800 whitespace-pre-wrap">{node.data.label || "Untitled"}</div>
        </div>

        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Role</div>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => {
                onRoleChange(undefined);
                onGroupChange(undefined);
              }}
              className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm ${
                !node.data.roleId && !node.data.groupId
                  ? "border-slate-300 bg-slate-50 font-medium text-slate-900"
                  : "border-transparent text-slate-500 hover:bg-slate-50"
              }`}
            >
              <span className="h-3 w-3 rounded-full border border-slate-300 bg-slate-100" />
              None
            </button>
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => {
                  onRoleChange(role.id);
                  onGroupChange(undefined);
                }}
                className={`flex items-start gap-2 rounded-md border px-2.5 py-2 text-left text-sm ${
                  node.data.roleId === role.id
                    ? "border-slate-300 bg-slate-50 font-medium text-slate-900"
                    : "border-transparent text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span className="mt-0.5 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: role.color }} />
                <span>
                  {role.title}
                  {role.description && (
                    <span className="mt-0.5 block text-xs font-normal text-slate-400">{role.description}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
          <button
            onClick={onManageRoles}
            className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            Manage roles...
          </button>
        </div>

        {groups.length > 0 && (
          <div className="mt-4">
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Group</div>
            <div className="flex flex-col gap-1">
              {groups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => {
                    onGroupChange(group.id);
                    onRoleChange(undefined);
                  }}
                  className={`flex items-start gap-2 rounded-md border px-2.5 py-2 text-left text-sm ${
                    node.data.groupId === group.id
                      ? "border-slate-300 bg-slate-50 font-medium text-slate-900"
                      : "border-transparent text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className="mt-0.5 h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: group.color }} />
                  <span>
                    {group.title}
                    <span className="mt-0.5 block text-xs font-normal text-slate-400">
                      {group.roles.map((r) => r.title).join(", ") || "No roles in group"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Bin</div>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => onBinChange(undefined)}
              className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm ${
                !node.data.binId
                  ? "border-slate-300 bg-slate-50 font-medium text-slate-900"
                  : "border-transparent text-slate-500 hover:bg-slate-50"
              }`}
            >
              <span className="h-3 w-3 rounded-full border border-slate-300 bg-slate-100" />
              No bin
            </button>
            {groupedBins.map(
              ({ location, bins: locBins }) =>
                locBins.length > 0 && (
                  <div key={location.id}>
                    <div className="mt-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {location.letter} · {location.name}
                    </div>
                    {locBins.map((bin) => (
                      <button
                        key={bin.id}
                        onClick={() => onBinChange(bin.id)}
                        className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm ${
                          node.data.binId === bin.id
                            ? "border-slate-300 bg-slate-50 font-medium text-slate-900"
                            : "border-transparent text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: bin.color }} />
                        {bin.name}
                      </button>
                    ))}
                  </div>
                ),
            )}
          </div>
          <button onClick={onManageBins} className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700">
            Manage bins...
          </button>
        </div>
      </div>
    </div>
  );
}
