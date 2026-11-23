import { env } from './env';
import { createApp } from './app';

createApp().listen(env.port, () => {
  console.log(`Channel Studio API listening on http://localhost:${env.port}`);
});
