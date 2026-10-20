// One-off, insert-only import of the standalone workflow-builder SQLite data into the portal's
// Postgres `workflow` schema. Reads SQLite via the sqlite3 CLI; never updates or deletes rows
// (existing ids are skipped). Dry run unless --apply is passed.
// Usage: node scripts/import-workflow-builder-sqlite.cjs <path/to/dev.db> [--apply]
const { execFileSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local', quiet: true });

const [dbPath, flag] = process.argv.slice(2);
if (!dbPath) { console.error('usage: node scripts/import-workflow-builder-sqlite.cjs <dev.db> [--apply]'); process.exit(1); }
const apply = flag === '--apply';

const rows = (table) => {
  const out = execFileSync('sqlite3', ['-json', '-readonly', dbPath, `select * from "${table}"`], { maxBuffer: 1 << 28 }).toString().trim();
  return out ? JSON.parse(out) : [];
};
const dates = (r) => ({ ...r, createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt) });

(async () => {
  const p = new PrismaClient();
  const plan = [
    ['role', 'Role'], ['roleGroup', 'RoleGroup'], ['location', 'Location'],
    ['bin', 'Bin'], ['workflow', 'Workflow'], ['workflowPath', 'WorkflowPath'],
  ];
  for (const [model, table] of plan) {
    const data = rows(table).map(dates).map((r) => (model === 'workflow' ? { ...r, isTemplate: !!r.isTemplate } : r));
    const before = await p[model].count();
    if (apply) {
      const res = await p[model].createMany({ data, skipDuplicates: true });
      console.log(`${model}: source ${data.length}, inserted ${res.count}, before ${before}, after ${await p[model].count()}`);
    } else {
      console.log(`${model}: source ${data.length}, target currently ${before} (dry run)`);
    }
  }
  const join = rows('_RoleToRoleGroup');
  if (apply) {
    let n = 0;
    for (const j of join) n += await p.$executeRaw`INSERT INTO "_RoleToRoleGroup" ("A","B") VALUES (${j.A},${j.B}) ON CONFLICT DO NOTHING`;
    console.log(`role<->group links: source ${join.length}, inserted ${n}`);
  } else console.log(`role<->group links: source ${join.length} (dry run)`);
  await p.$disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
