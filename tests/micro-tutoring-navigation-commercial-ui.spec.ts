import 'dotenv/config';

import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const evidenceRoot = 'artifacts/commercial-ui/issue-1366-micro-tutoring-navigation';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3200';
const evidenceDir = join(process.cwd(), evidenceRoot, 'playwright');
const manifestPath = join(process.cwd(), evidenceRoot, 'evidence-manifest.json');
const screenshotsManifestPath = join(evidenceDir, 'screenshots.json');
const updateEvidence = process.env.UPDATE_VISUAL_EVIDENCE === '1';
const viewports = [
  { name: 'desktop-1440', width: 1440, height: 1000 },
  { name: 'mobile-320', width: 320, height: 900 },
] as const;
const themes = ['light', 'dark'] as const;
const expectedEvidenceFiles = viewports.flatMap((viewport) => themes.flatMap((theme) => [
  `student-home-${theme}-${viewport.name}.png`,
  `adaptive-practice-${theme}-${viewport.name}.png`,
]));
const sourceFiles = [
  'src/app/layout.tsx',
  'src/app/(main)/profile/page.tsx',
  'src/app/assessment/adaptive-practice/page.tsx',
  'src/components/providers/theme-provider.tsx',
  'src/features/assessment/micro-intervention-outcomes.ts',
  'src/features/assessment/remediation-orchestration.ts',
  'src/features/assessment/student-micro-tutoring-panel.tsx',
  'src/lib/theme-config.ts',
  'tests/micro-tutoring-navigation-commercial-ui.spec.ts',
] as const;

type Theme = typeof themes[number];
type SourceSnapshot = { revision: string; hashes: Record<string, string> };
type CapturedEvidence = {
  file: string;
  route: string;
  theme: Theme;
  viewport: string;
  width: number;
  height: number;
  sha256: string;
  noHorizontalOverflow: boolean;
  clientNavigation: boolean;
  noReactScriptTagConsoleError: boolean;
  image: Buffer;
};

const evidence: CapturedEvidence[] = [];
const captureSource = updateEvidence ? captureSourceSnapshot() : null;

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function currentHead(): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

function sourceHash(file: string): string {
  return sha256(readFileSync(join(process.cwd(), file)));
}

function sourceHashAtRevision(revision: string, file: string): string {
  return sha256(execFileSync('git', ['show', `${revision}:${file}`]));
}

function hasWorkingTreeRuntimeDrift(): boolean {
  const changes = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
    encoding: 'utf8',
  }).split('\n').filter(Boolean);
  return changes.some((change) => {
    const file = change.slice(3).replace(/^.* -> /, '');
    return file !== evidenceRoot && !file.startsWith(`${evidenceRoot}/`);
  });
}

function captureSourceSnapshot(): SourceSnapshot {
  if (hasWorkingTreeRuntimeDrift()) {
    throw new Error('Micro-tutoring navigation evidence capture requires clean tracked runtime inputs.');
  }
  const revision = currentHead();
  const hashes = Object.fromEntries(sourceFiles.map((file) => [file, sourceHash(file)]));
  for (const file of sourceFiles) {
    if (sourceHashAtRevision(revision, file) !== hashes[file]) {
      throw new Error(`Micro-tutoring navigation evidence capture source drift: ${file}`);
    }
  }
  return { revision, hashes };
}

function assertCaptureSourceSnapshot(snapshot: SourceSnapshot) {
  if (currentHead() !== snapshot.revision) {
    throw new Error('Micro-tutoring navigation evidence capture HEAD changed.');
  }
  if (hasWorkingTreeRuntimeDrift()) {
    throw new Error('Micro-tutoring navigation evidence capture tracked runtime inputs changed.');
  }
  for (const file of sourceFiles) {
    if (sourceHash(file) !== snapshot.hashes[file]) {
      throw new Error(`Micro-tutoring navigation evidence capture content changed: ${file}`);
    }
    if (sourceHashAtRevision(snapshot.revision, file) !== snapshot.hashes[file]) {
      throw new Error(`Micro-tutoring navigation evidence capture revision mismatch: ${file}`);
    }
  }
}

function validatePersistedEvidence() {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    commitSha?: string;
    sourceSha256?: Record<string, string>;
    screenshots?: Array<{ file: string; sha256: string }>;
  };
  const screenshotsManifest = JSON.parse(readFileSync(screenshotsManifestPath, 'utf8')) as {
    gitRevision?: string;
    evidence?: Array<{ file: string; sha256: string }>;
  };
  expect(manifest.commitSha).toMatch(/^[0-9a-f]{40}$/);
  expect(screenshotsManifest.gitRevision).toBe(manifest.commitSha);
  expect(hasWorkingTreeRuntimeDrift(), 'tracked runtime inputs must match HEAD').toBe(false);
  for (const file of sourceFiles) {
    expect(manifest.sourceSha256?.[file], `${file} source hash missing`).toBe(sourceHash(file));
  }
  expect(manifest.screenshots?.map((entry) => entry.file).sort()).toEqual(
    expectedEvidenceFiles.map((file) => `playwright/${file}`).sort(),
  );
  expect(screenshotsManifest.evidence?.map((entry) => entry.file).sort()).toEqual([...expectedEvidenceFiles].sort());
  for (const screenshot of manifest.screenshots ?? []) {
    const file = join(process.cwd(), evidenceRoot, screenshot.file);
    expect(existsSync(file), screenshot.file).toBe(true);
    expect(sha256(readFileSync(file))).toBe(screenshot.sha256);
  }
}

async function establishAuthenticatedSession(context: BrowserContext) {
  const csrfResponse = await context.request.get(`${baseURL}/api/auth/csrf`);
  const csrf = await csrfResponse.json() as { csrfToken?: string };
  expect(csrfResponse.ok()).toBe(true);
  expect(csrf.csrfToken).toBeTruthy();
  const loginResponse = await context.request.post(`${baseURL}/api/auth/callback/credentials?json=true`, {
    form: {
      csrfToken: csrf.csrfToken!,
      email: 'demo',
      password: 'DemoStudent@Just2026!',
      callbackUrl: baseURL,
      json: 'true',
    },
  });
  expect(loginResponse.ok(), `credentials login failed: ${loginResponse.status()}`).toBe(true);
}

async function assertTheme(page: Page, theme: Theme) {
  await expect(page.locator('html')).toHaveClass(new RegExp(`(^|\\s)${theme}(\\s|$)`));
  await expect.poll(() => page.evaluate(() => document.documentElement.style.colorScheme)).toBe(theme);
}

async function capture(
  page: Page,
  file: string,
  route: string,
  theme: Theme,
  viewport: typeof viewports[number],
  consoleErrors: string[],
  clientNavigation: boolean,
) {
  const screenshot = await page.screenshot({ fullPage: true });
  const metrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    bodyWidth: document.body.scrollWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  const scriptTagErrors = consoleErrors.filter((message) => (
    /Encountered a script tag while rendering React component/i.test(message)
  ));
  expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.viewport);
  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewport);
  expect(scriptTagErrors).toEqual([]);
  if (updateEvidence) {
    evidence.push({
      file,
      route,
      theme,
      viewport: viewport.name,
      width: viewport.width,
      height: viewport.height,
      sha256: sha256(screenshot),
      noHorizontalOverflow: true,
      clientNavigation,
      noReactScriptTagConsoleError: true,
      image: screenshot,
    });
  }
}

test.describe.configure({ mode: 'serial', timeout: 120_000 });

test.afterAll(() => {
  if (!updateEvidence) {
    validatePersistedEvidence();
    return;
  }
  expect(captureSource).not.toBeNull();
  expect(evidence).toHaveLength(expectedEvidenceFiles.length);
  assertCaptureSourceSnapshot(captureSource!);
  mkdirSync(evidenceDir, { recursive: true });
  const capturedAt = new Date().toISOString();
  const screenshotsManifest = `${JSON.stringify({
    capturedAt,
    gitRevision: captureSource!.revision,
    evidence: evidence.map(({ image: _image, ...entry }) => entry),
  }, null, 2)}\n`;
  const manifest = `${JSON.stringify({
    schemaVersion: 'commercial-ui-evidence.v1',
    capturedAt,
    commitSha: captureSource!.revision,
    captureMethod: 'Playwright with Google Chrome channel against local Next.js Webpack dev server',
    sourceSha256: captureSource!.hashes,
    routes: [
      { route: '/profile', purpose: 'Student shell entry and client-side practice navigation' },
      { route: '/assessment/adaptive-practice?intent=practice', purpose: 'Adaptive practice and micro-tutoring entry surface' },
    ],
    assertions: {
      initialThemeAndClientNavigationRemainConsistent: true,
      reactScriptTagConsoleErrorAbsent: true,
      noHorizontalOverflow: true,
    },
    screenshots: evidence.map(({ image: _image, file, sha256: hash, route, theme, viewport, width, height, clientNavigation }) => ({
      file: `playwright/${file}`,
      sha256: hash,
      route,
      theme,
      viewport,
      width,
      height,
      clientNavigation,
    })),
  }, null, 2)}\n`;
  const temporaryFiles = new Map<string, string>();
  try {
    for (const entry of evidence) {
      const target = join(evidenceDir, entry.file);
      const temporary = `${target}.${randomUUID()}.tmp`;
      writeFileSync(temporary, entry.image);
      temporaryFiles.set(target, temporary);
    }
    const screenshotsTemporary = `${screenshotsManifestPath}.${randomUUID()}.tmp`;
    writeFileSync(screenshotsTemporary, screenshotsManifest, 'utf8');
    temporaryFiles.set(screenshotsManifestPath, screenshotsTemporary);
    const manifestTemporary = `${manifestPath}.${randomUUID()}.tmp`;
    writeFileSync(manifestTemporary, manifest, 'utf8');
    temporaryFiles.set(manifestPath, manifestTemporary);
    assertCaptureSourceSnapshot(captureSource!);
    for (const [target, temporary] of temporaryFiles) renameSync(temporary, target);
    assertCaptureSourceSnapshot(captureSource!);
  } finally {
    for (const temporary of temporaryFiles.values()) {
      if (existsSync(temporary)) unlinkSync(temporary);
    }
  }
});

for (const viewport of viewports) {
  for (const theme of themes) {
    test(`captures ${theme} ${viewport.name} student entry and client navigation`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      const page = await context.newPage();
      const consoleErrors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      await page.addInitScript(({ storedTheme }) => {
        localStorage.setItem('ai-obe-theme', storedTheme);
      }, { storedTheme: theme });
      await establishAuthenticatedSession(context);

      await page.goto('/profile', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('link', { name: '执行下一步练习' })).toBeVisible();
      await assertTheme(page, theme);
      await capture(
        page,
        `student-home-${theme}-${viewport.name}.png`,
        '/profile',
        theme,
        viewport,
        consoleErrors,
        false,
      );

      await page.getByRole('link', { name: '执行下一步练习' }).click();
      await expect(page).toHaveURL(/\/assessment\/adaptive-practice/);
      await expect(page.locator('[data-commercial-student-entry-route="/assessment/adaptive-practice"]')).toBeVisible();
      await assertTheme(page, theme);
      await capture(
        page,
        `adaptive-practice-${theme}-${viewport.name}.png`,
        '/assessment/adaptive-practice?intent=practice',
        theme,
        viewport,
        consoleErrors,
        true,
      );
      await context.close();
    });
  }
}
