import 'dotenv/config';

import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';

const client = new S3Client({
  endpoint: process.env.SUBMISSION_S3_ENDPOINT ?? 'http://127.0.0.1:9000',
  region: process.env.SUBMISSION_S3_REGION ?? 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.SUBMISSION_S3_ACCESS_KEY ?? '',
    secretAccessKey: process.env.SUBMISSION_S3_SECRET_KEY ?? '',
  },
});
const bucket = process.env.SUBMISSION_S3_BUCKET ?? 'private-assignment-submissions';
await client.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 }));
console.log(JSON.stringify({ bucket, endpoint: process.env.SUBMISSION_S3_ENDPOINT ?? 'http://127.0.0.1:9000', status: 'ok' }));
