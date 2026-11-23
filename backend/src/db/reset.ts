/**
 * Fresh start: deletes ALL data (users, partners, funding, campaigns, claims, files, kits,
 * learning, benefits, rewards, settings, history) and creates one platform admin account.
 *
 * Usage: npm run db:reset
 * Optional env: ADMIN_EMAIL, ADMIN_PASSWORD (defaults admin@lenovo.com / lenovo@2026)
 */
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { db } from './index';
import { migrate } from './migrate';
import { env } from '../env';

const email = (process.env.ADMIN_EMAIL || 'admin@lenovo.com').toLowerCase();
const password = process.env.ADMIN_PASSWORD || 'lenovo@2026';

async function main() {
  await migrate(false);
  await db.script(`TRUNCATE audit_log, settings, points_entries, reward_items, benefit_requests, benefit_items, claims, campaign_files,
    campaigns, funding_requests, kit_customisations, learning_progress, learning_modules, campaign_kits, users, partners RESTART IDENTITY CASCADE`);
  await db.run(`INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, 'Platform admin', 'ADMIN')`, [email, await bcrypt.hash(password, 10)]);

  // Remove uploaded campaign files too (keep the folder's .gitkeep).
  for (const f of fs.readdirSync(env.uploadDir)) {
    if (f !== '.gitkeep') fs.rmSync(path.join(env.uploadDir, f), { force: true });
  }

  console.log('All data removed. The database is empty except for one platform admin:');
  console.log(`  ${email}`);
}

main()
  .then(() => db.close())
  .catch(async (e) => {
    console.error(e);
    await db.close();
    process.exit(1);
  });
