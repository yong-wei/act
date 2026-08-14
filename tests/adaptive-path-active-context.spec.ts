import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

const generator = 'artifacts/commercial-ui/issue-1324-adaptive-path-context/capture-evidence.mjs';
const manifestPath = path.resolve(
  process.cwd(),
  'artifacts/commercial-ui/issue-1324-adaptive-path-context/evidence-manifest.json',
);

function sha256(file: string) {
  return createHash('sha256').update(readFileSync(path.resolve(process.cwd(), file))).digest('hex');
}

function sha256AtRevision(revision: string, file: string) {
  return createHash('sha256')
    .update(execFileSync('git', ['show', `${revision}:${file}`], { cwd: process.cwd() }))
    .digest('hex');
}

test.describe.configure({ mode: 'serial' });

test('keeps the active non-default goal and path while generating candidates', () => {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3200';
  expect(() => execFileSync(process.execPath, [generator], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ADAPTIVE_PATH_EVIDENCE_BASE_URL: baseURL,
      ISSUE_1324_WRITE_EVIDENCE: '0',
    },
    stdio: 'pipe',
  })).not.toThrow();
});

test('evidence manifest fails closed on source or screenshot drift', () => {
  expect(existsSync(manifestPath)).toBe(true);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    status?: string;
    sourceRevision?: string;
    sourceSha256?: Record<string, string>;
    failedAssertions?: string[];
    results?: Array<{ screenshot?: string; screenshotSha256?: string }>;
  };

  expect(manifest.status).toBe('passed');
  expect(manifest.sourceRevision).toMatch(/^[0-9a-f]{40}$/);
  expect(manifest.failedAssertions).toEqual([]);
  for (const [file, expectedHash] of Object.entries(manifest.sourceSha256 ?? {})) {
    expect(existsSync(path.resolve(process.cwd(), file)), `${file} must exist`).toBe(true);
    expect(
      sha256AtRevision(manifest.sourceRevision!, file),
      `${file} did not match the evidence checkpoint`,
    ).toBe(expectedHash);
    expect(
      sha256AtRevision('HEAD', file),
      `${file} changed after evidence capture`,
    ).toBe(expectedHash);
  }
  expect(manifest.results).toHaveLength(4);
  for (const result of manifest.results ?? []) {
    expect(result.screenshot).toBeTruthy();
    expect(existsSync(path.resolve(process.cwd(), result.screenshot!))).toBe(true);
    expect(sha256(result.screenshot!)).toBe(result.screenshotSha256);
  }
});
