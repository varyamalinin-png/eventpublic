/**
 * Проставляет обложки тем событиям, где mediaUrl/originalMediaUrl не заданы.
 *
 * По умолчанию — только демо-события (теги «демо» + «2027»).
 *
 *   npx ts-node scripts/fill-missing-event-media.ts            # dry-run
 *   npx ts-node scripts/fill-missing-event-media.ts --yes      # выполнить
 *   npx ts-node scripts/fill-missing-event-media.ts --yes --all # все события (осторожно)
 */

import { Prisma, PrismaClient } from '@prisma/client';
import { demoCoverUrls } from './demo-event-cover-urls';

const prisma = new PrismaClient();

const isBlank = (v: string | null | undefined) => !v || v.trim() === '';

async function main() {
  const yes = process.argv.includes('--yes');
  const all = process.argv.includes('--all');

  const where: Prisma.EventWhereInput = {
    AND: [
      all ? {} : { AND: [{ customTags: { has: 'демо' } }, { customTags: { has: '2027' } }] },
      {
        OR: [{ mediaUrl: null }, { originalMediaUrl: null }],
      },
    ],
  };

  // Prisma не умеет “empty string” как отдельный фильтр портативно — проверим в коде.
  const events = await prisma.event.findMany({
    where,
    select: { id: true, title: true, mediaUrl: true, originalMediaUrl: true },
  });

  const missing = events.filter((e) => isBlank(e.mediaUrl) || isBlank(e.originalMediaUrl));
  console.log(
    `Фильтр: ${all ? 'все события' : 'теги демо+2027'}. Найдено событий с пропущенными обложками: ${missing.length}`,
  );

  if (missing.length === 0) process.exit(0);

  if (!yes) {
    console.log('Запустите с --yes для обновления.');
    for (const ev of missing.slice(0, 25)) {
      console.log(`  • ${ev.id.slice(0, 8)}… «${ev.title}» (media=${String(ev.mediaUrl)}, original=${String(ev.originalMediaUrl)})`);
    }
    if (missing.length > 25) console.log(`  … ещё ${missing.length - 25}`);
    process.exit(0);
  }

  let updated = 0;
  for (const ev of missing) {
    const { mediaUrl, originalMediaUrl } = demoCoverUrls(ev.id);
    await prisma.event.update({
      where: { id: ev.id },
      data: {
        mediaUrl,
        originalMediaUrl,
        mediaType: 'image',
        mediaAspectRatio: 16 / 9,
      },
    });
    await prisma.eventProfile.updateMany({
      where: { eventId: ev.id },
      data: { avatar: originalMediaUrl },
    });
    updated += 1;
    console.log(`✓ ${ev.id.slice(0, 8)}… «${ev.title}»`);
  }

  console.log(`\nГотово. Обновлено событий: ${updated}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

