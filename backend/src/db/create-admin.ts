/**
 * Creates (or resets) the platform admin account without touching other data.
 * Usage: npm run admin:create   (optional env: ADMIN_EMAIL, ADMIN_PASSWORD)
 */
import bcrypt from 'bcryptjs';
import { db } from './index';
import { migrate } from './migrate';

const email = (process.env.ADMIN_EMAIL || 'admin@lenovo.com').toLowerCase();
const password = process.env.ADMIN_PASSWORD || 'lenovo@2026';

async function main() {
  await migrate(false);
  await db.run(
    `INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, 'Platform admin', 'ADMIN')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'ADMIN', active = true, partner_id = NULL`,
    [email, await bcrypt.hash(password, 10)],
  );
  console.log(`Platform admin ready: ${email}`);
}

main()
  .then(() => db.close())
  .catch(async (e) => {
    console.error(e);
    await db.close();
    process.exit(1);
  });
