/**
 * Проставляет рабочие URL обложек для уже созданных демо-событий (теги «демо» + «2027»).
 *
 *   npx ts-node scripts/patch-demo-events-2027-media.ts --yes
 */

import { PrismaClient } from '@prisma/client';
import { demoCoverUrls } from './demo-event-cover-urls';

const prisma = new PrismaClient();

async function main() {
  const yes = process.argv.includes('--yes');
  if (!yes) {
    console.log('Обновит mediaUrl / originalMediaUrl / mediaType у событий с тегами «демо» и «2027».');
    console.log('Запустите с --yes.');
    process.exit(0);
  }

  const events = await prisma.event.findMany({
    where: {
      AND: [{ customTags: { has: 'демо' } }, { customTags: { has: '2027' } }],
    },
    select: { id: true, title: true },
  });

  if (events.length === 0) {
    console.log('Событий не найдено.');
    process.exit(0);
  }

  let n = 0;
  for (const ev of events) {
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
    n += 1;
    console.log(`✓ ${ev.id.slice(0, 8)}… ${ev.title}`);
  }

  console.log(`\nГотово. Обновлено событий: ${n}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
