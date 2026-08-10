import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  assertCapturePageUrl,
  assertCaptureRevisionUnchanged,
  assertSourcePathsExcludeOutput,
  assertTargetServiceReachable,
  createCaptureUrl,
  createDockReadinessTimeoutMessage,
  dockReadinessSatisfied,
  readCaptureRevision,
  resolveOutputDirectory,
  resolveTargetBaseUrl,
  waitForDockReadiness,
  type CaptureRevision,
  type DockReadinessSnapshot,
} from '../../../scripts/tests/capture-adaptive-path-product-qa';

function snapshot(overrides: Partial<DockReadinessSnapshot> = {}): DockReadinessSnapshot {
  return {
    targetUrl: 'http://127.0.0.1:3002/assessment/adaptive-practice?demo=1',
    actualUrl: 'http://127.0.0.1:3002/assessment/adaptive-practice?demo=1',
    dockPresent: false,
    dockVisible: false,
    dockState: null,
    registrationPresent: false,
    registrationBehavior: null,
    registeredControls: null,
    primaryPresent: false,
    primaryVisible: false,
    primaryDisabled: false,
    primaryLabel: null,
    missingSelectors: [
      '[data-platform-floating-dock]',
      '[data-platform-floating-dock-registration="true"]',
      '[data-platform-floating-dock] button[data-platform-floating-dock-primary="konling"]',
    ],
    ...overrides,
  };
}

function git(repositoryRoot: string, args: string[]) {
  return execFileSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function createRevisionFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'adaptive-path-capture-revision-'));
  mkdirSync(path.join(root, 'src'), { recursive: true });
  writeFileSync(path.join(root, 'src/page.tsx'), 'export const page = 1;\n');
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'capture-test@example.test']);
  git(root, ['config', 'user.name', 'Capture Test']);
  git(root, ['add', 'src/page.tsx']);
  git(root, ['commit', '-qm', 'fixture']);
  return root;
}

describe('adaptive-path QA capture contract', () => {
  it('requires an explicit target URL and rejects ambiguous values', () => {
    expect(() => resolveTargetBaseUrl(undefined)).toThrow(/ADAPTIVE_PATH_QA_BASE_URL/);
    expect(resolveTargetBaseUrl('http://localhost:3002/')).toBe('http://localhost:3002');
    expect(() => resolveTargetBaseUrl('localhost:3002')).toThrow(/http or https/);
    expect(() => resolveTargetBaseUrl('ftp://localhost:3002')).toThrow(/http or https/);
    expect(() => resolveTargetBaseUrl('http://user:secret@localhost:3002')).toThrow(/credentials/);

    const targetUrl = createCaptureUrl('http://localhost:3002', '?demo=1');
    expect(targetUrl).toBe('http://localhost:3002/assessment/adaptive-practice?demo=1');
    expect(() => assertCapturePageUrl(targetUrl, targetUrl.replace('3002', '3001'))).toThrow(/declared target/);
    expect(() => assertCapturePageUrl(targetUrl, 'http://localhost:3002/login')).toThrow(/declared target/);
    expect(() => assertCapturePageUrl(targetUrl, 'http://localhost:3002/assessment/adaptive-practice')).toThrow(/declared target/);
  });

  it('fails closed when the target service is unreachable', async () => {
    await expect(assertTargetServiceReachable('http://localhost:3002', async () => ({ status: 503 })))
      .rejects.toThrow(/http:\/\/localhost:3002.*HTTP 503/);
    await expect(assertTargetServiceReachable('http://localhost:3002', async () => {
      throw new Error('ECONNREFUSED');
    })).rejects.toThrow(/ECONNREFUSED/);
    await expect(assertTargetServiceReachable('http://localhost:3002', async () => ({ status: 307 })))
      .resolves.toBeUndefined();
  });

  it('waits through delayed dock registration instead of accepting the first DOM snapshot', async () => {
    const snapshots = [
      snapshot(),
      snapshot({ dockPresent: true, dockVisible: true, dockState: 'collapsed' }),
      snapshot({
        dockPresent: true,
        dockVisible: true,
        registrationPresent: true,
        registrationBehavior: 'enabled',
        registeredControls: 'konling',
        primaryPresent: true,
        primaryVisible: true,
        primaryDisabled: true,
        primaryLabel: '控灵助手',
        missingSelectors: [],
      }),
    ];
    let reads = 0;
    const result = await waitForDockReadiness(
      async () => snapshots[Math.min(reads++, snapshots.length - 1)],
      { targetUrl: snapshots[0].targetUrl, actualUrl: snapshots[0].actualUrl, pollIntervalMs: 0, sleep: async () => undefined },
    );

    expect(reads).toBe(3);
    expect(dockReadinessSatisfied(result)).toBe(true);
    expect(result.primaryDisabled).toBe(true);
  });

  it('reports target URL, observed dock state, and missing selectors on timeout', async () => {
    const observed = snapshot({
      dockPresent: true,
      dockVisible: true,
      dockState: 'collapsed',
      missingSelectors: ['[data-platform-floating-dock] button[data-platform-floating-dock-primary="konling"]'],
    });
    let currentTime = 0;
    await expect(waitForDockReadiness(
      async () => observed,
      {
        targetUrl: observed.targetUrl,
        actualUrl: observed.actualUrl,
        timeoutMs: 100,
        pollIntervalMs: 20,
        now: () => (currentTime += 60),
        sleep: async () => undefined,
      },
    )).rejects.toThrow(
      /targetUrl=http:\/\/127\.0\.0\.1:3002.*observedDock=.*collapsed.*missingSelectors=.*primary/u,
    );

    expect(createDockReadinessTimeoutMessage(observed, 100)).toContain('actualUrl=http://127.0.0.1:3002');
  });

  it('binds captures to a clean revision and excludes output artifacts from source inputs', () => {
    const fixtureRoot = createRevisionFixture();
    try {
      const sourceFiles = ['src/page.tsx'] as const;
      const outputDirectory = path.join(fixtureRoot, 'artifacts', 'capture');
      assertSourcePathsExcludeOutput(sourceFiles, outputDirectory, fixtureRoot);

      const revision = readCaptureRevision(fixtureRoot, sourceFiles);
      expect(revision.commitSha).toMatch(/^[0-9a-f]{40}$/u);
      expect(revision.treeSha).toMatch(/^[0-9a-f]{40}$/u);
      expect(revision.sourceFiles['src/page.tsx']).toBeTruthy();

      const matchingRevision: CaptureRevision = {
        ...revision,
        sourceFiles: { ...revision.sourceFiles },
      };
      expect(() => assertCaptureRevisionUnchanged(revision, matchingRevision)).not.toThrow();
      expect(() => assertSourcePathsExcludeOutput(['artifacts/capture/manifest.json'], outputDirectory, fixtureRoot))
        .toThrow(/output artifacts/);

      writeFileSync(path.join(fixtureRoot, 'src/page.tsx'), 'export const page = 2;\n');
      expect(() => readCaptureRevision(fixtureRoot, sourceFiles)).toThrow(/clean source tree|drifted/u);
      expect(() => readCaptureRevision(fixtureRoot, sourceFiles, [path.join(fixtureRoot, 'src/page.tsx')]))
        .toThrow(/clean source tree|drifted from HEAD/u);
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('defaults verification output outside the repository and resolves explicit paths', () => {
    const repositoryRoot = '/repo/act';
    expect(resolveOutputDirectory(undefined, repositoryRoot)).toContain(os.tmpdir());
    expect(resolveOutputDirectory('tmp/capture', repositoryRoot)).toBe('/repo/act/tmp/capture');
    expect(resolveOutputDirectory('/var/tmp/capture', repositoryRoot)).toBe('/var/tmp/capture');
  });
});
