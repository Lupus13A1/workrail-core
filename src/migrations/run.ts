/**
 * Firebase RTDB migration runner.
 *
 *   npm run migrate              # deploy database.rules.json + run pending migrations
 *   npm run migrate -- --dry-run # show what would change, write nothing
 *   npm run migrate -- --skip-rules
 *   npm run migrate -- --force 002-ensure-default-orgs   # re-run an applied migration (all are idempotent)
 *
 * Applied migrations are recorded at /_meta/migrations/{id}; schema info at /_meta/schema.
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { applicationDefault, cert, deleteApp, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { MIGRATIONS, SCHEMA_COLLECTIONS } from './index';
import { MigrationContext } from './types';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const skipRules = args.includes('--skip-rules');
const forceIdx = args.indexOf('--force');
const forced = new Set(forceIdx >= 0 ? (args[forceIdx + 1] ?? '').split(',').filter(Boolean) : []);

const log = (msg: string) => console.log(msg);

function initFirebase() {
  const envFile = resolve(process.cwd(), '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);

  const { FIREBASE_PROJECT_ID: projectId, FIREBASE_CLIENT_EMAIL: clientEmail, FIREBASE_DATABASE_URL: databaseURL } =
    process.env;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!databaseURL) throw new Error('FIREBASE_DATABASE_URL is required');

  const credential =
    projectId && clientEmail && privateKey ? cert({ projectId, clientEmail, privateKey }) : applicationDefault();
  return initializeApp({ credential, databaseURL, projectId }, 'migrations');
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
      : v,
  );
}

async function main() {
  const app = initFirebase();
  const db = getDatabase(app);
  const auth = getAuth(app);
  log(`\n▶ Firebase RTDB migration ${dryRun ? '(DRY RUN — nothing will be written)' : ''}`);
  log(`  database: ${process.env.FIREBASE_DATABASE_URL}\n`);

  try {
    // 1) Security rules + indexes
    if (!skipRules) {
      const rulesPath = resolve(process.cwd(), 'database.rules.json');
      const local = readFileSync(rulesPath, 'utf8');
      const remote = await db.getRules();
      const same = stableStringify(JSON.parse(local)) === stableStringify(JSON.parse(remote));
      if (same) log('■ rules: up to date');
      else if (dryRun) log('■ rules: WOULD deploy database.rules.json');
      else {
        await db.setRules(local);
        log('■ rules: deployed database.rules.json');
      }
    }

    // 2) Data migrations
    const applied: Record<string, unknown> = (await db.ref('_meta/migrations').get()).val() ?? {};
    const ctx: MigrationContext = {
      db, auth, dryRun, log,
      write: async (updates) => { if (!dryRun) await db.ref().update(updates); },
    };

    for (const m of MIGRATIONS) {
      if (applied[m.id] && !forced.has(m.id)) {
        log(`■ ${m.id}: already applied — skip`);
        continue;
      }
      log(`■ ${m.id}: ${m.description}`);
      const started = Date.now();
      const summary = await m.up(ctx);
      log(`  ✓ ${JSON.stringify(summary)} (${Date.now() - started}ms)`);
      if (!dryRun) await db.ref(`_meta/migrations/${m.id}`).set({ appliedAt: Date.now(), summary });
    }

    // 3) Schema marker
    if (!dryRun) {
      await db.ref('_meta/schema').set({
        version: MIGRATIONS[MIGRATIONS.length - 1]?.id ?? null,
        collections: SCHEMA_COLLECTIONS,
        updatedAt: Date.now(),
      });
    }
    log(`\n✔ Done${dryRun ? ' (dry run)' : ''}\n`);
  } finally {
    await deleteApp(app);
  }
}

main().catch((err) => {
  console.error('\n✖ Migration failed:', err?.message ?? err);
  process.exit(1);
});
