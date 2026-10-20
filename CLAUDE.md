@AGENTS.md

# TakeTen Employee Portal

Next.js 16 (app router) · React 19 · Tailwind 4 · Prisma 6 (Postgres) · deployed on Railway via `Dockerfile`.
Branch history: the standalone `workflow-builder` app was ported in here under `/workflows`.

## Portal code reference
- `app/lib/api.ts` — `apiFetch`/`apiUpload` (TakeTenDash backend, `NEXT_PUBLIC_BACKEND_URL` + `/api/v1`, Bearer `ep_token` from localStorage), `getAuthHeaders()`, `saveAuth`/`clearAuth`/`getUser`/`isAdmin`, `AuthUser`. Used by pages, `useAuth`, `sso/page.tsx`, `lib/workflow/wfFetch.ts`.
- `app/components/useAuth.ts` — `useAuth()` redirects to `/login` when no `ep_user`. Used by pages and `app/workflows/layout.tsx`.
- `app/components/NavBar.tsx` — top nav (Home, Announcements, Pricing, Workflows, Dashboard).
- `app/lib/db.ts` — `prisma` singleton (Prisma client for the workflow-builder tables). Used by every `app/api/*` route handler and `lib/workflow/*` server code.
- `proxy.ts` — Next 16 proxy (ex-middleware) guarding `/api/{workflows,roles,role-groups,locations,bins,paths}`: requires `Authorization: Bearer <token>` accepted by backend `GET /api/v1/auth/profile` (60s in-memory cache). 401 = missing/invalid, 503 = backend unreachable. `WORKFLOW_AUTH_DISABLED=1` skips the check **only when NODE_ENV != production** (local dev; never set on Railway).
- `lib/workflow/wfFetch.ts` — `wfFetch(url, init)` = `fetch` + portal Bearer token. All workflow-builder client calls use it (`app/workflows/**`, `components/workflow/BulkPathExportModal.tsx`).
- `app/workflows/layout.tsx` — login gate + NavBar + fixed-height light-themed shell; workflow pages use `h-full` (not `h-screen`).

## Layout of ported code
- `components/workflow/` (canvas nodes, modals, sidebars) · `lib/workflow/flow/` (graph logic) · `lib/workflow/pdf/` (outline + Puppeteer render) · `app/workflows/` (list `/workflows`, editor `/workflows/[id]`, walkthrough) · `app/print/[id]` · `app/api/*` (below).
- Imports: `@/lib/workflow/...`, `@/components/workflow/...`, `@/app/lib/db`.

## Database (Railway Postgres, schema `workflow`)
- Prisma models map to `wf_workflows`, `wf_paths`, `wf_roles`, `wf_role_groups`, `wf_locations`, `wf_bins` (+ implicit `_RoleToRoleGroup`), all in the isolated Postgres schema `workflow` (`?schema=workflow` on `DATABASE_URL`) so the backend's `public` tables are never touched.
- **Never run `prisma migrate dev`, `migrate reset` or `db push` against Railway; never wipe data.** Add migrations by hand-reviewed additive SQL and apply with `npm run db:deploy` (`prisma migrate deploy`).
- Local dev uses the Railway **public proxy** URL in gitignored `.env.local`; Railway uses the internal URL. `scripts/import-workflow-builder-sqlite.cjs <dev.db> [--apply]` is the one-off insert-only SQLite import (already applied: 6 workflows, 11 paths, 13 roles, 1 group, 4 locations, 13 bins).

## Deploy (Railway)
- `Dockerfile` (node:22-slim + Chromium for PDF export; `PUPPETEER_EXECUTABLE_PATH`, `PUPPETEER_NO_SANDBOX=1` → `--no-sandbox` in `renderPdf.ts`). CMD runs `npm run db:deploy` (non-fatal) then `npm start`.
- Railway service variables: `DATABASE_URL` (internal URL + `?schema=workflow`), `NEXT_PUBLIC_BACKEND_URL` (also passed as build arg). Do not set `WORKFLOW_AUTH_DISABLED`.

## MCP server
Stays in the old `../workflow-builder` repo (`npm run mcp`) and reads its own SQLite DB, so it does **not** see portal data. Repointing it at Postgres is a possible follow-up.


## Workflow builder code reference (functions and definitions)

Numbering (`lib/workflow/flow/numbering.ts`)
- `analyzeFlow(nodes, edges)` — numbers every node `[start, step, ...branches]` (a split where all but one branch dead-end keeps the survivor on the main line; dead ends take the branch numbers); returns `{ paths, parents, forwardTargets, backEdgeIds }`. Loop-back and wait-signal edges are ignored. Used by: `computeStepNumbers`, walkthrough page, PDF `generateOutline`, MCP `describe.ts`.
- `computeStepNumbers(nodes, edges)` — `Map<nodeId, "#.#.#">`. Used by: `FlowCanvas` (badges via `data.stepNumber`).
- `formatStepNumber(path)` / `comparePaths(a, b)` — format a path as `#.#.#` / order two paths. Used by: walkthrough, `generateOutline`, `describe.ts`.
- `StepNumberBadge` (`components/workflow/workflow/canvas/StepNumberBadge.tsx`) — corner badge rendered by all six node components from `data.stepNumber` (`NodeActions.stepNumber`).

Walkthrough (`app/workflows/[id]/walkthrough/page.tsx`)
- `NodeStep` flags: `queue` (siblings of a fan-out inside a column), `waiting` (merge not yet entered), `joined` (merge continued in another column), `restore` (lets Previous undo a queue pull).
- `buildFollowingSteps` / `extendSteps` / `makeNodeStep` — build next steps; top-level fan-out splits into columns, nested fan-out queues in the same column.
- `mergeBlocked`, `collectFrontier`, `reachableFrom` — a merge waits only for parents still reachable by an open path.
- `releaseMerges` / `withReleasedWaits` — continue or collapse a split once a merge is ready; `undoLast` — Previous.

PDF (`lib/workflow/pdf/`)
- `generateOutline(...)` → flat `OutlineSection[]` in flow order (each step directly followed by the step it leads to via `placeNode`: dead-end branches first, then the carrying-on branch; a merge waits for all its parents; in a partial export, a step with no selected input but a selected loop-back into it (`loopKids`) follows the step that loops back instead of leading the document, and a merge doesn't wait on a branch reachable only through such a loop (`fromStarts`); numbers are unchanged); `OutlineLink` = where to go next. `renderPdf.ts`: `renderSections`, `renderSection`, `renderLinks`.

PDF export of a selection
- `SelectionBar` (`components/workflow/workflow/canvas/SelectionBar.tsx`, replaces `ExtractSubworkflowBar`) — floating bar while nodes are selected: "Export selection to PDF..." (1+ nodes) and "Extract to Sub-Workflow..." (2+). Used by `FlowCanvas`, which calls the `onExportSelection(nodeIds)` prop.
- `ExportPdfModal` (`components/workflow/workflow/ExportPdfModal.tsx`) — asks for the file name; used for both whole-workflow and selection export. Page state `exportRequest: { nodeIds? } | null`; `handleExportPdf(fileName, nodeIds?)` in `app/workflows/[id]/page.tsx` POSTs `{ nodeIds, fileName }` and downloads the blob.
- `generateOutline(..., includeNodeIds?)` — 9th param limits sections to the selection while numbering from the whole graph; `OutlineLink.outside` marks links that leave the selection. `renderWorkflowPdf({ subtitle })` — custom subtitle ("" hides it). Partial exports use body `title` (path name, else the file name) as the heading and have no subtitle. `layoutAndDrawJumpLines(pageHeight)` (runs in the Puppeteer page; pushes sections off page breaks using `moveTo` (clears the previous section's collapsing margin; snaps sections whose margin straddles a break to the page top), then draws faint SVG lines from each non-sequential `[data-go]` number to its `[data-sec]` step box). in a multi-answer row a target that is the very next section reads "go to next" (no line); links never show the target's bin (the target step's own box does). Headers show the step number + role chip (only decisions add a "Decision" label). Bin pills are solid bin colour with white text; `readableOnWhite(hex)` darkens colours too light for white text. `boxStyle(tag, kind)` makes decisions solid in the role colour (`DECISION_FALLBACK_COLOR` if none) with white text. Wait nodes act as a break: the wait section says "Hold here until <signal step> is complete" and "Once released → continue at N" (`renderLinkRows`); the signal step gets a "Releases wait X → continue at N" row (`renderReleases`, from `OutlineSection.releases` built in `generateOutline`); both rows carry `data-force` so their jump lines always draw. Routing rows (`.link`) are bold at 12px + 2pt. `renderRoleHtml(tag)` puts the role chip beside the number; `boxStyle(tag)` tints the box with the role colour (bin colour stays the border). `renderLinks(section, nextNumber)` drops links that leave a partial export (`outside`), and when one route remains into the next section shows nothing for a step or just the chosen answer for a decision; "go to" appears only for multiple answers, parallel splits, or jumps.

Saved paths (pick-and-save selections)
- `WorkflowPath` (Prisma, migrations `add_workflow_paths`, `add_path_edge_ids`) — `{ id, workflowId, name, nodeIds (JSON string), edgeIds (JSON string | null = all connections between its nodes) }`, cascades with its workflow. `lib/workflow/flow/paths.ts`: `WorkflowPathRecord`, `toPathRecord`, `cleanNodeIds`, `cleanEdgeIds`. Picking: connections between two picked nodes are on by default (`pickedEdgeIds` derived in the page from `currentEdges` minus `excludedEdgeIds`); clicking one (`togglePickEdge` → FlowCanvas `onPickEdgeToggle`) leaves it out. Edges are styled in `FlowCanvas.edgesWithActions` (blue = in, dashed = left out); `DeletableEdge`/`LoopBackEdge` honour `style.strokeWidth` and hide delete while `data.pickMode`.
- Toolbar (`WorkflowToolbar`): "Pick path" toggle + "Paths (n)" menu (Export / Edit / delete) beside Walkthrough. Page state in `app/workflows/[id]/page.tsx`: `pickMode`, `pickedIds`, `editingPathId`, `paths`; handlers `downloadPdf(fileName, nodeIds?, title?)` (one export request + download), `exportAllPaths` (one PDF per saved path, named after it; the Paths menu's "Export all"), `togglePick`, `startPicking`, `endPicking`, `savePath(name, asNew)`, `editPath`, `exportPath`, `deletePath`, `refreshPaths`. `exportRequest` now also carries `name`.
- `PathPickBar` (`components/workflow/workflow/canvas/PathPickBar.tsx`) — floating bar in pick mode (name, Save path / Update path / Save as new, Export PDF..., Clear, Done). `FlowCanvas` props `pickMode`, `pickedIds`, `onPickToggle`: plain click toggles a node (`.picked` outline in `globals.css`), dragging/selecting disabled while picking.

Bulk path export (main page)
- `BulkPathExportModal` (`components/workflow/workflow/BulkPathExportModal.tsx`), opened by the "Bulk export paths" button in `app/workflows/page.tsx` (`bulkExportOpen`): checkboxes grouped by workflow (select all / per workflow), then "Choose folder & export" calls `showDirectoryPicker` (Chromium) and writes one `<path name>.pdf` per selected path via `POST /api/workflows/[workflowId]/export`; browsers without it fall back to normal downloads. Duplicate names get "(2)".
- `GET /api/paths` (`app/api/paths/route.ts`) — every saved path across all workflows, each with `workflowName`.

Walkthrough by path (`app/workflows/[id]/walkthrough/page.tsx`)
- Opens on a "Choose a path" screen (saved paths + "Whole workflow"; skipped when none are saved). State `fullWorkflow`, `savedPaths` (GET `/api/workflows/[id]/paths`), `chosenPathId` (undefined = choosing, null = whole). `scopeToPath(full, path)` limits nodes/edges to the path's nodes and kept `edgeIds`; `workflow` is that scoped view. `findStarts(view, path)` = start nodes, or for a path the selected steps nothing else leads into. `choosePath(id)` sets the start. `analysis` branches from the scoped graph but `paths` (numbers) from the whole workflow. Header has "Change path".

Copy / paste (`components/workflow/workflow/canvas/FlowCanvas.tsx`)
- `clipboardRef` + a window `keydown` effect: Cmd/Ctrl+C stores the selected nodes and the edges between them; Cmd/Ctrl+V adds copies with new `nanoid` ids, offset 40px per paste (snapped), selected afterwards. Ignored in inputs/text fields and in pick mode. Loop-backs/wait signals between copied nodes are copied too; edges to non-copied nodes are not.

MCP (`../workflow-builder/mcp/server.ts`, `lib/workflow/flow/describe.ts`, see `MCP.md`)
- `buildModel(workflow, ref)` → `WorkflowModel` (`describe(node)` → `NodeDescription`, `ordered`, `nodeByNumber`, `numberOf`, `presence`).
- `renderOverview`, `renderNode`, `renderTree`, `renderDocumentTrace`, `findPaths` — markdown/text for the tools.
- Server helpers: `resolveWorkflow` (id/name/partial), `resolveNode` (number/id/label), `loadReference`, `guard`.
- Tools: `list_workflows`, `search_workflows`, `get_workflow_overview`, `get_workflow_steps`, `get_node`, `get_flow_tree`, `trace_document`, `find_paths`, `get_role_workload`, `get_reference_data`, `get_workflow_json`. Scripts: `npm run mcp`, `npm run mcp:smoke`.

API (all existing; the MCP server reads the DB directly and adds no endpoints)
- `GET/POST /api/workflows`, `GET/PUT/DELETE /api/workflows/[id]` — workflow CRUD; `POST /api/workflows/[id]/export` — PDF; optional JSON body `{ nodeIds?: string[]; edgeIds?: string[]; fileName?: string; title?: string }` (`edgeIds` limits the listed "go to" options to those connections; `generateOutline` 10th param `includeEdgeIds`) (selection only / download name; unknown ids ignored, all-unknown → 400).
- `GET/POST /api/workflows/[id]/paths` — list / create saved path `{ name, nodeIds, edgeIds? }` (400 if no name or no nodes); `PATCH/DELETE /api/workflows/[id]/paths/[pathId]` — rename / replace nodeIds / delete. Exporting a path = `POST .../export` with its `nodeIds`.
- `GET /api/roles`, `/api/role-groups`, `/api/bins`, `/api/locations` — reference data (walkthrough fetches all four).
