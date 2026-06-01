import assert from 'node:assert/strict';
import { stat, readFile } from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const errorLogPath = path.join(rootDir, '.logs', 'error.log');
const smokeUrl = process.env.RUNTIME_SMOKE_URL ?? 'http://127.0.0.1:3001/';

async function logSize(filePath) {
  try {
    const info = await stat(filePath);
    return info.size;
  } catch (error) {
    if (error?.code === 'ENOENT') return 0;
    throw error;
  }
}

async function readNewLogBytes(filePath, startOffset) {
  try {
    const content = await readFile(filePath);
    return content.subarray(startOffset).toString('utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return '';
    throw error;
  }
}

const beforeBytes = await logSize(errorLogPath);
const response = await fetch(smokeUrl, { redirect: 'manual' });
const afterBytes = await logSize(errorLogPath);
const newErrorBytes = await readNewLogBytes(errorLogPath, beforeBytes);

assert(
  response.status >= 200 && response.status < 400,
  `Homepage smoke request failed with HTTP ${response.status}`,
);
assert.equal(
  newErrorBytes.trim(),
  '',
  `Homepage smoke request wrote new error log bytes:\n${newErrorBytes}`,
);

console.log(
  JSON.stringify({
    smokeUrl,
    status: response.status,
    errorLogBeforeBytes: beforeBytes,
    errorLogAfterBytes: afterBytes,
    newErrorBytes: afterBytes - beforeBytes,
  }),
);
