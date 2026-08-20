/** Publish an envelope-configurable runtime after READY v0.22 qualification. */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  envelopeByName,
  matchCompositeEnvelope,
} from '../../actkg-envelope/composite-envelope-registry';
import { projectionDigest, projectionSha256 } from '../hash';
import {
  assertV022ProductionPointersUnchanged,
  snapshotCurrentPointers,
} from '../qualify/v022-qualify';
import {
  asRecord,
  readJson,
  writeCanonical,
} from '../qualify/v022-shared';
import { loadV022HostShadowVerificationReport } from './v022-host-shadow';

export const V022_RUNTIME_RELEASE_CONTRACT = 'actkg-v022-runtime-release/v1' as const;
export const V022_SEALED_QUALIFICATION_SHA256 =
  'afd84f5837af925e50728ade620c5ae2509b537a5efa0a4d402ae529343f11b7' as const;

export class V022RuntimeReleaseError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'V022RuntimeReleaseError';
    this.code = code;
  }
}

function gitRevParse(repoRoot: string, arg: string): string {
  return execFileSync('git', ['-C', repoRoot, 'rev-parse', arg], { encoding: 'utf8' }).trim();
}

function resolveFrozenApplicationRevision(
  repoRoot: string,
  requested: string | undefined,
  head: string,
): { revision: string; tree: string; blockers: string[] } {
  const revision = requested?.trim() || head;
  if (!/^[0-9a-f]{40}$/.test(revision)) {
    return { revision: head, tree: gitRevParse(repoRoot, `${head}^{tree}`), blockers: ['frozen-application-revision-invalid'] };
  }
  if (revision !== head) {
    try {
      execFileSync('git', ['-C', repoRoot, 'merge-base', '--is-ancestor', revision, head], {
        encoding: 'utf8',
        stdio: ['ignore', 'ignore', 'ignore'],
      });
    } catch {
      return { revision: head, tree: gitRevParse(repoRoot, `${head}^{tree}`), blockers: ['frozen-application-revision-not-ancestor'] };
    }
  }
  return { revision, tree: gitRevParse(repoRoot, `${revision}^{tree}`), blockers: [] };
}

function qualificationBlockers(repoRoot: string, reportPath: string): string[] {
  const blockers: string[] = [];
  if (!existsSync(reportPath)) return ['qualification-missing'];
  const bytes = readFileSync(reportPath);
  if (projectionSha256(bytes) !== V022_SEALED_QUALIFICATION_SHA256) blockers.push('qualification-file-hash-drift');
  const qualification = asRecord(JSON.parse(bytes.toString('utf8')));
  if (qualification.contract !== 'actkg-v022-cutover-qualification/v1') blockers.push('qualification-contract-invalid');
  if (qualification.status !== 'READY') blockers.push('qualification-not-ready');
  if (qualification.publicationOnly !== true) blockers.push('qualification-not-publication-only');
  if (qualification.productionCutoverAuthorized === true) blockers.push('qualification-claimed-cutover');
  const reportBlockers = Array.isArray(qualification.blockers) ? qualification.blockers : ['qualification-blockers-missing'];
  if (reportBlockers.length > 0) blockers.push('qualification-has-blockers');
  const v22 = envelopeByName('control-theory-engineering-v0.22');
  const authority = asRecord(qualification.authority);
  const teaching = asRecord(qualification.teaching);
  if (authority.releaseId !== v22.authorityReleaseId) blockers.push('qualification-authority-release-drift');
  if (authority.snapshotId !== v22.authoritySnapshotId) blockers.push('qualification-authority-identity-drift');
  if (teaching.projectionId !== v22.projectionId) blockers.push('qualification-projection-identity-drift');
  if (teaching.publicationId !== v22.publicationId) blockers.push('qualification-publication-identity-drift');
  const declaredDigest = String(qualification.receiptDigest ?? '');
  const actualDigest = projectionDigest((({ receiptDigest: _ignored, ...rest }) => rest)(qualification));
  if (!declaredDigest || declaredDigest !== actualDigest) blockers.push('qualification-digest-drift');
  return blockers;
}

export interface V022ReleaseGateAttestation {
  lint: boolean;
  typecheck: boolean;
  test: boolean;
  build: boolean;
}

export function publishActKgV022CutoverRuntime(input: {
  repoRoot: string;
  outputRoot?: string;
  boundEnvelopeName?: string;
  frozenApplicationRevision?: string;
  hostShadowRequired?: boolean;
  hostVerificationReport?: string;
  requireReleaseGates?: boolean;
  releaseGates?: V022ReleaseGateAttestation;
  readGitStatus?: () => string;
}): {
  status: 'READY' | 'BLOCKED';
  reportPath: string;
  blockers: string[];
  receiptDigest: string;
} {
  const repoRoot = path.resolve(input.repoRoot);
  const outputRoot = path.resolve(input.outputRoot ?? path.join(
    repoRoot,
    'course-content/authoring/knowledge/cutover/runtime-releases/control-theory-engineering-v0.22',
  ));
  if (outputRoot.includes(`${path.sep}runtime${path.sep}knowledge${path.sep}`)) {
    throw new V022RuntimeReleaseError('selector-unsafe', 'runtime receipt cannot be a runtime selector path');
  }
  const before = snapshotCurrentPointers(repoRoot);
  const qualificationPath = path.join(
    repoRoot,
    'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.22/qualification-readiness.json',
  );
  const blockers = qualificationBlockers(repoRoot, qualificationPath);
  const head = gitRevParse(repoRoot, 'HEAD');
  const frozen = resolveFrozenApplicationRevision(repoRoot, input.frozenApplicationRevision, head);
  blockers.push(...frozen.blockers);
  if (frozen.revision !== head) blockers.push('frozen-revision-not-head');
  const readGitStatus = input.readGitStatus
    ?? (() => execFileSync('git', ['-C', repoRoot, 'status', '--porcelain'], { encoding: 'utf8' }));
  if (readGitStatus().trim().length > 0) blockers.push('working-tree-dirty');
  if (input.requireReleaseGates !== false) {
    const gates = input.releaseGates;
    if (!gates) blockers.push('release-gates-unattested');
    else {
      if (gates.lint !== true) blockers.push('release-gate-lint');
      if (gates.typecheck !== true) blockers.push('release-gate-typecheck');
      if (gates.test !== true) blockers.push('release-gate-test');
      if (gates.build !== true) blockers.push('release-gate-build');
    }
  }

  const authority = readJson(path.join(repoRoot, 'course-content/authoring/knowledge/authority/current.json'));
  const projection = readJson(path.join(repoRoot, 'course-content/runtime/knowledge/projection/current.json'));
  const prerequisite = readJson(path.join(repoRoot, 'course-content/runtime/knowledge/prerequisites/current.json'));
  const shards = readJson(path.join(repoRoot, 'course-content/runtime/knowledge/authority-domain-shards/current.json'));
  const catalog = readJson(path.join(repoRoot, 'course-content/runtime/knowledge/authority-domain-catalog/current.json'));
  const activation = readJson(path.join(repoRoot, 'course-content/runtime/knowledge/consumer-activation/current.json'));
  let activeName: string | null = null;
  try {
    const active = matchCompositeEnvelope({
      authorityReleaseId: String(authority.releaseId ?? ''),
      authoritySnapshotId: String(authority.snapshotId ?? ''),
      authoritySnapshotHash: String(authority.snapshotHash ?? ''),
      projectionId: String(projection.projectionId ?? ''),
      projectionHash: String(projection.projectionHash ?? ''),
      publicationId: String(prerequisite.publicationId ?? ''),
      publicationHash: String(prerequisite.publicationHash ?? ''),
      shardSetId: String(shards.shardSetId ?? ''),
      shardSetHash: String(shards.shardSetHash ?? ''),
      catalogId: String(catalog.catalogId ?? ''),
      catalogHash: String(catalog.catalogHash ?? ''),
      activationId: String(activation.activationId ?? ''),
      activationHash: typeof activation.activationHash === 'string' ? activation.activationHash : null,
    }, repoRoot);
    activeName = active.name;
    const boundName = input.boundEnvelopeName ?? active.name;
    envelopeByName(boundName);
    if (active.name !== boundName) blockers.push('bound-envelope-not-current');
  } catch (error) {
    blockers.push(error instanceof Error && 'code' in error ? String((error as { code: string }).code) : 'envelope-mix');
  }

  if (input.hostShadowRequired !== false) {
    const hostReportPath = path.resolve(
      input.hostVerificationReport
      ?? path.join(outputRoot, 'host-shadow-verification.json'),
    );
    const hostReport = loadV022HostShadowVerificationReport(hostReportPath);
    if (hostReport.status !== 'READY') blockers.push('host-shadow-verification-incomplete');
    blockers.push(...hostReport.blockers);
  }

  const after = snapshotCurrentPointers(repoRoot);
  try {
    assertV022ProductionPointersUnchanged(before, after);
  } catch {
    blockers.push('production-pointer-drift');
  }

  const unique = [...new Set(blockers)].sort();
  const body = {
    contract: V022_RUNTIME_RELEASE_CONTRACT,
    status: unique.length === 0 ? 'READY' as const : 'BLOCKED' as const,
    boundEnvelopeName: input.boundEnvelopeName ?? activeName,
    applicationRevision: frozen.revision,
    applicationTree: frozen.tree,
    qualificationDigest: V022_SEALED_QUALIFICATION_SHA256,
    productionCutoverAuthorized: false,
    selectorConsumption: false,
    pointersUnchanged: !unique.includes('production-pointer-drift'),
    blockers: unique,
  };
  const report = { ...body, receiptDigest: projectionDigest(body) };
  const reportPath = path.join(outputRoot, 'runtime-release-receipt.json');
  writeCanonical(reportPath, report);
  return {
    status: report.status,
    reportPath: path.relative(repoRoot, reportPath).split(path.sep).join('/'),
    blockers: unique,
    receiptDigest: report.receiptDigest,
  };
}
