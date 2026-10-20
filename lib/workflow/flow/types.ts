import type { Edge, Node } from "@xyflow/react";

export type StartNodeData = {
  label: string;
  roleId?: string;
  groupId?: string;
  binId?: string;
  documentIds?: string[];
};

export type StepNodeData = {
  label: string;
  roleId?: string;
  groupId?: string;
  binId?: string;
  documentIds?: string[];
};

// documentRouting maps a documentId to the branch indices it continues through.
// A document with no entry here follows every branch (the default, unconfigured behavior).
export type DecisionNodeData = {
  label: string;
  branches: string[];
  roleId?: string;
  groupId?: string;
  binId?: string;
  documentIds?: string[];
  documentRouting?: Record<string, number[]>;
};

export type EndNodeData = {
  label: string;
  roleId?: string;
  groupId?: string;
  binId?: string;
  documentIds?: string[];
};

export type SubworkflowNodeData = {
  label: string;
  refWorkflowId?: string;
};

// A wait node pauses its branch's main flow (top-in, bottom-out) until it
// receives a signal on its separate left-side handle ("signal-in"), wired
// from the normal output of whatever node should unblock it — typically the
// point where a sibling branch reconnects. The signal edge is not part of
// the main sequential flow and is excluded from graph traversal, document
// propagation, and the walkthrough (the wait node itself never appears as
// its own walkthrough step).
export type WaitNodeData = {
  label: string;
  roleId?: string;
  groupId?: string;
  binId?: string;
};

export type FlowNode =
  | Node<StartNodeData, "start">
  | Node<StepNodeData, "step">
  | Node<DecisionNodeData, "decision">
  | Node<EndNodeData, "end">
  | Node<SubworkflowNodeData, "subworkflow">
  | Node<WaitNodeData, "wait">;

export type Role = {
  id: string;
  title: string;
  description: string | null;
  color: string;
};

export type RoleGroup = {
  id: string;
  title: string;
  description: string | null;
  color: string;
  roles: Role[];
};

export type Location = {
  id: string;
  letter: string;
  name: string;
};

export type Bin = {
  id: string;
  name: string;
  color: string;
  locationId: string;
};

export type WorkflowDocument = {
  id: string;
  name: string;
  color: string;
};

// Transient callbacks injected at render time (not persisted).
export type NodeActions = {
  onLabelChange?: (nodeId: string, label: string) => void;
  onDelete?: (nodeId: string) => void;
  onBranchesChange?: (nodeId: string, branches: string[]) => void;
  onRoleChange?: (nodeId: string, roleId: string | undefined) => void;
  onGroupChange?: (nodeId: string, groupId: string | undefined) => void;
  onManageRoles?: () => void;
  roles?: Role[];
  groups?: RoleGroup[];
  onBinChange?: (nodeId: string, binId: string | undefined) => void;
  onManageBins?: () => void;
  bins?: Bin[];
  locations?: Location[];
  onRefWorkflowChange?: (nodeId: string, refWorkflowId: string | undefined) => void;
  subworkflows?: WorkflowSummary[];
  onOpenSubworkflow?: (workflowId: string) => void;
  documents?: WorkflowDocument[];
  onDocumentIdsChange?: (nodeId: string, documentIds: string[]) => void;
  onDocumentRoutingChange?: (nodeId: string, documentRouting: Record<string, number[]>) => void;
  onManageDocuments?: () => void;
  incomingDocumentIds?: string[];
  stepNumber?: string;
};

export type FlowEdge = Edge<{ label?: string }>;

export type WorkflowNote = {
  id: string;
  text: string;
  createdAt: string;
};

export type WorkflowSummary = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  isTemplate: boolean;
  updatedAt: string;
};

export type WorkflowRecord = WorkflowSummary & {
  nodes: FlowNode[];
  edges: FlowEdge[];
  notes: WorkflowNote[];
  documents: WorkflowDocument[];
  createdAt: string;
};
