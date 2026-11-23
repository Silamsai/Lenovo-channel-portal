/**
 * Applies SQL files in src/db/migrations in name order, once each.
 * Usage: npm run db:migrate   (PostgreSQL / Neon via DATABASE_URL)
 */
import fs from 'fs';
import path from 'path';
import { db } from './index';

export async function migrate(log = true) {
  await db.script(`CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const done = new Set((await db.many<{ name: string }>('SELECT name FROM schema_migrations')).map((r) => r.name));
  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    await db.tx(async (tx) => {
      // Statements are split on ';' at line ends so they run inside one transaction.
      for (const statement of sql.split(/;\s*$/m).map((s) => s.trim()).filter((s) => s && !/^(--[^\n]*\n?)+$/.test(s))) {
        await tx.run(statement);
      }
      await tx.run('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    });
    if (log) console.log(`Applied migration ${file}`);
  }
  if (log) console.log(`Database up to date.`);
}

if (require.main === module) {
  migrate()
    .then(() => db.close())
    .catch(async (err) => {
      console.error(err);
      await db.close();
      process.exit(1);
    });
}
