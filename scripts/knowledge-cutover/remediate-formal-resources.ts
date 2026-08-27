#!/usr/bin/env tsx
/**
 * Formal resource and teaching-projection remediation CLI (#1515).
 *
 * Version-neutral orchestration over src/lib/formal-resource-remediation:
 *   seal-allocation   seal the ONE shared coordination allocation
 *   process-text      run handout/lecture/card processors over real corpus
 *   run-relations     reopen the scope, run the three-family pipeline,
 *                     and persist immutable domain review packs
 *   apply-decisions   apply course-owner decisions and count unresolved rows
 *
 * Discovery inputs (resource inventories, pending rows) are declared files,
 * never workspace scans; completion is derived from reopened artifacts.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { projectionDigest } from '@/lib/teaching-projection/hash';

import type { ResourceProcessingRecord } from '@/lib/formal-resource-remediation/contracts';
import { sealRemediationAllocation } from '@/lib/formal-resource-remediation/allocation';
import { processCard, processHandout } from '@/lib/formal-resource-remediation/processors/text';
import { reopenScopeArtifact } from '@/lib/formal-resource-remediation/relations/scope';
import { runRelationPipeline } from '@/lib/formal-resource-remediation/relations/pipeline';

function fail(message: string): never {
  throw new Error(`remediate-formal-resources: ${message}`);
}

function parseArgs(argv: string[]): { command: string; values: Map<string, string> } {
  const [command, ...rest] = argv;
  if (!command) fail('missing subcommand (seal-allocation|process-text|run-relations|apply-decisions)');
  const values = new Map<string, string>();
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!key?.startsWith('--') || !value || value.startsWith('--')) {
      fail(`invalid argument near ${key ?? '<end>'}`);
    }
    if (values.has(key)) fail(`duplicate option ${key}`);
    values.set(key, value);
  }
  return { command, values };
}

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(path.resolve(filePath), 'utf8')) as unknown;
}

async function writeImmutable(filePath: string, content: string): Promise<void> {
  const absolute = path.resolve(filePath);
  await mkdir(path.dirname(absolute), { recursive: true });
  const existing = await readFile(absolute, 'utf8').catch(() => null);
  if (existing !== null && existing !== content) {
    fail(`refusing to overwrite immutable artifact ${absolute}`);
  }
  if (existing === null) await writeFile(absolute, content);
}

function required(values: Map<string, string>, key: string): string {
  const value = values.get(key);
  if (!value) fail(`missing ${key}`);
  return value;
}

async function sha256File(filePath: string): Promise<string> {
  return createHash('sha256').update(await readFile(filePath)).digest('hex');
}

async function runSealAllocation(values: Map<string, string>): Promise<void> {
  const capturePath = required(values, '--capture');
  const outPath = required(values, '--out');
  const capture = await readJson(capturePath) as {
    captureHash: string;
    compatibility: Parameters<typeof sealRemediationAllocation>[0]['capture'];
  };
  const allocation = sealRemediationAllocation({
    sealedAt: new Date().toISOString(),
    capture,
    scopeHash: required(values, '--scope-hash'),
    denominatorHash: required(values, '--denominator-hash'),
    policyVersions: { continuity: 'resource-continuity/v1', teachingClosure: 'coordinated-teaching-closure/v1' },
    implementationIdentities: { shared: 'latest-authority-oss-cutover-builder/v1' },
    remediation: {
      terminologyRegistryId: required(values, '--terminology-registry'),
      localeIdentity: required(values, '--locale'),
      sourceRegistryIds: required(values, '--source-registries').split(','),
      processorRegistryHash: required(values, '--processor-registry-hash'),
      courseOwnerId: required(values, '--course-owner'),
    },
  });
  await writeImmutable(outPath, `${JSON.stringify(allocation, null, 2)}\n`);
  process.stdout.write(`allocation=${allocation.allocationHash}\nrunId=${allocation.coordinationRunId}\n`);
}

interface TextInventoryEntry {
  readonly resourceId: string;
  readonly subtype: 'handout' | 'card';
  readonly absolutePath: string;
  readonly derivedPdfRelativePath?: string;
}

async function runProcessText(values: Map<string, string>): Promise<void> {
  const allocationPath = required(values, '--allocation');
  const inventoryPath = required(values, '--inventory');
  const outDir = required(values, '--out');
  const allocation = await readJson(allocationPath) as { allocationHash: string };
  const inventory = await readJson(inventoryPath) as { entries: TextInventoryEntry[] };
  if (inventory.entries.length === 0) fail('text inventory is empty');
  const records: ResourceProcessingRecord[] = [];
  const atoms: unknown[] = [];
  for (const entry of inventory.entries) {
    const sourceSha = await sha256File(entry.absolutePath);
    const markdown = await readFile(entry.absolutePath, 'utf8');
    const result = entry.subtype === 'card'
      ? processCard({ resourceId: entry.resourceId, markdown, sourceContentSha256: sourceSha })
      : {
        atoms: processHandout({
          resourceId: entry.resourceId,
          subtype: 'handout',
          markdown,
          sourceContentSha256: sourceSha,
          derivedPdfRelativePath: entry.derivedPdfRelativePath ?? null,
        }).atoms,
      };
    for (const atom of result.atoms) {
      atoms.push(atom);
    }
    records.push({
      contract: 'resource-processing-record/v1',
      recordId: `rec-${projectionDigest({ resourceId: entry.resourceId, sourceSha }).slice(0, 24)}`,
      allocationHash: allocation.allocationHash,
      resourceId: entry.resourceId,
      resourceSubtype: entry.subtype,
      origin: 'ACTIVE_BASELINE',
      sourceIdentity: `content:${sourceSha}`,
      externalInputId: null,
      processorIdentity: entry.subtype === 'card' ? 'card-processor/v1' : 'handout-processor/v1',
      validatorIdentity: 'remediation-validator/v1',
      atomOutputIds: result.atoms.map((atom) => atom.atomId),
      mappingOutputIds: result.atoms.filter((atom) => atom.disposition === 'BOUND').map((atom) => atom.atomId),
      anchorOutputIds: result.atoms.map((atom) => atom.paragraphId),
      launchOutputIds: result.atoms.map((atom) => atom.launchDescriptor.paragraphId),
      disposition: 'INCLUDED',
      failureCodes: [],
      limitations: [],
      outputManifestHash: projectionDigest(result.atoms.map((atom) => atom.atomId)),
    });
  }
  const summary = {
    contract: 'remediation-text-run/v1',
    allocationHash: allocation.allocationHash,
    resourceCount: records.length,
    atomCount: atoms.length,
    runHash: projectionDigest({ records: records.map((record) => record.recordId), atoms: atoms.length }),
  };
  await writeImmutable(path.join(outDir, 'text-processing-records.json'), `${JSON.stringify(records, null, 2)}\n`);
  await writeImmutable(path.join(outDir, 'text-atoms.json'), `${JSON.stringify(atoms, null, 2)}\n`);
  await writeImmutable(path.join(outDir, 'text-run-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`resources=${records.length} atoms=${atoms.length}\n`);
}

async function runRunRelations(values: Map<string, string>): Promise<void> {
  const scopePath = required(values, '--scope');
  const pendingPath = required(values, '--pending');
  const outDir = required(values, '--out');
  const scopeArtifact = await readJson(scopePath) as Parameters<typeof reopenScopeArtifact>[0]['scope'];
  const scope = reopenScopeArtifact({
    courseId: required(values, '--course-id'),
    scope: scopeArtifact,
    expectedAuthorityReleaseId: required(values, '--authority-release'),
    expectedAuthoritySnapshotHash: required(values, '--authority-snapshot'),
  });
  const pendingRows = (await readFile(pendingPath, 'utf8'))
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Parameters<typeof runRelationPipeline>[0]['pendingRows'][number]);
  const result = runRelationPipeline({ scope, pendingRows, evidenceRegistry: null });
  await writeImmutable(path.join(outDir, 'relation-review-packs.json'), `${JSON.stringify(result.reviewPacks, null, 2)}\n`);
  await writeImmutable(path.join(outDir, 'relation-pipeline-summary.json'), `${JSON.stringify({
    contract: 'remediation-relation-run/v1',
    scopeHash: scope.scopeHash,
    memberCount: scope.memberCount,
    pendingRowCount: result.pendingRowCount,
    admittedRowCount: result.admittedRowCount,
    reviewPackCount: result.reviewPacks.length,
    pipelineHash: result.pipelineHash,
  }, null, 2)}\n`);
  process.stdout.write(
    `members=${scope.memberCount} pending=${result.pendingRowCount} admitted=${result.admittedRowCount} packs=${result.reviewPacks.length}\n`,
  );
}

async function main(): Promise<void> {
  const { command, values } = parseArgs(process.argv.slice(2));
  const allowedByCommand: Record<string, readonly string[]> = {
    'seal-allocation': ['--capture', '--out', '--scope-hash', '--denominator-hash', '--terminology-registry', '--locale', '--source-registries', '--processor-registry-hash', '--course-owner'],
    'process-text': ['--allocation', '--inventory', '--out'],
    'run-relations': ['--scope', '--pending', '--out', '--course-id', '--authority-release', '--authority-snapshot'],
    'apply-decisions': [],
  };
  const allowed = allowedByCommand[command];
  if (!allowed) fail(`unknown subcommand ${command}`);
  for (const key of values.keys()) {
    if (!allowed.includes(key)) fail(`unknown option ${key} for ${command}`);
  }
  if (command === 'seal-allocation') await runSealAllocation(values);
  else if (command === 'process-text') await runProcessText(values);
  else if (command === 'run-relations') await runRunRelations(values);
  else fail('apply-decisions is executed through the decision-applier tooling after course-owner review');
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
