import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { chromium, expect } from '@playwright/test';
import { prisma } from '@/lib/prisma';
import type { CourseSessionRecoveryPayload } from '@/features/simulations/course-artifact-upload';

config({ path: '.env.local', quiet: true });
const origin = process.env.VESSEL_BROWSER_ORIGIN ?? 'http://127.0.0.1:3001';
assert(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname));
assert(['127.0.0.1', 'localhost'].includes(new URL(process.env.DATABASE_URL!).hostname));
assert(process.env.VESSEL_REPORT_RECOVERY_ID, 'Set VESSEL_REPORT_RECOVERY_ID to a completed local QA report');
const report = await prisma.virtualSimulationReport.findUniqueOrThrow({
  where: { id: process.env.VESSEL_REPORT_RECOVERY_ID }, include: { user: true },
});
assert(report.user.name?.includes('夹具'), 'Only an existing synthetic QA account may be used');
assert(report.clientRef && ['cruise', 'container', 'drilling'].includes(report.experimentKey));
const oldCredentials = { employeeNumber: report.user.employeeNumber, passwordHash: report.user.passwordHash };
const oldOrigins = new Set((await prisma.ilabExperimentRun.findMany({ where: { userId: report.userId }, select: { id: true } })).map((run) => run.id));
const employeeNumber = `QA-FULL-RECOVERY-${randomUUID()}`;
const password = randomBytes(24).toString('base64url');
const experimentKey = { cruise: 'cruise-comfort', container: 'container-voyage', drilling: 'drilling-dp' }[report.experimentKey]!;
const base = `account:${report.userId}:${experimentKey}:${report.experimentVersion}`;
const scopeKey = `${base}:round:${report.clientRef}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1801, height: 867 } });
await context.addInitScript(({ key, value }) => { localStorage.setItem(key, value); },
  { key: `act-vessel-course-round:${base}`, value: scopeKey });
const page = await context.newPage();
page.setDefaultTimeout(60000);
let chunks = 0;
let recovery: CourseSessionRecoveryPayload | null = null;
let recoveryBytes = 0;
page.on('response', (response) => {
  const url = new URL(response.url());
  if (url.pathname.startsWith('/api/ilab/experiment-runs/') && url.searchParams.has('chunkIndex')) chunks++;
});

async function waitForSavedReport() {
  const deadline = Date.now() + 600000;
  while (Date.now() < deadline) {
    const saved = await page.evaluate(async (scope) => {
      if (!(await indexedDB.databases()).some((db) => db.name === 'act-vessel-experiment-v2')) return false;
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('act-vessel-experiment-v2');
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      const draft = await new Promise<{ reportClientRef?: string } | undefined>((resolve, reject) => {
        const request = db.transaction('drafts').objectStore('drafts').get(scope);
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      db.close(); return Boolean(draft?.reportClientRef);
    }, scopeKey);
    if (saved) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('Full report recovery did not finish within the local QA timeout');
}

try {
  await prisma.user.update({ where: { id: report.userId }, data: { employeeNumber, passwordHash: await bcrypt.hash(password, 10) } });
  console.log(JSON.stringify({ phase: 'full-report-recovery', course: report.experimentKey }));
  const recoveryResponse = page.waitForResponse((response) => response.ok()
    && new URL(response.url()).pathname === '/api/ilab/course-session-recovery'
    && new URL(response.url()).searchParams.get('reportClientRef') === report.clientRef).then((response) => response.url());
  await page.goto(`${origin}/login?callbackUrl=${encodeURIComponent(`/simulations/${report.experimentKey}?graphics=webgl`)}`, { waitUntil: 'networkidle' });
  await page.getByPlaceholder('学号/工号').fill(employeeNumber);
  await page.getByPlaceholder('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.waitForURL((url) => url.pathname === `/simulations/${report.experimentKey}`, { waitUntil: 'domcontentloaded' });
  const responseText = await (await context.request.get(await recoveryResponse)).text();
  recoveryBytes = Buffer.byteLength(responseText);
  recovery = (JSON.parse(responseText) as { recovery: CourseSessionRecoveryPayload }).recovery;
  console.log(JSON.stringify({ phase: 'recovery-headers', bytes: recoveryBytes, runs: recovery.runs.length }));
  await waitForSavedReport();
  const payload = recovery as CourseSessionRecoveryPayload | null;
  assert(payload && payload.runs.length >= 20);
  assert(payload.runs.every((run) => run.trace.length === 0 && run.nativeSensorSamples.length === 0 && run.traceManifest));
  assert(recoveryBytes < 32 * 1024 * 1024);
  const stored = await page.evaluate(async (scope) => {
    const db = await new Promise<IDBDatabase>((resolve) => { const request = indexedDB.open('act-vessel-experiment-v2'); request.onsuccess = () => resolve(request.result); });
    const rows = await new Promise<Array<{ id: string; checkpoint: string; traceLength: number; nativeSampleCount: number; fineSampleCount?: number }>>((resolve) => {
      const request = db.transaction('runs').objectStore('runs').index('scopeKey').getAll(scope);
      request.onsuccess = () => resolve(request.result);
    });
    db.close();
    return Promise.all(rows.map(async (row) => ({ id: row.id, controlCount: row.traceLength, nativeCount: row.nativeSampleCount,
      fineCount: row.fineSampleCount ?? 0, checkpointHash: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(row.checkpoint))))
        .map((byte) => byte.toString(16).padStart(2, '0')).join('') })));
  }, scopeKey);
  assert.equal(stored.length, payload.runs.length);
  for (const run of payload.runs) {
    const local = stored.find((row) => row.id === run.id)!;
    assert(local);
    assert.equal(local.controlCount, run.traceManifest!.controlCount);
    assert.equal(local.nativeCount, run.traceManifest!.nativeCount);
    assert.equal(local.fineCount, run.traceManifest!.fineCount ?? 0);
    assert.equal(local.checkpointHash, createHash('sha256').update(run.checkpoint).digest('hex'));
  }
  const coldChunks = chunks;
  assert(coldChunks > 100);
  chunks = 0;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('tab', { name: '评估', exact: true }).click();
  await page.getByLabel('本机实验轮次', { exact: true }).waitFor();
  await expect(page.getByLabel('本机实验轮次', { exact: true })).toBeEnabled({ timeout: 60000 });
  await expect(page.getByLabel('分析运行记录', { exact: true }).locator('option')).toHaveCount(payload.runs.length + 1, { timeout: 60000 });
  assert.equal(chunks, 0, 'A matching cached report must reuse all local sampling chunks');
  console.log(JSON.stringify({ status: 'passed', course: report.experimentKey, recoveredRuns: stored.length,
    recoveryHeaderBytes: recoveryBytes, coldChunkRequests: coldChunks, hotChunkRequests: chunks, allCheckpointsExact: true }));
} catch (error) {
  console.log(JSON.stringify({ phase: 'full-report-recovery-failed', course: report.experimentKey,
    chunks, recoveryHeaderBytes: recoveryBytes, message: (await page.locator('body').innerText()).slice(-1800) }));
  throw error;
} finally {
  await context.close(); await browser.close();
  await prisma.user.update({ where: { id: report.userId }, data: oldCredentials });
  const added = (await prisma.ilabExperimentRun.findMany({ where: { userId: report.userId }, select: { id: true } }))
    .filter((run) => !oldOrigins.has(run.id)).map((run) => run.id);
  await prisma.ilabExperimentRun.deleteMany({ where: { id: { in: added } } });
  await prisma.$disconnect();
}
