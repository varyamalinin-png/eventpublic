/**
 * Оставляет по одному событию на каждое уникальное название (после trim + lower case).
 * Остальные с тем же ключом удаляются (каскад как при отмене события).
 *
 * По умолчанию только события с тегами «демо» и «2027» (сидер).
 *
 *   npx ts-node scripts/deduplicate-events-by-title.ts           # dry-run
 *   npx ts-node scripts/deduplicate-events-by-title.ts --yes      # выполнить
 *   npx ts-node scripts/deduplicate-events-by-title.ts --yes --all-titles  # ВСЕ события в БД (осторожно)
 */

import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

async function deleteEventCascade(tx: Prisma.TransactionClient, eventId: string): Promise<void> {
  await tx.eventMembership.deleteMany({ where: { eventId } });
  await tx.eventPersonalPhoto.deleteMany({ where: { eventId } });
  await tx.message.updateMany({ where: { eventId }, data: { eventId: null } });

  const chat = await tx.chat.findUnique({ where: { eventId } });
  if (chat) {
    await tx.chat.update({ where: { id: chat.id }, data: { lastMessageId: null } });
    await tx.message.deleteMany({ where: { chatId: chat.id } });
    await tx.chatParticipant.deleteMany({ where: { chatId: chat.id } });
    await tx.folderChat.deleteMany({ where: { chatId: chat.id } });
    await tx.chat.delete({ where: { id: chat.id } });
  }

  await tx.complaint.updateMany({
    where: { reportedEventId: eventId },
    data: { reportedEventId: null },
  });

  await tx.event.delete({ where: { id: eventId } });
}

async function main() {
  const yes = process.argv.includes('--yes');
  const allTitles = process.argv.includes('--all-titles');

  const where: Prisma.EventWhereInput = allTitles
    ? {}
    : {
        AND: [{ customTags: { has: 'демо' } }, { customTags: { has: '2027' } }],
      };

  const events = await prisma.event.findMany({
    where,
    select: { id: true, title: true, createdAt: true, organizerId: true },
    orderBy: { createdAt: 'asc' },
  });

  if (events.length === 0) {
    console.log('Событий по фильтру нет.');
    process.exit(0);
  }

  const byKey = new Map<string, typeof events>();
  for (const e of events) {
    const key = normalizeTitle(e.title);
    if (!key) continue;
    const list = byKey.get(key) ?? [];
    list.push(e);
    byKey.set(key, list);
  }

  const toDelete: string[] = [];
  let dupGroups = 0;
  for (const [, list] of byKey) {
    if (list.length <= 1) continue;
    dupGroups += 1;
    const [, ...rest] = list; // оставляем самое раннее по createdAt
    for (const x of rest) {
      toDelete.push(x.id);
    }
  }

  console.log(
    `Фильтр: ${allTitles ? 'все события' : 'теги демо+2027'}. Всего записей: ${events.length}, групп с дублями: ${dupGroups}, к удалению: ${toDelete.length}`,
  );

  if (toDelete.length === 0) {
    console.log('Дублей по названию нет.');
    process.exit(0);
  }

  if (!yes) {
    console.log('Запустите с --yes для удаления.');
    for (const id of toDelete.slice(0, 30)) {
      const ev = events.find((e) => e.id === id);
      console.log(`  − ${id.slice(0, 8)}… «${ev?.title}»`);
    }
    if (toDelete.length > 30) console.log(`  … ещё ${toDelete.length - 30}`);
    process.exit(0);
  }

  let deleted = 0;
  for (const eventId of toDelete) {
    await prisma.$transaction(async (tx) => {
      await deleteEventCascade(tx, eventId);
    });
    deleted += 1;
    const ev = events.find((e) => e.id === eventId);
    console.log(`✓ удалено ${eventId.slice(0, 8)}… «${ev?.title}»`);
  }

  console.log(`\nГотово. Удалено событий: ${deleted}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
