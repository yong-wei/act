import 'dotenv/config';

import { createHash } from 'node:crypto';

import { createSubmissionObjectStore } from '../../src/lib/assignments/submission-object-store';

const bytes = new TextEncoder().encode('stage-a-render-write-probe');
const checksum = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const key = `grading-visual/document-conversion_probe/attempt_probe/${createHash('sha256').update(String(Date.now())).digest('hex')}`;

async function main() {
  const store = createSubmissionObjectStore();
  const signed = await store.signUpload({ ownerId: 'probe-owner', answerId: 'probe-answer', attemptId: 'probe-attempt', sizeBytes: bytes.byteLength, mimeType: 'application/octet-stream', checksum }, 600, key);
  const response = await fetch(signed.url, { method: 'PUT', headers: signed.requiredHeaders, body: Buffer.from(bytes) });
  const body = await response.text();
  let cleanup: string | null = null;
  try { await store.delete(key); cleanup = 'deleted'; } catch (error) { cleanup = error instanceof Error ? error.message : String(error); }
  console.log(JSON.stringify({ status: response.status, body: body.slice(0, 500), requiredHeaders: Object.keys(signed.requiredHeaders).sort(), cleanup }));
  if (!response.ok) process.exitCode = 1;
}

void main();
