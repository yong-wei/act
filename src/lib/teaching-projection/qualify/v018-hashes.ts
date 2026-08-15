/** Bind every declared candidate hash and compare dual-replay bytes. */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { authorityCanonicalJson, authoritySha256 } from '../../authoritative-knowledge/authority-snapshot';
import { projectionDigest } from '../hash';
import {
  AUTHORITY_CANDIDATE_RELATIVE,
  TEACHING_CANDIDATE_RELATIVE,
  V018_RELEASE_RELATIVE,
  V018_SNAPSHOT,
  asRecord,
  readJson,
  shaFile,
} from './v018-shared';

export interface DeclaredCandidateHash {
  path: string;
  sha256: string;
  source: string;
  digestScope?: string;
}

const TEACHING_RELEASE_FILES = [
  'resources.jsonl',
  'bindings.jsonl',
  'prerequisites.jsonl',
  'core-nodes.json',
  'cards-index.json',
  'projection-manifest.json',
  'impact-report.json',
  'gate.json',
] as const;

const PREREQ_RELEASE_FILES = [
  'core-nodes.json',
  'edges.json',
  'candidates.json',
  'derived.json',
  'gate.json',
  'publication-manifest.json',
  'projection-core-nodes.json',
  'projection-prerequisites.json',
] as const;

export function verifyAbsoluteFileHash(
  filePath: string,
  expectedSha256: string,
): string | null {
  if (!expectedSha256 || !/^[a-f0-9]{64}$/u.test(expectedSha256)) {
    return `invalid-declared-hash:${filePath}`;
  }
  if (!existsSync(filePath)) {
    return `declared-hash-missing:${filePath}`;
  }
  const actual = shaFile(filePath);
  return actual === expectedSha256 ? null : `declared-hash-mismatch:${filePath}`;
}

function collectRelativeFiles(root: string): string[] {
  const files: string[] = [];
  const walk = (current: string, relative: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) => (
      a.name.localeCompare(b.name)
    ))) {
      const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
      const child = path.join(current, entry.name);
      if (entry.isDirectory()) walk(child, childRelative);
      else if (entry.isFile()) files.push(childRelative);
    }
  };
  if (existsSync(root) && statSync(root).isDirectory()) walk(root, '');
  return files;
}

export function collectDeclaredCandidateHashes(repoRoot: string): DeclaredCandidateHash[] {
  const declared: DeclaredCandidateHash[] = [];
  const authorityReceiptPath = path.join(repoRoot, AUTHORITY_CANDIDATE_RELATIVE, 'candidate-receipt.json');
  const authorityReceipt = readJson(authorityReceiptPath);
  const outputs = Array.isArray(authorityReceipt.outputs) ? authorityReceipt.outputs : [];
  for (const row of outputs) {
    const rec = asRecord(row);
    const relative = String(rec.path ?? '');
    if (!relative) continue;
    declared.push({
      path: relative,
      sha256: String(rec.sha256 ?? ''),
      source: 'authority-receipt.outputs',
      digestScope: String(rec.digestScope ?? 'bytes'),
    });
  }

  const mirrorFiles = Array.isArray(asRecord(authorityReceipt.mirror).files)
    ? asRecord(authorityReceipt.mirror).files as unknown[]
    : [];
  for (const row of mirrorFiles) {
    const rec = asRecord(row);
    declared.push({
      path: `${V018_RELEASE_RELATIVE}/${String(rec.path ?? '')}`,
      sha256: String(rec.rawSha256 ?? rec.sha256 ?? ''),
      source: 'authority-receipt.mirror',
    });
  }

  const bundleManifestPath = path.join(repoRoot, V018_RELEASE_RELATIVE, 'bundle-manifest.json');
  const bundle = readJson(bundleManifestPath);
  const artifacts = Array.isArray(bundle.artifacts) ? bundle.artifacts : [];
  for (const row of artifacts) {
    const rec = asRecord(row);
    declared.push({
      path: `${V018_RELEASE_RELATIVE}/${String(rec.path ?? '')}`,
      sha256: String(rec.sha256 ?? ''),
      source: 'bundle-manifest.artifacts',
    });
  }

  const validationPath = path.join(repoRoot, V018_RELEASE_RELATIVE, 'validation-report.json');
  if (existsSync(validationPath)) {
    const validation = readJson(validationPath);
    const rows = Array.isArray(validation.artifact_validation)
      ? validation.artifact_validation
      : [];
    for (const row of rows) {
      const rec = asRecord(row);
      declared.push({
        path: `${V018_RELEASE_RELATIVE}/${String(rec.path ?? '')}`,
        sha256: String(rec.sha256 ?? ''),
        source: 'validation-report.artifact_validation',
      });
    }
  }

  return declared;
}

export function verifyDeclaredCandidateHashes(repoRoot: string): string[] {
  const blockers: string[] = [];
  const declared = collectDeclaredCandidateHashes(repoRoot);
  if (declared.length < 20) blockers.push('declared-candidate-hash-set-incomplete');
  const seen = new Set<string>();
  for (const row of declared) {
    const key = `${row.source}:${row.path}:${row.sha256}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (row.path.includes('..') || path.isAbsolute(row.path) || row.path.includes('\\')) {
      blockers.push(`declared-hash-unsafe-path:${row.path}`);
      continue;
    }
    const abs = path.join(repoRoot, row.path);
    if (row.digestScope === 'receipt-body-without-outputs') {
      const parsed = readJson(abs);
      const actual = authoritySha256(authorityCanonicalJson({ ...parsed, outputs: [] }));
      if (actual !== row.sha256) blockers.push(`${row.source}:receipt-body-hash-mismatch:${row.path}`);
      continue;
    }
    const failure = verifyAbsoluteFileHash(abs, row.sha256);
    if (failure) blockers.push(`${row.source}:${failure}`);
  }
  const teachingReceipt = readJson(path.join(repoRoot, TEACHING_CANDIDATE_RELATIVE, 'candidate-receipt.json'));
  const declaredAuthorityDigest = String(asRecord(teachingReceipt.authority).candidateReceiptDigest ?? '');
  const actualAuthorityDigest = shaFile(path.join(repoRoot, AUTHORITY_CANDIDATE_RELATIVE, 'candidate-receipt.json'));
  if (declaredAuthorityDigest !== actualAuthorityDigest) {
    blockers.push('teaching-authority-candidate-receipt-digest-drift');
  }
  return blockers;
}

export function verifyTeachingArtifactHashes(repoRoot: string): string[] {
  const blockers: string[] = [];
  const teachingReceiptPath = path.join(repoRoot, TEACHING_CANDIDATE_RELATIVE, 'candidate-receipt.json');
  const teachingReceipt = readJson(teachingReceiptPath);
  if (teachingReceipt.receiptDigest !== projectionDigest((({ receiptDigest: _ignored, ...rest }) => rest)(teachingReceipt))) {
    blockers.push('teaching-receipt-digest-drift');
  }
  const projection = asRecord(teachingReceipt.projection);
  const prerequisite = asRecord(teachingReceipt.prerequisite);
  const projectionId = String(projection.projectionId ?? '');
  const publicationId = String(prerequisite.publicationId ?? '');
  const projectionDir = path.join(
    repoRoot,
    TEACHING_CANDIDATE_RELATIVE,
    'projection/releases',
    projectionId,
  );
  const prerequisiteDir = path.join(
    repoRoot,
    TEACHING_CANDIDATE_RELATIVE,
    'prerequisites/releases',
    publicationId,
  );
  const projectionManifest = readJson(path.join(projectionDir, 'projection-manifest.json'));
  for (const fileName of TEACHING_RELEASE_FILES) {
    const filePath = path.join(projectionDir, fileName);
    if (!existsSync(filePath)) blockers.push(`teaching-release-missing:${fileName}`);
    else if (!shaFile(filePath)) blockers.push(`teaching-release-empty:${fileName}`);
  }
  if (projectionManifest.projectionId !== projection.projectionId) {
    blockers.push('teaching-projection-id-drift');
  }
  if (projectionManifest.projectionHash !== projection.projectionHash) {
    blockers.push('teaching-projection-hash-drift');
  }
  const publicationManifest = readJson(path.join(prerequisiteDir, 'publication-manifest.json'));
  for (const fileName of PREREQ_RELEASE_FILES) {
    const filePath = path.join(prerequisiteDir, fileName);
    if (!existsSync(filePath)) blockers.push(`prerequisite-release-missing:${fileName}`);
    else if (!shaFile(filePath)) blockers.push(`prerequisite-release-empty:${fileName}`);
  }
  if (publicationManifest.publicationHash !== prerequisite.publicationHash) {
    blockers.push('teaching-prerequisite-hash-drift');
  }
  if (publicationManifest.publicationId !== publicationId) {
    blockers.push('teaching-prerequisite-id-drift');
  }
  return blockers;
}

export function compareDualReplayArtifactBytes(repoRoot: string): {
  blockers: string[];
  comparedFiles: number;
  firstProjectionId: string;
  secondProjectionId: string;
  firstPrerequisitePublicationId: string;
  secondPrerequisitePublicationId: string;
  authorityReplayEquivalent: boolean;
  byteEquivalent: boolean;
} {
  const blockers: string[] = [];
  const replay1 = path.join(repoRoot, AUTHORITY_CANDIDATE_RELATIVE, 'replay-1');
  const replay2 = path.join(repoRoot, AUTHORITY_CANDIDATE_RELATIVE, 'replay-2');
  const files1 = collectRelativeFiles(replay1);
  const files2 = collectRelativeFiles(replay2);
  if (files1.length === 0 || files2.length === 0) blockers.push('dual-replay-artifacts-missing');
  const set1 = new Set(files1);
  const set2 = new Set(files2);
  for (const relative of files1) {
    if (!set2.has(relative)) blockers.push(`dual-replay-missing-in-replay-2:${relative}`);
  }
  for (const relative of files2) {
    if (!set1.has(relative)) blockers.push(`dual-replay-missing-in-replay-1:${relative}`);
  }
  let comparedFiles = 0;
  for (const relative of files1.filter((item) => set2.has(item))) {
    const left = readFileSync(path.join(replay1, relative));
    const right = readFileSync(path.join(replay2, relative));
    comparedFiles += 1;
    if (!left.equals(right)) blockers.push(`dual-replay-byte-drift:${relative}`);
  }

  const teachingReceipt = readJson(path.join(repoRoot, TEACHING_CANDIDATE_RELATIVE, 'candidate-receipt.json'));
  const dual = asRecord(teachingReceipt.dualBuild);
  const projection = asRecord(teachingReceipt.projection);
  const prerequisite = asRecord(teachingReceipt.prerequisite);
  const firstProjectionId = String(dual.firstProjectionId ?? '');
  const secondProjectionId = String(dual.secondProjectionId ?? '');
  const firstPrerequisitePublicationId = String(dual.firstPrerequisitePublicationId ?? '');
  const secondPrerequisitePublicationId = String(dual.secondPrerequisitePublicationId ?? '');
  if (firstProjectionId !== secondProjectionId || firstProjectionId !== String(projection.projectionId ?? '')) {
    blockers.push('teaching-dual-projection-id-drift');
  }
  if (
    firstPrerequisitePublicationId !== secondPrerequisitePublicationId
    || firstPrerequisitePublicationId !== String(prerequisite.publicationId ?? '')
  ) {
    blockers.push('teaching-dual-prerequisite-id-drift');
  }
  const teachingReplay1 = path.join(repoRoot, TEACHING_CANDIDATE_RELATIVE, 'replay-1');
  const teachingReplay2 = path.join(repoRoot, TEACHING_CANDIDATE_RELATIVE, 'replay-2');
  if (!existsSync(teachingReplay1) || !existsSync(teachingReplay2)) {
    blockers.push('teaching-dual-replay-trees-absent');
  } else {
    const teach1 = collectRelativeFiles(teachingReplay1);
    const teach2 = collectRelativeFiles(teachingReplay2);
    const teachSet2 = new Set(teach2);
    for (const relative of teach1) {
      if (!teachSet2.has(relative)) blockers.push(`teaching-dual-replay-missing-in-replay-2:${relative}`);
      else {
        const left = readFileSync(path.join(teachingReplay1, relative));
        const right = readFileSync(path.join(teachingReplay2, relative));
        comparedFiles += 1;
        if (!left.equals(right)) blockers.push(`teaching-dual-replay-byte-drift:${relative}`);
      }
    }
  }
  if (!firstProjectionId || !existsSync(path.join(
    repoRoot,
    TEACHING_CANDIDATE_RELATIVE,
    `projection/releases/${firstProjectionId}`,
  ))) {
    blockers.push('teaching-dual-projection-artifact-missing');
  }
  if (String(dual.firstProjectionHash ?? '') !== String(projection.projectionHash ?? '')) {
    blockers.push('teaching-dual-projection-hash-unbound');
  }
  if (String(dual.firstPrerequisitePublicationHash ?? '') !== String(prerequisite.publicationHash ?? '')) {
    blockers.push('teaching-dual-prerequisite-hash-unbound');
  }
  if (String(dual.secondProjectionHash ?? '') !== String(dual.firstProjectionHash ?? '')) {
    blockers.push('teaching-dual-projection-rebuild-drift');
  }
  if (String(dual.secondPrerequisitePublicationHash ?? '') !== String(dual.firstPrerequisitePublicationHash ?? '')) {
    blockers.push('teaching-dual-prerequisite-rebuild-drift');
  }
  void V018_SNAPSHOT;

  const authorityReplayEquivalent = !blockers.some((row) => row.startsWith('dual-replay-'));
  const byteEquivalent = blockers.length === 0;
  return {
    blockers,
    comparedFiles,
    firstProjectionId,
    secondProjectionId,
    firstPrerequisitePublicationId,
    secondPrerequisitePublicationId,
    authorityReplayEquivalent,
    byteEquivalent,
  };
}
