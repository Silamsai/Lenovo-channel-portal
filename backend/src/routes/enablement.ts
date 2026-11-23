import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { badRequest, notFound } from '../middleware/errors';

export const enablementRouter = Router();

enablementRouter.get('/', async (req, res) => {
  const modules = await prisma.learningModule.findMany({ orderBy: { order: 'asc' } });
  const done = await prisma.learningProgress.findMany({ where: { userId: req.user!.id } });
  const doneIds = new Set(done.map((d) => d.moduleId));
  res.json(
    modules.map(({ answer: _answer, ...m }) => ({
      ...m,
      checks: JSON.parse(m.checks) as string[],
      options: JSON.parse(m.options) as { value: string; label: string }[],
      completed: doneIds.has(m.id),
    })),
  );
});

enablementRouter.post('/:id/complete', async (req, res) => {
  const { answer } = z.object({ answer: z.string() }).parse(req.body);
  const mod = await prisma.learningModule.findUnique({ where: { id: Number(req.params.id) } });
  if (!mod) throw notFound('Module not found.');
  if (answer !== mod.answer) throw badRequest(mod.hint);
  await prisma.learningProgress.upsert({
    where: { userId_moduleId: { userId: req.user!.id, moduleId: mod.id } },
    create: { userId: req.user!.id, moduleId: mod.id },
    update: {},
  });
  res.json({ ok: true });
});
