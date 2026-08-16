#!/usr/bin/env tsx

import { execFileSync } from 'node:child_process';
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { createMapPointerBackend } from '../../src/lib/teaching-projection/publish/v018-production-cutover-backend';
import {
  createLivePointerBackend,
  materializeV018CutoverTrees,
} from '../../src/lib/teaching-projection/publish/v018-production-cutover-live';
import {
  V018_CUTOVER_COMPONENTS,
  V018_EXPECTED_OBJECT_COUNT,
  V018_EXPECTED_RELATION_COUNT,
  assertNoLearnerVisibleSystemIdentifiers,
  compensateV018ProductionCutover,
  createPreparedJournal,
  executeV018ProductionCutover,
  exerciseV018RollbackPath,
  expectedPredecessorHashes,
  pointerIdentityFromBytes,
  preflightV018ProductionCutover,
  sealCutoverReceipt,
  type CutoverHostObservation,
  type CutoverJournal,
  type PointerIdentity,
  type V018CutoverComponent,
} from '../../src/lib/teaching-projection/publish/v018-production-cutover';
import {
  V09_PUBLIC_DOMAIN_LABELS,
} from '../../src/lib/teaching-projection/publish/v018-host-shadow';

function option(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function fail(message: string): never {
  throw new Error(`v018 production cutover: ${message}`);
}

function persistTo(filePath: string): (journal: CutoverJournal) => CutoverJournal {
  mkdirSync(path.dirname(filePath), { recursive: true });
  return (journal) => {
    const tmp = `${filePath}.${process.pid}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(journal, null, 2)}\n`);
    const fd = openSync(tmp, 'r+');
    try { fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(tmp, filePath);
    const dirFd = openSync(path.dirname(filePath), 'r');
    try { fsyncSync(dirFd); } finally { closeSync(dirFd); }
    return JSON.parse(readFileSync(filePath, 'utf8')) as CutoverJournal;
  };
}

function requiredOption(name: string): string {
  const value = option(process.argv, name);
  if (!value) fail(`${name} is required`);
  return value;
}

function collectObservation(root: string, backend: { read(component: V018CutoverComponent): PointerIdentity | null }): CutoverHostObservation {
  const hashes = Object.fromEntries(
    V018_CUTOVER_COMPONENTS.map((component) => [component, backend.read(component)?.fileSha256 ?? '']),
  ) as Record<V018CutoverComponent, string>;
  const readyzRaw = option(process.argv, '--readyz-json');
  let readyz: CutoverHostObservation['readyz'];
  if (readyzRaw) {
    const parsed = JSON.parse(readyzRaw) as { app?: boolean; db?: boolean; redis?: boolean };
    readyz = { app: parsed.app === true, db: parsed.db === true, redis: parsed.redis === true };
  }
  return {
    appImage: option(process.argv, '--app-image'),
    appImageId: option(process.argv, '--app-image-id'),
    workerImage: option(process.argv, '--worker-image'),
    workerImageId: option(process.argv, '--worker-image-id'),
    workerHealth: option(process.argv, '--worker-health'),
    readyz,
    predecessorFileHashes: hashes,
    firstActivationCommitted: option(process.argv, '--first-activation-committed') !== 'false',
    markerPresent: option(process.argv, '--marker-present') === 'true',
    lockHeld: option(process.argv, '--lock-held') === 'true',
  };
}

function writeReceipt(outDir: string, receipt: unknown): void {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'cutover-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
}

function restoreCatalog(root: string, predecessorDir: string): void {
  const catalogDir = path.join(root, 'course-content/runtime/knowledge/authority-domain-catalog');
  writeFileSync(path.join(catalogDir, 'catalog.json'), readFileSync(path.join(predecessorDir, 'catalog-catalog.json')));
  writeFileSync(path.join(catalogDir, 'current.json'), readFileSync(path.join(predecessorDir, 'catalog-current.json')));
}

function verifyPublicV018(publicUrl: string): Record<string, unknown> {
  const { accountByKey } = require('../db/verified-test-accounts.mjs') as {
    accountByKey: (key: string) => { loginId: string; password: string };
  };
  const student = accountByKey('student');
  const jar = '/tmp/v018-cutover-cookies.txt';
  const csrfRaw = execFileSync('curl', ['-fsS', '-c', jar, `${publicUrl}/api/auth/csrf`], { encoding: 'utf8' });
  const csrfToken = String((JSON.parse(csrfRaw) as { csrfToken?: string }).csrfToken ?? '');
  execFileSync('curl', [
    '-sS', '-b', jar, '-c', jar, '-o', '/dev/null',
    '-H', 'content-type: application/x-www-form-urlencoded',
    '--data-urlencode', `csrfToken=${csrfToken}`,
    '--data-urlencode', `email=${student.loginId}`,
    '--data-urlencode', `password=${student.password}`,
    '--data-urlencode', 'json=true',
    `${publicUrl}/api/auth/callback/credentials`,
  ], { encoding: 'utf8' });
  const shards = JSON.parse(execFileSync('curl', ['-fsS', '-b', jar, `${publicUrl}/api/knowledge/shards/active`], { encoding: 'utf8' }));
  const domains = Array.isArray(shards?.root?.domains) ? shards.root.domains : [];
  const labels = domains.map((row: { displayName?: string }) => String(row.displayName ?? '')).filter(Boolean);
  const teachingRaw = execFileSync('curl', [
    '-sS', '-o', '/tmp/v018-cutover-teaching.json', '-w', '%{http_code}',
    '-b', jar,
    `${publicUrl}/api/knowledge/shards/active/domains/modeling`,
  ], { encoding: 'utf8' });
  const leaks = assertNoLearnerVisibleSystemIdentifiers(labels);
  const blockers: string[] = [];
  if (labels.length !== 8) blockers.push('public-label-count');
  if (V09_PUBLIC_DOMAIN_LABELS.some((label) => !labels.includes(label))) blockers.push('public-label-missing');
  if (teachingRaw !== '200') blockers.push('public-teaching-http');
  if (leaks.length > 0) blockers.push('learner-visible-system-identifier');
  return { labels, teachingStatus: Number(teachingRaw), leaks, blockers };
}

function observeLiveCounts(root: string): { objects: number; relations: number } {
  const authority = JSON.parse(readFileSync(path.join(root, 'course-content/authoring/knowledge/authority/current.json'), 'utf8')) as { snapshotId: string };
  const engineering = JSON.parse(readFileSync(path.join(
    root,
    'course-content/authoring/knowledge/authority/releases',
    authority.snapshotId,
    'engineering.json',
  ), 'utf8')) as { objects?: unknown[]; relations?: unknown[] };
  return {
    objects: Array.isArray(engineering.objects) ? engineering.objects.length : -1,
    relations: Array.isArray(engineering.relations) ? engineering.relations.length : -1,
  };
}

function observeReadyConsumers(root: string): string[] {
  const pointer = JSON.parse(readFileSync(path.join(root, 'course-content/runtime/knowledge/consumer-activation/current.json'), 'utf8')) as { activationId: string };
  const activation = JSON.parse(readFileSync(path.join(
    root,
    'course-content/runtime/knowledge/consumer-activation/releases',
    pointer.activationId,
    'activation.json',
  ), 'utf8')) as { impact?: { readyConsumerIds?: string[] } };
  return Array.isArray(activation.impact?.readyConsumerIds) ? activation.impact.readyConsumerIds : [];
}

function run(): void {
  const command = process.argv[2];
  const root = path.resolve(option(process.argv, '--root') ?? process.cwd());
  const outDir = path.resolve(option(process.argv, '--out') ?? path.join(root, 'course-content/authoring/knowledge/cutover/runtime-releases/control-theory-engineering-v0.18'));
  const journalPath = path.resolve(option(process.argv, '--journal') ?? path.join(outDir, 'production-cutover-journal.json'));
  const predecessorSource = (option(process.argv, '--predecessor-source') ?? 'host') as 'host' | 'local';
  const transactionId = option(process.argv, '--transaction-id') ?? `v018-cutover-${new Date().toISOString().replace(/[:.]/g, '')}`;
  const live = createLivePointerBackend(root);
  const observation = collectObservation(root, live);

  if (command === 'preflight') {
    mkdirSync(outDir, { recursive: true });
    const report = preflightV018ProductionCutover({
      repoRoot: root,
      observation,
      predecessorSource,
      requireFrozenImage: option(process.argv, '--require-frozen-image') !== 'false',
    });
    writeFileSync(path.join(outDir, 'cutover-preflight.json'), `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.status !== 'READY') process.exitCode = 2;
    return;
  }

  if (command === 'rehearse') {
    const rehearsal = createMapPointerBackend({});
    const result = exerciseV018RollbackPath({
      live,
      rehearsal,
      persistJournal: persistTo(journalPath.replace(/\.json$/, '.rehearsal.json')),
      transactionId,
    });
    process.stdout.write(`${JSON.stringify({ restored: result.restored, status: result.journal.status }, null, 2)}\n`);
    if (!result.restored) process.exitCode = 2;
    return;
  }

  if (command === 'activate') {
    const preflight = preflightV018ProductionCutover({
      repoRoot: root,
      observation,
      predecessorSource,
      requireFrozenImage: option(process.argv, '--require-frozen-image') !== 'false',
    });
    if (preflight.status !== 'READY') fail(`preflight blocked: ${preflight.blockers.join(',')}`);
    const rehearsal = exerciseV018RollbackPath({
      live,
      rehearsal: createMapPointerBackend({}),
      persistJournal: persistTo(journalPath.replace(/\.json$/, '.rehearsal.json')),
      transactionId,
    });
    if (!rehearsal.restored) fail('rollback rehearsal did not restore v0.9 bytes');
    const predecessorDir = path.join(outDir, 'predecessor-bytes');
    mkdirSync(predecessorDir, { recursive: true });
    const catalogFiles = {
      catalog: path.join(root, 'course-content/runtime/knowledge/authority-domain-catalog/catalog.json'),
      current: path.join(root, 'course-content/runtime/knowledge/authority-domain-catalog/current.json'),
    };
    for (const [name, filePath] of Object.entries(catalogFiles)) {
      writeFileSync(path.join(predecessorDir, `catalog-${name}.json`), readFileSync(filePath));
    }
    const predecessors = Object.fromEntries(
      V018_CUTOVER_COMPONENTS.map((component) => {
        const pointer = live.read(component);
        if (!pointer) fail(`missing live predecessor ${component}`);
        writeFileSync(path.join(predecessorDir, `${component}.json`), pointer.bytes);
        return [component, pointer];
      }),
    ) as Record<V018CutoverComponent, PointerIdentity>;
    process.stderr.write('materialize: start\n');
    let materialized: ReturnType<typeof materializeV018CutoverTrees>;
    try {
      materialized = materializeV018CutoverTrees({
        repoRoot: root,
        candidateRoot: option(process.argv, '--candidate-root') ?? root,
      });
    } catch (error) {
      restoreCatalog(root, predecessorDir);
      throw error;
    }
    process.stderr.write(`materialize: shardSet=${materialized.shardSetId}\n`);
    const persist = persistTo(journalPath);
    let journal = createPreparedJournal({
      transactionId,
      predecessors,
      targetOverrides: {
        'authority-domain-shards': {
          id: materialized.shardSetId,
          hash: materialized.shardSetHash,
        },
      },
    });
    try {
      journal = executeV018ProductionCutover({
        backend: live,
        journal,
        persistJournal: persist,
        predecessors,
      });
    } catch (error) {
      process.stderr.write(`activate failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
      restoreCatalog(root, predecessorDir);
      journal = compensateV018ProductionCutover({ backend: live, journal, persistJournal: persist, predecessors });
      writeReceipt(outDir, sealCutoverReceipt({
        journal,
        blockers: [error instanceof Error ? error.message : String(error)],
      }));
      throw error;
    }
    const publicUrl = requiredOption('--public-url');
    const counts = observeLiveCounts(root);
    const readyConsumers = observeReadyConsumers(root);
    const publicObs = verifyPublicV018(publicUrl);
    const observations: Record<string, unknown> = {
      expectedObjectCount: V018_EXPECTED_OBJECT_COUNT,
      expectedRelationCount: V018_EXPECTED_RELATION_COUNT,
      objectCount: counts.objects,
      relationCount: counts.relations,
      readyConsumers,
      expectedHashes: expectedPredecessorHashes(predecessorSource),
      public: publicObs,
      workerHealth: observation.workerHealth,
      readyz: observation.readyz,
    };
    const blockers: string[] = [];
    if (counts.objects !== V018_EXPECTED_OBJECT_COUNT) blockers.push('object-count-mismatch');
    if (counts.relations !== V018_EXPECTED_RELATION_COUNT) blockers.push('relation-count-mismatch');
    if (readyConsumers.length !== 6) blockers.push('consumer-ready-incomplete');
    if (observation.workerHealth !== 'healthy') blockers.push('worker-unhealthy');
    if (observation.readyz?.app !== true || observation.readyz.db !== true || observation.readyz.redis !== true) {
      blockers.push('readyz-not-ready');
    }
    blockers.push(...(publicObs.blockers as string[]));
    if (blockers.length > 0) {
      restoreCatalog(root, predecessorDir);
      journal = compensateV018ProductionCutover({ backend: live, journal, persistJournal: persist, predecessors });
    }
    const receipt = sealCutoverReceipt({ journal, observations, blockers });
    writeReceipt(outDir, receipt);
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
    if (receipt.status !== 'READY') process.exitCode = 2;
    return;
  }

  if (command === 'rollback') {
    const predecessorDir = path.join(outDir, 'predecessor-bytes');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as CutoverJournal;
    const predecessors = Object.fromEntries(
      V018_CUTOVER_COMPONENTS.map((component) => {
        const bytes = readFileSync(path.join(predecessorDir, `${component}.json`));
        return [component, pointerIdentityFromBytes(component, bytes)];
      }),
    ) as Record<V018CutoverComponent, PointerIdentity>;
    restoreCatalog(root, predecessorDir);
    const rolled = compensateV018ProductionCutover({
      backend: live,
      journal,
      persistJournal: persistTo(journalPath),
      predecessors,
    });
    writeReceipt(outDir, sealCutoverReceipt({ journal: rolled }));
    process.stdout.write(`${JSON.stringify({ status: rolled.status, journalHash: rolled.journalHash }, null, 2)}\n`);
    if (rolled.status !== 'ROLLED_BACK') process.exitCode = 2;
    return;
  }

  fail('expected one of: preflight, rehearse, activate, rollback');
}

try {
  run();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
}
