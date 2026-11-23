import { z } from 'zod';
import { db } from '../db';
import { auth } from '../auth';
import { badRequest, notFound } from '../lib/http';
import { Router } from '../lib/router';

export const enablementRoutes = new Router();

enablementRoutes.get('/', auth, (ctx) =>
  db.many(
    `SELECT m.id, m.sort_order AS "order", m.title, m.minutes, m.body, m.checks, m.question, m.options,
            (p.user_id IS NOT NULL) AS completed
       FROM learning_modules m
       LEFT JOIN learning_progress p ON p.module_id = m.id AND p.user_id = $1
      ORDER BY m.sort_order`,
    [ctx.me.id],
  ),
);

enablementRoutes.post('/:id/complete', auth, async (ctx) => {
  const { answer } = z.object({ answer: z.string() }).parse(await ctx.json());
  const mod = await db.maybe('SELECT id, answer, hint FROM learning_modules WHERE id = $1', [ctx.param('id')]);
  if (!mod) throw notFound('Module not found.');
  if (answer !== mod.answer) throw badRequest(mod.hint);
  await db.run('INSERT INTO learning_progress (user_id, module_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [ctx.me.id, mod.id]);
  return { ok: true };
});
