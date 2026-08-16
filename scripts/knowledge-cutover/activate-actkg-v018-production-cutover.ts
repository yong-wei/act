#!/usr/bin/env tsx

import { execFileSync } from 'node:child_process';
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
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
  V018_PROJECTION_ID,
  V018_TARGET_IDENTITIES,
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
import {
  V018_RELEASE_ID,
  V018_SNAPSHOT,
} from '../../src/lib/teaching-projection/qualify/v018-shared';
import { runLiveNamedConsumerShadowReads } from '../../src/lib/teaching-projection/qualify/v018-consumers';
import { V018_NAMED_CONSUMERS } from '../../src/lib/teaching-projection/qualify/v018-qualify-contract';

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
  const jar = `/tmp/v018-cutover-cookies-${accountKey}.txt`;
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

function httpGet(
  publicUrl: string,
  jar: string,
  route: string,
  outFile: string,
): { status: number; body: string } {
  const status = Number(execFileSync('curl', [
    '-sS',
    '-o', outFile,
    '-w', '%{http_code}',
    '-b', jar,
    `${publicUrl}${route}`,
  ], { encoding: 'utf8' }));
  return { status, body: existsSync(outFile) ? readFileSync(outFile, 'utf8') : '' };
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function verifyPublicV018(publicUrl: string): Record<string, unknown> {
  const studentJar = loginJar(publicUrl, 'student');
  const teacherJar = loginJar(publicUrl, 'teacher');
  const shardsGet = httpGet(publicUrl, studentJar, '/api/knowledge/shards/active', '/tmp/v018-cutover-shards.json');
  const shards = asObject(shardsGet.status === 200 ? JSON.parse(shardsGet.body) : {});
  const root = asObject(shards.root);
  const domains = Array.isArray(root.domains) ? root.domains as Array<Record<string, unknown>> : [];
  const labels = domains.map((row) => String(row.displayName ?? '')).filter(Boolean);
  const teachingGet = httpGet(
    publicUrl,
    studentJar,
    '/api/knowledge/shards/active/domains/modeling',
    '/tmp/v018-cutover-teaching.json',
  );
  const teaching = asObject(teachingGet.status === 200 ? JSON.parse(teachingGet.body) : {});
  const teachingObjects = Array.isArray(teaching.objects) ? teaching.objects as Array<Record<string, unknown>> : [];
  const nodeIds = teachingObjects.map((row) => String(row.id ?? '')).filter(Boolean);
  const probeNodeId = nodeIds[0] ?? '';
  let cardGet = { status: 0, body: '' };
  let cardNode: Record<string, unknown> = {};
  let neighborhoodGet = { status: 0, body: '' };
  let neighborhood: Record<string, unknown> = {};
  let neighborhoodRelations: unknown[] = [];
  for (const nodeId of nodeIds.slice(0, 8)) {
    if (!cardNode.id) {
      cardGet = httpGet(publicUrl, studentJar, `/api/knowledge/shards/active/nodes/${encodeURIComponent(nodeId)}`, '/tmp/v018-cutover-card.json');
      const card = asObject(cardGet.status === 200 ? JSON.parse(cardGet.body) : {});
      cardNode = asObject(card.node);
    }
    if (neighborhoodRelations.length === 0) {
      neighborhoodGet = httpGet(publicUrl, studentJar, `/api/knowledge/shards/active/neighborhoods/${encodeURIComponent(nodeId)}`, '/tmp/v018-cutover-neighborhood.json');
      neighborhood = asObject(neighborhoodGet.status === 200 ? JSON.parse(neighborhoodGet.body) : {});
      neighborhoodRelations = [
        ...(Array.isArray(neighborhood.relations) ? neighborhood.relations : []),
        ...(Array.isArray(neighborhood.teachingRelations) ? neighborhood.teachingRelations : []),
      ];
    }
    if (cardNode.id && neighborhoodRelations.length > 0) break;
  }
  let infographStatus = 0;
  let infographNodeId = '';
  let infographPng = false;
  for (const nodeId of nodeIds.slice(0, 8)) {
    const result = httpGet(
      publicUrl,
      studentJar,
      `/api/knowledge/shards/active/nodes/${encodeURIComponent(nodeId)}/infograph`,
      '/tmp/v018-cutover-infograph.bin',
    );
    infographStatus = result.status;
    if (result.status === 200 && readFileSync('/tmp/v018-cutover-infograph.bin').subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      infographNodeId = nodeId;
      infographPng = true;
      break;
    }
  }
  const konlingRoute = probeNodeId
    ? `/api/ai/konling-context?selectedNodeId=${encodeURIComponent(probeNodeId)}&status=selected-node`
    : '/api/ai/konling-context';
  const konlingGet = httpGet(publicUrl, teacherJar, konlingRoute, '/tmp/v018-cutover-konling.json');
  const konling = asObject(konlingGet.status === 200 ? JSON.parse(konlingGet.body) : {});
  const teachingContext = asObject(konling.teaching_projection_context);
  const courseGet = httpGet(
    publicUrl,
    teacherJar,
    `/api/ai/konling-context?courseId=${encodeURIComponent('unit-1-1-see-the-full-picture')}`,
    '/tmp/v018-cutover-course.json',
  );
  const courseContext = asObject(
    courseGet.status === 200
      ? asObject(JSON.parse(courseGet.body)).teaching_projection_context
      : {},
  );
  const leaks = assertNoLearnerVisibleSystemIdentifiers([
    ...labels,
    String(cardNode.label ?? ''),
  ]);
  const blockers: string[] = [];
  if (labels.length !== 8) blockers.push('public-label-count');
  if (V09_PUBLIC_DOMAIN_LABELS.some((label) => !labels.includes(label))) blockers.push('public-label-missing');
  if (teachingGet.status !== 200 || teachingObjects.length === 0) blockers.push('public-teaching-http');
  if (cardGet.status !== 200 || !cardNode.id || !cardNode.label) blockers.push('public-card-payload');
  if (neighborhoodGet.status !== 200 || !neighborhood.nodeId || neighborhoodRelations.length === 0) {
    blockers.push('public-prerequisite-payload');
  }
  if (!infographPng) blockers.push('public-infograph-payload');
  if (
    konlingGet.status !== 200
    || teachingContext.authoritySnapshotId !== V018_SNAPSHOT
    || teachingContext.authorityReleaseId !== V018_RELEASE_ID
    || teachingContext.projectionId !== V018_PROJECTION_ID
  ) {
    blockers.push('public-konling-identity');
  }
  if (
    courseGet.status !== 200
    || courseContext.authoritySnapshotId !== V018_SNAPSHOT
    || courseContext.projectionId !== V018_PROJECTION_ID
  ) {
    blockers.push('public-course-runtime-identity');
  }
  if (!Array.isArray(teachingContext.prerequisiteAncestors) && !Array.isArray(teachingContext.prerequisiteSuccessors)) {
    blockers.push('public-learning-path-payload');
  }
  if (leaks.length > 0) blockers.push('learner-visible-system-identifier');
  return {
    labels,
    teachingStatus: teachingGet.status,
    teachingObjectCount: teachingObjects.length,
    cardStatus: cardGet.status,
    neighborhoodStatus: neighborhoodGet.status,
    neighborhoodRelationCount: neighborhoodRelations.length,
    infographStatus,
    infographNodeId,
    infographPng,
    konlingStatus: konlingGet.status,
    konlingProjectionId: teachingContext.projectionId ?? null,
    konlingAuthoritySnapshotId: teachingContext.authoritySnapshotId ?? null,
    courseRuntimeStatus: courseGet.status,
    courseProjectionId: courseContext.projectionId ?? null,
    probeNodeId,
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

function observeReadyConsumers(root: string): {
  readyConsumerIds: string[];
  blockers: string[];
} {
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
  const expected = [...V018_NAMED_CONSUMERS].sort();
  if (JSON.stringify([...readyConsumerIds].sort()) !== JSON.stringify(expected)) {
    blockers.push('named-consumers-mismatch');
  }
  for (const consumerId of V018_NAMED_CONSUMERS) {
    const row = (activation.consumers ?? []).find((item) => item.consumerId === consumerId);
    if (!row || row.status !== 'READY' || row.combination?.authoritySnapshotId !== V018_TARGET_IDENTITIES.authority.id) {
      blockers.push(`consumer-not-ready:${consumerId}`);
    }
  }
  return { readyConsumerIds, blockers };
}

function fetchReadyz(url: string): { app?: boolean; db?: boolean; redis?: boolean } {
  const raw = execFileSync('curl', ['-fsS', url], { encoding: 'utf8' });
  return JSON.parse(raw) as { app?: boolean; db?: boolean; redis?: boolean };
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
    const publicUrl = requiredOption('--public-url');
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
      const persisted = JSON.parse(readFileSync(journalPath, 'utf8')) as CutoverJournal;
      journal = persisted.status === 'BLOCKED_RECOVERY' || persisted.status === 'ROLLED_BACK'
        ? persisted
        : compensateV018ProductionCutover({
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
    const observations: Record<string, unknown> = {};
    const blockers: string[] = [];
    try {
      const counts = observeLiveCounts(root);
      const consumers = observeReadyConsumers(root);
      const consumerBehavior = runLiveNamedConsumerShadowReads(root);
      const publicObs = verifyPublicV018(publicUrl);
      const postReadyz = fetchReadyz(option(process.argv, '--readyz-url') ?? 'http://127.0.0.1:8084/api/readyz');
      const postPublicReadyz = fetchReadyz(`${publicUrl}/api/readyz`);
      observations.expectedObjectCount = V018_EXPECTED_OBJECT_COUNT;
      observations.expectedRelationCount = V018_EXPECTED_RELATION_COUNT;
      observations.objectCount = counts.objects;
      observations.relationCount = counts.relations;
      observations.readyConsumers = consumers.readyConsumerIds;
      observations.consumerBehavior = consumerBehavior.results.map((row) => ({
        consumerId: row.consumerId,
        status: row.status,
        reads: row.reads.map((read) => ({ kind: read.kind, ok: read.ok, detail: read.detail })),
      }));
      observations.expectedHashes = expectedPredecessorHashes(predecessorSource);
      observations.public = publicObs;
      observations.postReadyz = postReadyz;
      observations.postPublicReadyz = postPublicReadyz;
      if (counts.objects !== V018_EXPECTED_OBJECT_COUNT) blockers.push('object-count-mismatch');
      if (counts.relations !== V018_EXPECTED_RELATION_COUNT) blockers.push('relation-count-mismatch');
      if (postReadyz.app !== true || postReadyz.db !== true || postReadyz.redis !== true) blockers.push('post-readyz-not-ready');
      if (postPublicReadyz.app !== true || postPublicReadyz.db !== true || postPublicReadyz.redis !== true) {
        blockers.push('post-public-readyz-not-ready');
      }
      blockers.push(
        ...consumers.blockers,
        ...consumerBehavior.blockers,
        ...(publicObs.blockers as string[]),
      );
    } catch (error) {
      blockers.push(error instanceof Error ? error.message : String(error));
    }
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
