import 'dotenv/config';

import { createHash } from 'node:crypto';

import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { createSubmissionObjectStore } from '../../src/lib/assignments/submission-object-store';

const anonymous = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 12);

async function main() {
  const client = new S3Client({ endpoint: process.env.SUBMISSION_S3_ENDPOINT, region: process.env.SUBMISSION_S3_REGION ?? 'us-east-1', forcePathStyle: true, credentials: { accessKeyId: process.env.SUBMISSION_S3_ACCESS_KEY ?? '', secretAccessKey: process.env.SUBMISSION_S3_SECRET_KEY ?? '' } });
  const response = await client.send(new ListObjectsV2Command({ Bucket: process.env.SUBMISSION_S3_BUCKET, Prefix: 'grading-' }));
  const store = createSubmissionObjectStore();
  const results = [];
  for (const object of response.Contents ?? []) {
    if (!object.Key) continue;
    try { const metadata = await store.head(object.Key); results.push({ key: anonymous(object.Key), size: object.Size, status: metadata ? 'ok' : 'missing' }); }
    catch (error) { results.push({ key: anonymous(object.Key), size: object.Size, status: 'error', error: error instanceof Error ? error.message : String(error) }); }
  }
  console.log(JSON.stringify({ count: results.length, results }));
  if (results.some((result) => result.status !== 'ok')) process.exitCode = 1;
}

void main();
