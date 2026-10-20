# Workflow Builder Integration (branch: workflow-builder-integration)

## Phase 1 (COMPLETE): Upgrade portal stack (Next 16 / React 19 / Tailwind 4)
- [x] 1.1 Verify clean baseline build on current stack
- [x] 1.2 Upgrade next, react, react-dom, types, eslint-config-next
- [x] 1.3 Migrate Tailwind 3 -> 4 (postcss plugin, globals.css, remove tailwind.config.ts)
- [x] 1.4 Fix build/type errors
- [x] 1.5 Run dev server, check existing pages for console errors

## Phase 2 (COMPLETE): Prisma + Postgres
- [x] 2.1 Install prisma/@prisma/client/dotenv, prisma.config.ts (loads .env.local)
- [x] 2.2 Port schema to postgresql, tables prefixed wf_, isolated in `workflow` pg schema
- [x] 2.3 Generate init migration offline (additive only, audited)
- [x] 2.4 DATABASE_URL in gitignored .env.local; placeholder in .env.example
- [x] 2.5 Migration applied to Railway (workflow schema, 8 tables; public untouched)
- [x] 2.6 Create app/lib/db.ts (Prisma singleton `prisma`)

## Phase 3 (COMPLETE): Port code
- [x] 3.1 Copy components -> components/workflow, lib -> lib/workflow, API routes -> app/api, pages -> app/workflows, app/print
- [x] 3.2 Rewrite import aliases; list page at /workflows
- [x] 3.3 Auth: proxy.ts validates Bearer token vs backend /auth/profile; wfFetch adds token client-side; /workflows layout gates on login
- [x] 3.4 NavBar 'Workflows' link, portal layout (h-full inside NavBar shell)
- [x] 3.5 Verified: build, list/create/canvas/walkthrough, no console errors, PDF export locally
- [ ] 3.6 Follow-up: verify auth path against real backend token (local backend not running; WORKFLOW_AUTH_DISABLED=1 in .env.local for dev only)

## Phase 4 (COMPLETE): Puppeteer/Chromium on Railway
- [x] 4.1 Production Dockerfile (node:22-slim + chromium, PUPPETEER_EXECUTABLE_PATH, --no-sandbox via PUPPETEER_NO_SANDBOX=1), .dockerignore
- [x] 4.2 CMD runs `npm run db:deploy` (non-fatal on failure) then `npm start`
- [x] 4.3 Verified locally in Docker: image builds, Chromium renders PDF, portal starts with unreachable DB, API 401 without token
- [ ] 4.4 Railway service variables: DATABASE_URL (internal URL + ?schema=workflow), NEXT_PUBLIC_BACKEND_URL (build arg); do NOT set WORKFLOW_AUTH_DISABLED

## Phase 5: Data migration
- [ ] Not started

## Phase 6: Docs (merge function reference into CLAUDE.md)
- [ ] Not started
