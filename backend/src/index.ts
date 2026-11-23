import http from 'http';
import { env } from './env';
import { handler } from './app';
import { db } from './db';
import { migrate } from './db/migrate';
import { loadSettings } from './services/settings';

async function start() {
  // Bring the schema up to date, then load admin-managed settings before serving requests.
  await migrate(false);
  await loadSettings();
  const server = http.createServer((req, res) => {
    void handler(req, res);
  });
  server.listen(env.port, () => {
    console.log(`Channel Studio API on http://localhost:${env.port}`);
  });
  const stop = async () => {
    server.close();
    await db.close();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
