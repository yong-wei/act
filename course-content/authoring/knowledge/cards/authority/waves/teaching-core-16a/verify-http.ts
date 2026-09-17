/** Read-only page verification using the repository's existing student test account. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { verifiedAuthForm } from '../../../../../../../tests/verified-test-credentials';

const batch = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const currentInventory = read(join(batch, 'inventory.json'));
const currentBatchId = currentInventory.batchId;
const priorBatchIds = ['teaching-batch-01', 'teaching-batch-02', 'teaching-scale-01', 'teaching-scale-01b', 'teaching-scale-01d', 'teaching-scale-01c', 'teaching-scale-01f', 'teaching-scale-01e', 'teaching-scale-01h', 'teaching-scale-01g', 'teaching-core-01a', 'teaching-core-02a', 'teaching-core-04a', 'teaching-core-03a', 'teaching-core-06a', 'teaching-core-05a', 'teaching-core-07a', 'teaching-core-09a', 'teaching-core-08a', 'teaching-core-10a', 'teaching-core-11a', 'teaching-core-12a', 'teaching-core-13a', 'teaching-core-14a', 'teaching-core-15a'];
assert(!priorBatchIds.includes(currentBatchId), 'Current batch must be appended exactly once');
const cards = [...priorBatchIds, currentBatchId].flatMap((name) => read(join(batch, '..', name, 'inventory.json')).cards);
const projection = read(join(process.cwd(), 'course-content/runtime/knowledge/projection/current.json'));
const authority = read(join(process.cwd(), 'course-content/authoring/knowledge/authority/current.json'));
const base = 'http://localhost:3004';
const cookies = new Map<string, string>();
async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(base + path, { ...options, redirect: 'manual',
    headers: { ...options.headers, cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; ') } });
  for (const value of response.headers.getSetCookie()) {
    const pair = value.split(';', 1)[0], equals = pair.indexOf('=');
    cookies.set(pair.slice(0, equals), pair.slice(equals + 1));
  }
  return response;
}
async function main() {
  const pid = execFileSync('lsof', ['-t', '-iTCP:3004', '-sTCP:LISTEN'], { encoding: 'utf8' }).trim().split('\n')[0];
  const cwd = execFileSync('lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn'], { encoding: 'utf8' }).split('\n').find((line) => line.startsWith('n'))?.slice(1);
  assert.equal(cwd, process.cwd(), 'HTTP service belongs to another worktree');
  const csrfResponse = await request('/api/auth/csrf');
  assert(csrfResponse.ok, 'CSRF endpoint unavailable');
  const csrf = await csrfResponse.json();
  await request('/api/auth/callback/credentials?json=true', { method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...verifiedAuthForm('student'), csrfToken: csrf.csrfToken, callbackUrl: base, json: 'true' }) });
  const sessionResponse = await request('/api/auth/session');
  const session = await sessionResponse.json();
  assert(session.user?.id, 'Existing student test account could not authenticate');
  const results = [];
  for (const card of cards) {
    const query = new URLSearchParams({ projection: projection.projectionId, projectionHash: projection.projectionHash,
      snapshot: authority.snapshotId, snapshotHash: authority.snapshotHash, resourceVersion: card.cardSha256 });
    const response = await request(`/learning-resources/${encodeURIComponent(card.resourceId)}?${query}`);
    const html = await response.text();
    assert.equal(response.status, 200, card.name);
    assert(!html.includes('class="katex-error"'), `Rendered math error: ${card.name}`);
    if (!html.includes('核对要点') || !html.includes('自检')) { console.log(JSON.stringify({name:card.name, bytes:html.length, unavailable:html.includes('资源暂不可用'), login:html.includes('登录'), title:html.match(/<title>(.*?)<\/title>/)?.[1], hasDefinition:html.includes('零初始条件')})); }
    assert(html.includes('核对要点') && html.includes('自检'), `Full authored content not served: ${card.name}`);
    assert(!html.includes('该资源版本无法验证。'), card.name);
    results.push({ name: card.name, resourceId: card.resourceId, status: response.status, authoredContentServed: true });
    console.log(`PASS page: ${card.name}`);
  }
  writeFileSync(join(batch, 'http-verification.json'), JSON.stringify({ status: 'passed', baseUrl: base,
    authenticatedRole: session.user.role, method: 'authenticated HTTP GET of actual Next.js resource routes',
    completedReadingActions: 0, visualBrowserVerification: false, results }, null, 2) + '\n');
}
main().catch((error) => { console.error(error instanceof Error ? error.message : 'HTTP verification failed'); process.exitCode = 1; });
