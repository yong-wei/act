#!/usr/bin/env tsx

import { execFileSync } from 'node:child_process';
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { envelopeByName } from '../../src/lib/actkg-envelope/composite-envelope-registry';
import { createV022MapPointerBackend } from '../../src/lib/teaching-projection/publish/v022-production-cutover-backend';
import {
  createV022LivePointerBackend,
  materializeV022CutoverTrees,
} from '../../src/lib/teaching-projection/publish/v022-production-cutover-live';
import {
  V022_CUTOVER_COMPONENTS,
  V022_PRODUCTION_ACTIVATION_ID,
  V022_PROJECTION_ID,
  V022_SNAPSHOT,
  assertNoLearnerVisibleSystemIdentifiers,
  compensateV022ProductionCutover,
  createPreparedJournal,
  executeV022ProductionCutover,
  exerciseV022RollbackPath,
  preflightV022ProductionCutover,
  reviewedMembershipFromQualification,
  sealCutoverReceipt,
  type CutoverHostObservation,
  type CutoverJournal,
  type PointerIdentity,
  type V022CutoverComponent,
} from '../../src/lib/teaching-projection/publish/v022-production-cutover';
import { runLiveNamedConsumerShadowReads } from '../../src/lib/teaching-projection/qualify/v022-consumers';
import { V022_NAMED_CONSUMERS } from '../../src/lib/teaching-projection/qualify/v022-qualify-contract';
import { asRecord } from '../../src/lib/teaching-projection/qualify/v022-shared';

function option(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function fail(message: string): never {
  throw new Error(`v022 production cutover: ${message}`);
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

function collectObservation(root: string, backend: { read(component: V022CutoverComponent): PointerIdentity | null }): CutoverHostObservation {
  const hashes = Object.fromEntries(
    V022_CUTOVER_COMPONENTS.map((component) => [component, backend.read(component)?.fileSha256 ?? '']),
  ) as Record<V022CutoverComponent, string>;
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
    firstActivationCommitted: option(process.argv, '--first-activation-committed') === 'true',
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

function loginJar(publicUrl: string, accountKey: 'student' | 'teacher'): string {
  const { accountByKey } = require('../db/verified-test-accounts.mjs') as {
    accountByKey: (key: string) => { loginId: string; password: string };
  };
  const account = accountByKey(accountKey);
  const jar = `/tmp/v022-cutover-cookies-${accountKey}.txt`;
  const csrfRaw = execFileSync('curl', ['-fsS', '-c', jar, `${publicUrl}/api/auth/csrf`], { encoding: 'utf8' });
  const csrfToken = String((JSON.parse(csrfRaw) as { csrfToken?: string }).csrfToken ?? '');
  execFileSync('curl', [
    '-sS', '-b', jar, '-c', jar, '-o', '/dev/null',
    '-H', 'content-type: application/x-www-form-urlencoded',
    '--data-urlencode', `csrfToken=${csrfToken}`,
    '--data-urlencode', `email=${account.loginId}`,
    '--data-urlencode', `password=${account.password}`,
    '--data-urlencode', 'json=true',
    `${publicUrl}/api/auth/callback/credentials`,
  ], { encoding: 'utf8' });
  return jar;
}

function httpGet(publicUrl: string, jar: string, route: string, outFile: string): { status: number; body: string } {
  const status = Number(execFileSync('curl', [
    '-sS', '-o', outFile, '-w', '%{http_code}', '-b', jar, `${publicUrl}${route}`,
  ], { encoding: 'utf8' }));
  return { status, body: existsSync(outFile) ? readFileSync(outFile, 'utf8') : '' };
}

function verifyPublicV022(publicUrl: string, expected: { domainCount: number; membershipCount: number }): Record<string, unknown> {
  const studentJar = loginJar(publicUrl, 'student');
  const shardsGet = httpGet(publicUrl, studentJar, '/api/knowledge/shards/active', '/tmp/v022-cutover-shards.json');
  const shards = asRecord(shardsGet.status === 200 ? JSON.parse(shardsGet.body) : {});
  const root = asRecord(shards.root);
  const domains = Array.isArray(root.domains) ? root.domains as Array<Record<string, unknown>> : [];
  const labels = domains.map((row) => String(row.displayName ?? '')).filter(Boolean);
  const memberCounts = domains.map((row) => Number(row.memberCount ?? 0));
  const firstDomainId = String(domains[0]?.id ?? domains[0]?.domainId ?? 'system-modeling');
  const teachingGet = httpGet(
    publicUrl,
    studentJar,
    `/api/knowledge/shards/active/domains/${encodeURIComponent(firstDomainId)}`,
    '/tmp/v022-cutover-teaching.json',
  );
  const teaching = asRecord(teachingGet.status === 200 ? JSON.parse(teachingGet.body) : {});
  const teachingObjects = Array.isArray(teaching.objects) ? teaching.objects as Array<Record<string, unknown>> : [];
  const leaks = assertNoLearnerVisibleSystemIdentifiers([
    ...labels,
    ...teachingObjects.map((row) => String(row.label ?? row.displayName ?? '')),
  ]);
  const blockers: string[] = [];
  if (shardsGet.status !== 200) blockers.push('public-shards-http');
  if (labels.length !== expected.domainCount) blockers.push('public-domain-count-mismatch');
  if (memberCounts.some((count) => count <= 2)) blockers.push('public-legacy-membership-residual');
  if (teachingGet.status !== 200 || teachingObjects.length <= 2) blockers.push('public-teaching-http');
  if (leaks.length > 0) blockers.push('learner-visible-system-identifier');
  return {
    labels,
    domainCount: labels.length,
    memberCounts,
    teachingStatus: teachingGet.status,
    teachingObjectCount: teachingObjects.length,
    leaks,
    blockers,
  };
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

function observeReadyConsumers(root: string): { readyConsumerIds: string[]; blockers: string[] } {
  const v22 = envelopeByName('control-theory-engineering-v0.22');
  const pointer = JSON.parse(readFileSync(path.join(root, 'course-content/runtime/knowledge/consumer-activation/current.json'), 'utf8')) as { activationId: string };
  const activation = JSON.parse(readFileSync(path.join(
    root,
    'course-content/runtime/knowledge/consumer-activation/releases',
    pointer.activationId,
    'activation.json',
  ), 'utf8')) as {
    impact?: { readyConsumerIds?: string[] };
    consumers?: Array<{ consumerId?: string; status?: string; combination?: { authoritySnapshotId?: string } }>;
  };
  const readyConsumerIds = Array.isArray(activation.impact?.readyConsumerIds) ? activation.impact.readyConsumerIds : [];
  const blockers: string[] = [];
  if (JSON.stringify([...readyConsumerIds].sort()) !== JSON.stringify([...V022_NAMED_CONSUMERS].sort())) {
    blockers.push('named-consumers-mismatch');
  }
  for (const consumerId of V022_NAMED_CONSUMERS) {
    const row = (activation.consumers ?? []).find((item) => item.consumerId === consumerId);
    if (!row || row.status !== 'READY' || row.combination?.authoritySnapshotId !== v22.authoritySnapshotId) {
      blockers.push(`consumer-not-ready:${consumerId}`);
    }
  }
  return { readyConsumerIds, blockers };
}

function fetchReadyz(url: string): { app?: boolean; db?: boolean; redis?: boolean } {
  return JSON.parse(execFileSync('curl', ['-fsS', url], { encoding: 'utf8' })) as { app?: boolean; db?: boolean; redis?: boolean };
}

function collectPostSwitchObservations(root: string, publicUrl: string): {
  observations: Record<string, unknown>;
  blockers: string[];
} {
  const qualification = asRecord(JSON.parse(readFileSync(path.join(
    root,
    'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.22/qualification-readiness.json',
  ), 'utf8')));
  const expected = reviewedMembershipFromQualification(qualification);
  const observations: Record<string, unknown> = {};
  const blockers: string[] = [];
  const counts = observeLiveCounts(root);
  const consumers = observeReadyConsumers(root);
  const consumerBehavior = runLiveNamedConsumerShadowReads(root);
  const publicObs = verifyPublicV022(publicUrl, expected);
  const postReadyz = fetchReadyz(option(process.argv, '--readyz-url') ?? 'http://127.0.0.1:8084/api/readyz');
  const postPublicReadyz = fetchReadyz(`${publicUrl}/api/readyz`);
  observations.membership = expected;
  observations.objectCount = counts.objects;
  observations.relationCount = counts.relations;
  observations.readyConsumers = consumers.readyConsumerIds;
  observations.consumerBehavior = consumerBehavior.results.map((row) => ({
    consumerId: row.consumerId,
    status: row.status,
    reads: row.reads.map((read) => ({ kind: read.kind, ok: read.ok, detail: read.detail })),
  }));
  observations.public = publicObs;
  observations.postReadyz = postReadyz;
  observations.postPublicReadyz = postPublicReadyz;
  observations.activationId = V022_PRODUCTION_ACTIVATION_ID;
  observations.projectionId = V022_PROJECTION_ID;
  observations.snapshotId = V022_SNAPSHOT;
  if (postReadyz.app !== true || postReadyz.db !== true || postReadyz.redis !== true) blockers.push('post-readyz-not-ready');
  if (postPublicReadyz.app !== true || postPublicReadyz.db !== true || postPublicReadyz.redis !== true) {
    blockers.push('post-public-readyz-not-ready');
  }
  blockers.push(...consumers.blockers, ...consumerBehavior.blockers, ...(publicObs.blockers as string[]));
  return { observations, blockers };
}

function run(): void {
  const command = process.argv[2];
  const root = path.resolve(option(process.argv, '--root') ?? process.cwd());
  const outDir = path.resolve(option(process.argv, '--out') ?? path.join(
    root,
    'course-content/authoring/knowledge/cutover/runtime-releases/control-theory-engineering-v0.22',
  ));
  const journalPath = path.resolve(option(process.argv, '--journal') ?? path.join(outDir, 'production-cutover-journal.json'));
  const predecessorSource = (option(process.argv, '--predecessor-source') ?? 'host') as 'host' | 'local';
  const transactionId = option(process.argv, '--transaction-id') ?? `v022-cutover-${new Date().toISOString().replace(/[:.]/g, '')}`;
  const live = createV022LivePointerBackend(root);
  const observation = collectObservation(root, live);

  if (command === 'preflight') {
    mkdirSync(outDir, { recursive: true });
    const report = preflightV022ProductionCutover({
      repoRoot: root,
      observation,
      predecessorSource,
      requireFrozenImage: option(process.argv, '--require-frozen-image') === 'true',
    });
    writeFileSync(path.join(outDir, 'cutover-preflight.json'), `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.status !== 'READY') process.exitCode = 2;
    return;
  }

  if (command === 'rehearse') {
    const result = exerciseV022RollbackPath({
      live,
      rehearsal: createV022MapPointerBackend(),
      persistJournal: persistTo(journalPath.replace(/\.json$/, '.rehearsal.json')),
      transactionId,
    });
    process.stdout.write(`${JSON.stringify({ restored: result.restored, status: result.journal.status }, null, 2)}\n`);
    if (!result.restored) process.exitCode = 2;
    return;
  }

  if (command === 'activate') {
    const publicUrl = requiredOption('--public-url');
    const preflight = preflightV022ProductionCutover({
      repoRoot: root,
      observation,
      predecessorSource,
      requireFrozenImage: option(process.argv, '--require-frozen-image') === 'true',
    });
    if (preflight.status !== 'READY') fail(`preflight blocked: ${preflight.blockers.join(',')}`);
    const rehearsal = exerciseV022RollbackPath({
      live,
      rehearsal: createV022MapPointerBackend(),
      persistJournal: persistTo(journalPath.replace(/\.json$/, '.rehearsal.json')),
      transactionId,
    });
    if (!rehearsal.restored) fail('rollback rehearsal did not restore predecessor bytes');
    const predecessorDir = path.join(outDir, 'predecessor-bytes');
    mkdirSync(predecessorDir, { recursive: true });
    const catalogFiles = {
      catalog: path.join(root, 'course-content/runtime/knowledge/authority-domain-catalog/catalog.json'),
      current: path.join(root, 'course-content/runtime/knowledge/authority-domain-catalog/current.json'),
    };
    for (const [name, filePath] of Object.entries(catalogFiles)) {
      if (existsSync(filePath)) writeFileSync(path.join(predecessorDir, `catalog-${name}.json`), readFileSync(filePath));
    }
    const predecessors = Object.fromEntries(
      V022_CUTOVER_COMPONENTS.map((component) => {
        const pointer = live.read(component);
        if (!pointer) fail(`missing live predecessor ${component}`);
        writeFileSync(path.join(predecessorDir, `${component}.json`), pointer.bytes);
        return [component, pointer];
      }),
    ) as Record<V022CutoverComponent, PointerIdentity>;
    process.stderr.write('materialize: start\n');
    let materialized: ReturnType<typeof materializeV022CutoverTrees>;
    try {
      materialized = materializeV022CutoverTrees({
        repoRoot: root,
        candidateRoot: option(process.argv, '--candidate-root') ?? root,
      });
    } catch (error) {
      if (existsSync(path.join(predecessorDir, 'catalog-current.json'))) restoreCatalog(root, predecessorDir);
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
      journal = executeV022ProductionCutover({
        backend: live,
        journal,
        persistJournal: persist,
        predecessors,
      });
    } catch (error) {
      process.stderr.write(`activate failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
      if (existsSync(path.join(predecessorDir, 'catalog-current.json'))) restoreCatalog(root, predecessorDir);
      const persisted = JSON.parse(readFileSync(journalPath, 'utf8')) as CutoverJournal;
      journal = persisted.status === 'BLOCKED_RECOVERY' || persisted.status === 'ROLLED_BACK'
        ? persisted
        : compensateV022ProductionCutover({
          backend: live,
          journal: persisted,
          persistJournal: persist,
          predecessors,
        });
      writeReceipt(outDir, sealCutoverReceipt({
        journal,
        blockers: [error instanceof Error ? error.message : String(error)],
      }));
      throw error;
    }
    let observations: Record<string, unknown> = {};
    let blockers: string[] = [];
    try {
      const collected = collectPostSwitchObservations(root, publicUrl);
      observations = collected.observations;
      blockers = collected.blockers;
    } catch (error) {
      blockers.push(error instanceof Error ? error.message : String(error));
    }
    if (blockers.length > 0) {
      if (existsSync(path.join(predecessorDir, 'catalog-current.json'))) restoreCatalog(root, predecessorDir);
      journal = compensateV022ProductionCutover({ backend: live, journal, persistJournal: persist, predecessors });
    }
    const receipt = sealCutoverReceipt({ journal, observations, blockers });
    writeReceipt(outDir, receipt);
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
    if (receipt.status !== 'READY') process.exitCode = 2;
    return;
  }

  if (command === 'verify') {
    const publicUrl = requiredOption('--public-url');
    const collected = collectPostSwitchObservations(root, publicUrl);
    writeFileSync(path.join(outDir, 'cutover-verification.json'), `${JSON.stringify(collected, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(collected, null, 2)}\n`);
    if (collected.blockers.length > 0) process.exitCode = 2;
    return;
  }

  fail('expected preflight|rehearse|activate|verify');
}

run();
