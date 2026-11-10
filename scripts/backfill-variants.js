/**
 * Разовый бэкфилл уменьшенных вариантов в S3 (Yandex Object Storage).
 *
 * Для каждого объекта events/…, users/… с расширением .webp/.jpg/.png
 * генерирует варианты <ключ без расширения>__w<N>.webp (N = 200/400/600/800/1200,
 * только меньше ширины оригинала) и кладёт их в тот же бакет. Уже существующие
 * варианты пропускает — скрипт идемпотентен, его можно перезапускать.
 *
 * Запуск на VM:  node /tmp/backfill-variants.js
 * Завершается сам по тайм-лимиту (~4 минуты), чтобы уложиться во внешний
 * лимит выполнения; незаконченное добирается следующим запуском.
 */
const fs = require('fs');
const { createRequire } = require('module');

const req = createRequire('/opt/iwent/server/package.json');
const {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} = req('@aws-sdk/client-s3');
const sharp = req('sharp');

const TIME_BUDGET_MS = 240 * 1000;
const startedAt = Date.now();

const env = {};
for (const line of fs.readFileSync('/opt/iwent/server/.env', 'utf8').split('\n')) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const WIDTHS = [200, 400, 600, 800, 1200];
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

const s3 = new S3Client({
  region: env.STORAGE_REGION,
  endpoint: env.STORAGE_ENDPOINT,
  forcePathStyle: env.STORAGE_FORCE_PATH_STYLE === 'true',
  credentials: {
    accessKeyId: env.STORAGE_ACCESS_KEY,
    secretAccessKey: env.STORAGE_SECRET_KEY,
  },
});
const Bucket = env.STORAGE_BUCKET;

async function exists(Key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket, Key }));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  let token;
  let scanned = 0;
  let processed = 0;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket, ContinuationToken: token }));
    for (const obj of page.Contents ?? []) {
      const key = obj.Key;
      if (!key || !/\.(webp|jpe?g|png)$/i.test(key)) continue;
      if (/__w\d+\.webp$/i.test(key)) continue;
      scanned++;

      const base = key.replace(/\.(webp|jpe?g|png)$/i, '');
      const missing = [];
      for (const w of WIDTHS) {
        if (!(await exists(`${base}__w${w}.webp`))) missing.push(w);
      }
      if (!missing.length) continue;

      let buf;
      try {
        const data = await s3.send(new GetObjectCommand({ Bucket, Key: key }));
        buf = Buffer.from(await data.Body.transformToByteArray());
      } catch (e) {
        console.log(`SKIP ${key}: ${e.message}`);
        continue;
      }

      let meta;
      try {
        meta = await sharp(buf).metadata();
      } catch (e) {
        console.log(`SKIP ${key}: not an image (${e.message})`);
        continue;
      }
      if (!meta.width) continue;

      for (const w of missing) {
        if (w >= meta.width) continue;
        try {
          const variant = await sharp(buf)
            .rotate()
            .resize({ width: w, withoutEnlargement: true })
            .webp({ quality: 82 })
            .toBuffer();
          await s3.send(
            new PutObjectCommand({
              Bucket,
              Key: `${base}__w${w}.webp`,
              Body: variant,
              ContentType: 'image/webp',
              CacheControl: CACHE_CONTROL,
            }),
          );
        } catch (e) {
          console.log(`FAIL ${base}__w${w}: ${e.message}`);
        }
      }
      processed++;
      if (processed % 10 === 0) console.log(`progress: scanned=${scanned} processed=${processed}`);

      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        console.log(`TIME LIMIT: scanned=${scanned} processed=${processed} — перезапусти скрипт для продолжения`);
        return;
      }
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  console.log(`DONE: scanned=${scanned} processed=${processed}`);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
