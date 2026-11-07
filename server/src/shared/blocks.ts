import { PrismaService } from '../prisma/prisma.service';

/**
 * Кого этот человек не должен видеть, и кто не должен видеть его.
 *
 * Блокировка хранится односторонней строкой (кто кого), а действует в обе
 * стороны: и заблокировавший, и заблокированный исчезают друг для друга из
 * лент, поиска, заявок и переписки. Поэтому почти везде нужен именно этот
 * объединённый список, а не «кого я заблокировал».
 */
export async function blockedUserIds(
  prisma: PrismaService,
  userId?: string | null,
): Promise<string[]> {
  if (!userId) return [];
  const rows = await prisma.userBlock.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  const ids = new Set<string>();
  rows.forEach(row => {
    ids.add(row.blockerId === userId ? row.blockedId : row.blockerId);
  });
  return Array.from(ids);
}

/** Есть ли блокировка между двумя людьми — в любую сторону. */
export async function isBlockedBetween(
  prisma: PrismaService,
  a: string,
  b: string,
): Promise<boolean> {
  if (!a || !b || a === b) return false;
  const row = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
    select: { id: true },
  });
  return !!row;
}
