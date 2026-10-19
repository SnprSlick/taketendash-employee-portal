# Workflow Builder Integration (branch: workflow-builder-integration)

## Phase 1 (COMPLETE): Upgrade portal stack (Next 16 / React 19 / Tailwind 4)
- [x] 1.1 Verify clean baseline build on current stack
- [x] 1.2 Upgrade next, react, react-dom, types, eslint-config-next
- [x] 1.3 Migrate Tailwind 3 -> 4 (postcss plugin, globals.css, remove tailwind.config.ts)
- [x] 1.4 Fix build/type errors
- [x] 1.5 Run dev server, check existing pages for console errors

## Phase 2: Prisma + Postgres
- [x] 2.1 Install prisma/@prisma/client/dotenv, prisma.config.ts (loads .env.local)
- [x] 2.2 Port schema to postgresql, tables prefixed wf_, isolated in `workflow` pg schema
- [x] 2.3 Generate init migration offline (additive only, audited)
- [x] 2.4 DATABASE_URL in gitignored .env.local; placeholder in .env.example
- [ ] 2.5 Apply migration with `npm run db:deploy` (NEVER migrate dev/reset/db push) - needs Railway public URL or run on Railway
- [ ] 2.6 Create lib/db (Prisma singleton)

## Phase 3: Port code (components, lib, API routes, pages, NavBar link, auth)
- [ ] Not started

## Phase 4: Puppeteer/Chromium on Railway
- [ ] Not started

## Phase 5: Data migration
- [ ] Not started

## Phase 6: Docs (merge function reference into CLAUDE.md)
- [ ] Not started
