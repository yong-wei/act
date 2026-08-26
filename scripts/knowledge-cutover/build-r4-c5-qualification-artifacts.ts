#!/usr/bin/env tsx
/** Reopen r4-c5 inputs and emit the exact artifact map for CLI qualification. */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { projectionDigest } from '@/lib/teaching-projection/hash';
import { assertCandidateReceiptSelfHash } from '@/lib/latest-authority-oss-cutover/envelope';
import type { CoordinatedCandidateReceipt } from '@/lib/latest-authority-oss-cutover/contracts';

const ROOT = process.cwd();
const C4 = 'course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.37-r4-c4';

function option(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index < 0 ? undefined : process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`build-r4-c5-qualification-artifacts: missing ${name}`);
  return value;
}

function absolute(value: string): string {
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function readJson<T>(value: string): T {
  return JSON.parse(readFileSync(absolute(value), 'utf8')) as T;
}

function sha256File(value: string): string {
  return createHash('sha256').update(readFileSync(absolute(value))).digest('hex');
}

function writeImmutable(value: string, body: unknown): void {
  const target = absolute(value);
  const wire = Buffer.from(`${JSON.stringify(body, null, 2)}\n`);
  mkdirSync(path.dirname(target), { recursive: true });
  if (existsSync(target) && !readFileSync(target).equals(wire)) {
    throw new Error(`build-r4-c5-qualification-artifacts: refusing to overwrite ${value}`);
  }
  if (!existsSync(target)) writeFileSync(target, wire);
}

function requireHash(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) {
    throw new Error(`build-r4-c5-qualification-artifacts: ${label} must be a SHA-256 digest`);
  }
  return value;
}

function main(): void {
  const candidateDir = option('--candidate-dir');
  const candidate = readJson<CoordinatedCandidateReceipt>(path.join(candidateDir, 'candidate-receipt.json'));
  assertCandidateReceiptSelfHash(candidate);
  const allocation = readJson<{ allocationHash: string }>(path.join(candidateDir, 'allocation.json'));
  if (allocation.allocationHash !== candidate.allocationHash) throw new Error('qualification allocation differs from candidate');
  const stage = readJson<{
    contract: string;
    runtimeRelease: { releaseId: string; manifestSha256: string; treeSha256: string };
    materializationReceiptSha256: string;
  }>(path.join(candidateDir, 'runtime-stage.json'));
  if (stage.contract !== 'coordinated-runtime-stage/v1') throw new Error('runtime stage contract is invalid');
  const extension = readJson<Record<string, unknown>>(path.join(candidateDir, 'successor-runtime-manifest-extension.json'));
  const extensionHash = projectionDigest({
    successorManifest: stage.runtimeRelease,
    materializationReceiptHash: stage.materializationReceiptSha256,
    extension,
  });
  const capture = readJson<{ captureHash: string }>(`${C4}/authority-capture/authority-capture.json`);
  const selectors = readJson<{
    selectors: {
      projection: { projectionHash: string };
      prerequisite: { publicationHash: string };
      catalog: { catalogHash: string };
      shards: { shardSetHash: string };
      consumerActivation: { activationHash: string };
    };
  }>(`${C4}/runtime-selector-set.json`);
  const locale = sha256File('course-content/authoring/knowledge/releases/control-theory-engineering-v0.37-r4/locale-manifest.json');
  const continuity = readJson<{ receiptHash: string }>(path.join(candidateDir, 'continuity-receipt.json'));
  const teaching = readJson<{ receiptHash: string }>(path.join(candidateDir, 'teaching-closure-receipt.json'));
  const envelope = readJson<{ allocationHash: string; envelopeHash: string }>(path.join(candidateDir, 'formal-resource-envelope.json'));
  const derivation = readJson<{ allocationHash: string; receiptHash: string }>(path.join(candidateDir, 'derivation-receipt.json'));
  const rows = [
    { artifactId: 'authority-capture', artifactHash: requireHash(capture.captureHash, 'Authority capture') },
    { artifactId: 'locale-qualification', artifactHash: locale },
    { artifactId: 'teaching-projection', artifactHash: requireHash(selectors.selectors.projection.projectionHash, 'Teaching Projection') },
    { artifactId: 'teaching-closure-receipt', artifactHash: requireHash(teaching.receiptHash, 'Teaching closure') },
    { artifactId: 'formal-resource-envelope', artifactHash: requireHash(envelope.envelopeHash, 'formal resource envelope'), allocationHash: envelope.allocationHash },
    { artifactId: 'continuity-receipt', artifactHash: requireHash(continuity.receiptHash, 'continuity receipt') },
    { artifactId: 'derivation-receipt', artifactHash: requireHash(derivation.receiptHash, 'derivation receipt'), allocationHash: derivation.allocationHash },
    { artifactId: 'successor-runtime-manifest', artifactHash: extensionHash },
    { artifactId: 'successor-runtime-materialization', artifactHash: requireHash(stage.materializationReceiptSha256, 'Runtime materialization') },
    { artifactId: 'authority-domain-shard-catalog', artifactHash: requireHash(selectors.selectors.catalog.catalogHash, 'domain catalog') },
    { artifactId: 'authority-domain-shard-set', artifactHash: requireHash(selectors.selectors.shards.shardSetHash, 'domain shards') },
    { artifactId: 'prerequisite-publication', artifactHash: requireHash(selectors.selectors.prerequisite.publicationHash, 'prerequisite publication') },
    { artifactId: 'consumer-activation', artifactHash: requireHash(selectors.selectors.consumerActivation.activationHash, 'consumer activation') },
  ];
  const expected = new Map([
    ['authority-capture', candidate.authorityCaptureHash],
    ['locale-qualification', candidate.localeQualificationHash],
    ['teaching-projection', candidate.teachingProjectionHash],
    ['teaching-closure-receipt', candidate.teachingClosureReceiptHash],
    ['formal-resource-envelope', candidate.formalResourceEnvelopeHash],
    ['continuity-receipt', candidate.continuityReceiptHash],
    ['derivation-receipt', candidate.derivationReceiptHash],
    ['successor-runtime-manifest', candidate.successorRuntimeManifestHash],
    ['successor-runtime-materialization', candidate.successorRuntimeMaterializationHash],
    ['authority-domain-shard-catalog', candidate.domainShardCatalogHash],
    ['authority-domain-shard-set', candidate.domainShardSetHash],
    ['prerequisite-publication', candidate.prerequisitePublicationHash],
    ['consumer-activation', candidate.consumerActivationHash],
  ]);
  for (const row of rows) {
    if (row.artifactHash !== expected.get(row.artifactId)) throw new Error(`reopened ${row.artifactId} differs from candidate`);
    if ('allocationHash' in row && row.allocationHash !== candidate.allocationHash) {
      throw new Error(`reopened ${row.artifactId} belongs to another allocation`);
    }
  }
  writeImmutable(path.join(candidateDir, 'outer-artifacts.json'), rows);
  process.stdout.write(`${path.resolve(ROOT, candidateDir, 'outer-artifacts.json')}\n`);
}

main();
