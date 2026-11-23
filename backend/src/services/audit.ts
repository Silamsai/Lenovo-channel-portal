import { prisma } from '../db';

export function audit(entry: {
  userId?: number;
  entity: string;
  entityId: number;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  note?: string | null;
}) {
  return prisma.auditLog.create({ data: entry });
}

export async function history(entity: string, entityId: number) {
  const rows = await prisma.auditLog.findMany({ where: { entity, entityId }, orderBy: { createdAt: 'asc' } });
  const userIds = [...new Set(rows.map((r) => r.userId).filter((x): x is number => !!x))];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });
  const nameOf = new Map(users.map((u) => [u.id, u.name]));
  return rows.map((r) => ({ ...r, by: r.userId ? nameOf.get(r.userId) ?? 'Unknown' : 'System' }));
}
