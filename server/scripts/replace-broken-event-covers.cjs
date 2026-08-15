#!/usr/bin/env node
/**
 * Заменяет обложки событий, которые плохо открываются в вебе:
 * - upload.wikimedia.org (частые 404)
 * - .heic / .HEIC (часто не рендерится в браузере)
 *
 * Использует те же URL, что scripts/fallback-event-cover-urls.json
 *
 *   node scripts/replace-broken-event-covers.cjs           # dry-run
 *   node scripts/replace-broken-event-covers.cjs --yes     # выполнить
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const { urls: DEMO_URLS } = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fallback-event-cover-urls.json'), 'utf8'),
);

function hashSeed(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function demoCoverUrls(seedKey) {
  const n = DEMO_URLS.length;
  const i = hashSeed(seedKey) % n;
  const j = (i + 7 + (hashSeed(seedKey + '-o') % (n - 1 || 1))) % n;
  return { mediaUrl: DEMO_URLS[i], originalMediaUrl: DEMO_URLS[j] };
}

async function main() {
  const yes = process.argv.includes('--yes');

  const events = await prisma.event.findMany({
    where: {
      OR: [
        { mediaUrl: { contains: 'upload.wikimedia.org', mode: 'insensitive' } },
        { originalMediaUrl: { contains: 'upload.wikimedia.org', mode: 'insensitive' } },
        { mediaUrl: { endsWith: '.heic', mode: 'insensitive' } },
        { originalMediaUrl: { endsWith: '.heic', mode: 'insensitive' } },
        { mediaUrl: { contains: 'trycloudflare.com', mode: 'insensitive' } },
        { originalMediaUrl: { contains: 'trycloudflare.com', mode: 'insensitive' } },
      ],
    },
    select: { id: true, title: true, mediaUrl: true, originalMediaUrl: true },
  });

  console.log(`Найдено событий с «битыми для веба» обложками: ${events.length}`);
  for (const ev of events.slice(0, 15)) {
    console.log(`  • ${ev.id.slice(0, 8)}… ${ev.title}`);
  }
  if (events.length > 15) console.log(`  … ещё ${events.length - 15}`);

  if (!yes) {
    console.log('\nЗапустите с --yes для обновления.');
    return;
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
  }
  console.log(`\nГотово. Обновлено событий: ${n}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
