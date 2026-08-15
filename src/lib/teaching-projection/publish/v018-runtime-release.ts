/** Publish a cutover-capable runtime only after READY qualification. */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { projectionDigest } from '../hash';
import {
  assertV018ProductionPointersUnchanged,
  snapshotCurrentPointers,
} from '../qualify/v018-qualify';
import {
  V09_ACTIVATION,
  V09_PREREQUISITE,
  V09_PROJECTION,
  V09_RELEASE_ID,
  V09_SNAPSHOT,
  asRecord,
  readJson,
  shaFile,
  writeCanonical,
} from '../qualify/v018-shared';

export const V018_RUNTIME_RELEASE_CONTRACT = 'actkg-v018-runtime-release/v1' as const;
export const DOCKER_MIN_MEMORY_BYTES = 20 * 1024 * 1024 * 1024;

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
  }>;
}

function gitRevParse(repoRoot: string, arg: string): string {
  return execFileSync('git', ['-C', repoRoot, 'rev-parse', arg], {
    encoding: 'utf8',
  }).trim();
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
  if (shards.releaseId !== V09_RELEASE_ID || shards.snapshotId !== V09_SNAPSHOT) {
    blockers.push('production-shards-not-v09');
  }
  if (activation.activationId !== V09_ACTIVATION) blockers.push('production-activation-not-v09');
  if (pointers.length < 5) blockers.push('production-pointer-set-incomplete');
  return blockers;
}

export async function publishActKgV018CutoverRuntime(input: {
  repoRoot: string;
  outputRoot?: string;
  qualificationReport?: string;
  imageTag?: string;
  readDockerMemory?: DockerMemoryReader;
  runBuild?: BuildRunner;
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
  const applicationRevision = gitRevParse(repoRoot, 'HEAD');
  const applicationTree = gitRevParse(repoRoot, 'HEAD^{tree}');
  const qualificationPath = path.resolve(
    input.qualificationReport
    ?? path.join(repoRoot, 'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.18/qualification-readiness.json'),
  );
  const qualification = existsSync(qualificationPath) ? readJson(qualificationPath) : {};
  const qualificationStatus = String(qualification.status ?? '');
  const qualificationDigest = existsSync(qualificationPath) ? shaFile(qualificationPath) : '';
  if (!existsSync(qualificationPath)) blockers.push('qualification-report-missing');
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
      imageBuilt = true;
      imageTag = built.imageTag;
    }
  }

  const pointersAfter = snapshotCurrentPointers(repoRoot);
  try {
    assertV018ProductionPointersUnchanged(pointersBefore, pointersAfter);
  } catch {
    blockers.push('production-pointer-drift');
  }
  blockers.push(...assertV09Pointers(pointersAfter, repoRoot));

  const uniqueBlockers = [...new Set(blockers)].sort();
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
    predecessors: {
      authorityReleaseId: V09_RELEASE_ID,
      authoritySnapshotId: V09_SNAPSHOT,
      projectionId: V09_PROJECTION,
      publicationId: V09_PREREQUISITE,
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
