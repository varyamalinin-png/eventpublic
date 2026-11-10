const fs = require('fs');
const { createRequire } = require('module');
const req = createRequire('/opt/iwent/server/package.json');
const { S3Client, ListObjectsV2Command } = req('@aws-sdk/client-s3');

const env = {};
for (const line of fs.readFileSync('/opt/iwent/server/.env', 'utf8').split('\n')) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const s3 = new S3Client({
  region: env.STORAGE_REGION,
  endpoint: env.STORAGE_ENDPOINT,
  forcePathStyle: env.STORAGE_FORCE_PATH_STYLE === 'true',
  credentials: { accessKeyId: env.STORAGE_ACCESS_KEY, secretAccessKey: env.STORAGE_SECRET_KEY },
});

(async () => {
  let token;
  let variants = 0;
  let originals = 0;
  let sample = null;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: env.STORAGE_BUCKET, ContinuationToken: token }));
    for (const o of page.Contents ?? []) {
      if (/__w\d+\.webp$/i.test(o.Key)) {
        variants++;
        if (!sample && /__w400\.webp$/.test(o.Key)) sample = o.Key;
      } else if (/\.(webp|jpe?g|png)$/i.test(o.Key)) {
        originals++;
      }
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  console.log(JSON.stringify({ originals, variants, sample }));
})();
