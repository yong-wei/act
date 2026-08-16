/** Publish a cutover-capable runtime only after READY qualification. */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { reviewedNeighborhoodOverlaySha256 } from '../../authority-domain-shards/v018-reviewed-neighborhood-labels';
import { expectedHostPointerHashes, loadHostShadowVerificationReport } from './v018-host-shadow';
import { projectionDigest, projectionSha256 } from '../hash';
import {
  assertV018ProductionPointersUnchanged,
  snapshotCurrentPointers,
} from '../qualify/v018-qualify';
import {
  V09_ACTIVATION,
  V09_PREREQUISITE,
  V09_PROJECTION,
  V09_RELEASE_ID,
  V09_SHARD_SET,
  V09_SNAPSHOT,
  asRecord,
  readJson,
  shaFile,
  writeCanonical,
} from '../qualify/v018-shared';

export const V018_RUNTIME_RELEASE_CONTRACT = 'actkg-v018-runtime-release/v1' as const;
export const V018_QUALIFICATION_CONTRACT = 'actkg-v018-cutover-qualification/v1' as const;
export const V018_SEALED_QUALIFICATION_SHA256 =
  '1444318cc2a62b10bc1c5f358592da59d2c6706d0677c898c7bc54486c5cc3b1';
export const DOCKER_MIN_MEMORY_BYTES = 20 * 1024 * 1024 * 1024;
export const V09_POINTER_HASHES = {
  'course-content/authoring/knowledge/authority/current.json':
    '086f14793fbf2aa3afc8fba471503042242645122425c3018b6526e8ab2835f2',
  'course-content/runtime/knowledge/projection/current.json':
    'cf553630400a297d678a2927940e011e300e756aa59cd46bccac8489dd6ac703',
  'course-content/runtime/knowledge/prerequisites/current.json':
    'a040258e8efef848de45b7b933e0231519d416bd0d9b7c8a3ebb433abb1e6e0e',
  'course-content/runtime/knowledge/authority-domain-shards/current.json':
    '9613304cbaee9c3e41908f1a73a0a76b886608638ec992c7ad074e656711783c',
  'course-content/runtime/knowledge/consumer-activation/current.json':
    'e73ac1abd0d691c615308b215f1941ca5bea9b125cb98b844a0b5d969c6fbc0b',
} as const;

export class V018RuntimeReleaseError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'V018RuntimeReleaseError';
    this.code = code;
  }
}

export interface DockerMemoryReader {
  (): number;
}

export interface BuildRunner {
  (input: { repoRoot: string; imageTag: string }): Promise<{
    imageTag: string;
    provenancePath: string | null;
    imageTarPath: string | null;
  }>;
}

function gitRevParse(repoRoot: string, arg: string): string {
  return execFileSync('git', ['-C', repoRoot, 'rev-parse', arg], {
    encoding: 'utf8',
  }).trim();
}

function resolveFrozenApplicationRevision(
  repoRoot: string,
  requested: string | undefined,
  head: string,
): { revision: string; tree: string; blockers: string[] } {
  const revision = requested?.trim() || head;
  if (!/^[0-9a-f]{40}$/.test(revision)) {
    return {
      revision: head,
      tree: gitRevParse(repoRoot, `${head}^{tree}`),
      blockers: ['frozen-application-revision-invalid'],
    };
  }
  if (revision !== head) {
    try {
      execFileSync('git', ['-C', repoRoot, 'merge-base', '--is-ancestor', revision, head], {
        encoding: 'utf8',
        stdio: ['ignore', 'ignore', 'ignore'],
      });
    } catch {
      return {
        revision: head,
        tree: gitRevParse(repoRoot, `${head}^{tree}`),
        blockers: ['frozen-application-revision-not-ancestor'],
      };
    }
  }
  return {
    revision,
    tree: gitRevParse(repoRoot, `${revision}^{tree}`),
    blockers: [],
  };
}

export function readDockerMemoryBytes(): number {
  const raw = execFileSync('docker', ['info', '--format', '{{.MemTotal}}'], {
    encoding: 'utf8',
  }).trim();
  if (!/^[1-9][0-9]*$/.test(raw)) {
    throw new V018RuntimeReleaseError('docker-memory-unreadable', 'Docker VM memory is not a positive integer');
  }
  return Number(raw);
}

function assertV09Pointers(pointers: ReturnType<typeof snapshotCurrentPointers>, repoRoot: string): string[] {
  const blockers: string[] = [];
  const authority = asRecord(readJson(path.join(repoRoot, 'course-content/authoring/knowledge/authority/current.json')));
  const projection = asRecord(readJson(path.join(repoRoot, 'course-content/runtime/knowledge/projection/current.json')));
  const prerequisites = asRecord(readJson(path.join(repoRoot, 'course-content/runtime/knowledge/prerequisites/current.json')));
  const shards = asRecord(readJson(path.join(repoRoot, 'course-content/runtime/knowledge/authority-domain-shards/current.json')));
  const activation = asRecord(readJson(path.join(repoRoot, 'course-content/runtime/knowledge/consumer-activation/current.json')));
  if (authority.releaseId !== V09_RELEASE_ID || authority.snapshotId !== V09_SNAPSHOT) {
    blockers.push('production-authority-not-v09');
  }
  if (projection.projectionId !== V09_PROJECTION) blockers.push('production-projection-not-v09');
  if (prerequisites.publicationId !== V09_PREREQUISITE) blockers.push('production-prerequisite-not-v09');
  if (
    shards.releaseId !== V09_RELEASE_ID
    || shards.snapshotId !== V09_SNAPSHOT
    || shards.shardSetId !== V09_SHARD_SET
  ) {
    blockers.push('production-shards-not-v09');
  }
  if (activation.activationId !== V09_ACTIVATION) blockers.push('production-activation-not-v09');
  if (pointers.length < 5) blockers.push('production-pointer-set-incomplete');
  const pointerHash = new Map(pointers.map((row) => [row.path, row.sha256]));
  for (const [relative, expected] of Object.entries(V09_POINTER_HASHES)) {
    const actual = pointerHash.get(relative) ?? shaFile(path.join(repoRoot, relative));
    if (actual !== expected) blockers.push(`production-pointer-hash-drift:${relative}`);
  }
  return blockers;
}

function verifyQualificationBinding(
  qualification: Record<string, unknown>,
  qualificationBytes: Buffer,
): string[] {
  const blockers: string[] = [];
  if (projectionSha256(qualificationBytes) !== V018_SEALED_QUALIFICATION_SHA256) {
    blockers.push('qualification-file-hash-drift');
  }
  if (qualification.contract !== V018_QUALIFICATION_CONTRACT) {
    blockers.push('qualification-contract-invalid');
  }
  const reportBlockers = Array.isArray(qualification.blockers) ? qualification.blockers : ['qualification-blockers-missing'];
  if (reportBlockers.length > 0) blockers.push('qualification-has-blockers');
  const isolated = asRecord(qualification.isolatedRollback);
  const dual = asRecord(qualification.dualRebuild);
  if (isolated.advanced !== true || isolated.restored !== true) {
    blockers.push('qualification-isolated-rollback-incomplete');
  }
  if (dual.byteEquivalent !== true) blockers.push('qualification-dual-rebuild-incomplete');
  const consumers = Array.isArray(qualification.consumerResults) ? qualification.consumerResults : [];
  if (!consumers.length || consumers.some((row) => asRecord(row).status !== 'READY')) {
    blockers.push('qualification-consumers-not-ready');
  }
  const declaredDigest = String(qualification.receiptDigest ?? '');
  const actualDigest = projectionDigest((({ receiptDigest: _ignored, ...rest }) => rest)(qualification));
  if (!declaredDigest || declaredDigest !== actualDigest) {
    blockers.push('qualification-digest-drift');
  }
  const authority = asRecord(qualification.authority);
  const teaching = asRecord(qualification.teaching);
  if (String(qualification.captureRevision ?? '') !== '34e4d9da22b68957371bd2ba760ba9f85b886f3e') {
    blockers.push('qualification-capture-revision-drift');
  }
  if (authority.releaseId !== 'ctr:release:control-theory-engineering-v0.18') {
    blockers.push('qualification-authority-release-drift');
  }
  if (authority.snapshotId !== 'snap-1b64a853dda5668d83d0d2f09cadf72937330ced6aa49611f8027a9d5ec008ed') {
    blockers.push('qualification-authority-identity-drift');
  }
  if (authority.snapshotHash !== '1b64a853dda5668d83d0d2f09cadf72937330ced6aa49611f8027a9d5ec008ed') {
    blockers.push('qualification-authority-hash-drift');
  }
  if (teaching.projectionId !== 'proj-17f00f669b22c25126ca4c562e1e019c074a7738502825d2d109a77c47202ba9') {
    blockers.push('qualification-projection-identity-drift');
  }
  if (teaching.projectionHash !== '17f00f669b22c25126ca4c562e1e019c074a7738502825d2d109a77c47202ba9') {
    blockers.push('qualification-projection-hash-drift');
  }
  if (teaching.publicationId !== 'proj-0bdda82e1bc922fd8b910a9782dffbb147c64aed176b11d772b43f89eb8b3cf7') {
    blockers.push('qualification-publication-identity-drift');
  }
  if (teaching.publicationHash !== '0bdda82e1bc922fd8b910a9782dffbb147c64aed176b11d772b43f89eb8b3cf7') {
    blockers.push('qualification-publication-hash-drift');
  }
  const declaredOverlay = String(asRecord(qualification.inputHashes).reviewedNeighborhoodOverlay ?? '');
  const actualOverlay = reviewedNeighborhoodOverlaySha256();
  if (!/^[a-f0-9]{64}$/u.test(declaredOverlay) || declaredOverlay !== actualOverlay) {
    blockers.push('qualification-overlay-hash-drift');
  }
  return blockers;
}

function verifyProvenance(
  built: { provenancePath: string | null; imageTarPath: string | null },
  applicationRevision: string,
): string[] {
  if (!built.provenancePath || !existsSync(built.provenancePath)) {
    return ['provenance-missing'];
  }
  if (!built.imageTarPath || !existsSync(built.imageTarPath)) {
    return ['image-tar-missing'];
  }
  const provenance = asRecord(readJson(built.provenancePath));
  const blockers: string[] = [];
  if (String(provenance.appRevision ?? '') !== applicationRevision) {
    blockers.push('provenance-revision-mismatch');
  }
  const declared = String(provenance.imageTarSha256 ?? '');
  const actual = shaFile(built.imageTarPath);
  if (!/^[a-f0-9]{64}$/.test(declared)) blockers.push('provenance-image-digest-invalid');
  else if (declared !== actual) blockers.push('provenance-image-digest-mismatch');
  return blockers;
}

export async function publishActKgV018CutoverRuntime(input: {
  repoRoot: string;
  outputRoot?: string;
  qualificationReport?: string;
  imageTag?: string;
  frozenApplicationRevision?: string;
  readDockerMemory?: DockerMemoryReader;
  runBuild?: BuildRunner;
  hostVerificationReport?: string;
}): Promise<{
  status: 'READY' | 'BLOCKED';
  reportPath: string;
  blockers: string[];
  receiptDigest: string;
  imageBuilt: boolean;
}> {
  const repoRoot = path.resolve(input.repoRoot);
  const outputRoot = path.resolve(input.outputRoot ?? path.join(
    repoRoot,
    'course-content/authoring/knowledge/cutover/runtime-releases/control-theory-engineering-v0.18',
  ));
  if (outputRoot.includes(`${path.sep}runtime${path.sep}knowledge${path.sep}`) || outputRoot.endsWith('current.json')) {
    throw new V018RuntimeReleaseError('selector-unsafe', 'runtime release output cannot be a runtime selector path');
  }

  const pointersBefore = snapshotCurrentPointers(repoRoot);
  const blockers: string[] = [];
  const headRevision = gitRevParse(repoRoot, 'HEAD');
  const frozen = resolveFrozenApplicationRevision(
    repoRoot,
    input.frozenApplicationRevision,
    headRevision,
  );
  blockers.push(...frozen.blockers);
  const applicationRevision = frozen.revision;
  const applicationTree = frozen.tree;
  const qualificationPath = path.resolve(
    input.qualificationReport
    ?? path.join(repoRoot, 'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.18/qualification-readiness.json'),
  );
  const qualificationBytes = existsSync(qualificationPath) ? readFileSync(qualificationPath) : null;
  let qualification: Record<string, unknown> = {};
  if (qualificationBytes) {
    try {
      qualification = asRecord(JSON.parse(qualificationBytes.toString('utf8')));
    } catch {
      qualification = {};
      blockers.push('qualification-report-unreadable');
    }
  }
  const qualificationStatus = String(qualification.status ?? '');
  const qualificationDigest = qualificationBytes ? projectionSha256(qualificationBytes) : '';
  if (!qualificationBytes) blockers.push('qualification-report-missing');
  else blockers.push(...verifyQualificationBinding(qualification, qualificationBytes));
  if (qualificationStatus !== 'READY') blockers.push('qualification-not-ready');
  if (qualification.publicationOnly !== true) blockers.push('qualification-not-publication-only');
  if (qualification.productionCutoverAuthorized === true) blockers.push('qualification-claimed-cutover');
  blockers.push(...assertV09Pointers(pointersBefore, repoRoot));

  const buildScript = path.join(repoRoot, 'scripts/build.sh');
  if (!existsSync(buildScript)) blockers.push('build-script-missing');

  let dockerMemoryBytes = 0;
  try {
    dockerMemoryBytes = (input.readDockerMemory ?? readDockerMemoryBytes)();
    if (dockerMemoryBytes < DOCKER_MIN_MEMORY_BYTES) blockers.push('docker-memory-below-20gib');
  } catch (error) {
    blockers.push(error instanceof V018RuntimeReleaseError ? error.code : 'docker-memory-unreadable');
  }

  let imageBuilt = false;
  let imageTag = input.imageTag ?? `localhost/act-obe-platform:v018-${applicationRevision.slice(0, 12)}`;
  if (blockers.length === 0) {
    if (!input.runBuild) {
      blockers.push('build-runner-required');
    } else {
      const built = await input.runBuild({ repoRoot, imageTag });
      imageTag = built.imageTag;
      const provenanceBlockers = verifyProvenance(built, applicationRevision);
      if (provenanceBlockers.length === 0) imageBuilt = true;
      else blockers.push(...provenanceBlockers);
    }
  }

  const pointersAfter = snapshotCurrentPointers(repoRoot);
  try {
    assertV018ProductionPointersUnchanged(pointersBefore, pointersAfter);
  } catch {
    blockers.push('production-pointer-drift');
  }
  blockers.push(...assertV09Pointers(pointersAfter, repoRoot));
  const hostReportPath = path.resolve(
    input.hostVerificationReport
    ?? path.join(outputRoot, 'host-shadow-verification.json'),
  );
  const hostReport = loadHostShadowVerificationReport(hostReportPath);
  if (hostReport.status !== 'READY') blockers.push('host-shadow-not-ready');
  blockers.push(...hostReport.blockers);
  if (hostReport.observedAppImage !== imageTag) blockers.push('host-app-image-not-this-build');
  if (hostReport.observedWorkerImage !== imageTag) blockers.push('host-worker-image-not-this-build');
  const uniqueBlockers = [...new Set(blockers)].sort();
  const hostVerification = {
    status: hostReport.status === 'READY' && uniqueBlockers.length === 0
      ? 'READY' as const
      : 'BLOCKED' as const,
    digest: hostReport.digest,
    blockers: uniqueBlockers.filter((code) => code.startsWith('host-')),
  };
  const body = {
    contract: V018_RUNTIME_RELEASE_CONTRACT,
    status: uniqueBlockers.length === 0 ? 'READY' as const : 'BLOCKED' as const,
    publicationOnly: true,
    productionCutoverAuthorized: false,
    selectorConsumption: false,
    imageBuilt,
    applicationRevision,
    applicationTree,
    qualificationPath: path.relative(repoRoot, qualificationPath).split(path.sep).join('/'),
    qualificationStatus,
    qualificationDigest,
    dockerMemoryBytes,
    dockerMinMemoryBytes: DOCKER_MIN_MEMORY_BYTES,
    imageTag,
    pointerHashes: Object.keys(hostReport.pointerHashes).length > 0
      ? hostReport.pointerHashes
      : expectedHostPointerHashes(),
    hostVerification,
    predecessors: {
      authorityReleaseId: V09_RELEASE_ID,
      authoritySnapshotId: V09_SNAPSHOT,
      projectionId: V09_PROJECTION,
      publicationId: V09_PREREQUISITE,
      shardSetId: V09_SHARD_SET,
      activationId: V09_ACTIVATION,
    },
    nextAction: uniqueBlockers.length === 0 ? 'activate-actkg-v018-production-cutover' : 'blocked',
    blockers: uniqueBlockers,
  };
  const report = { ...body, receiptDigest: projectionDigest(body) };
  const reportPath = path.join(outputRoot, 'runtime-release-receipt.json');
  writeCanonical(reportPath, report);
  return {
    status: report.status,
    reportPath: path.relative(repoRoot, reportPath).split(path.sep).join('/'),
    blockers: uniqueBlockers,
    receiptDigest: report.receiptDigest,
    imageBuilt,
  };
}
