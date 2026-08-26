#!/usr/bin/env tsx
/**
 * Task family 6.4–6.5 (#1515): run the simulation/interactive processor
 * over every governed launcher in the production database. Each DB
 * TeachingResource with a registryId (INTERACTIVE_COMP, SIMULATION_APP,
 * ETHICS_SCENARIO) is one launcher resource; the atom binds registry
 * identity, subtype, category, and the versioned config digest with the
 * registryId as the launch anchor. Formal bindings imply nothing about
 * path eligibility, assessment authority, mastery, or learning evidence.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { projectionDigest } from '@/lib/teaching-projection/hash';
import type { ResourceProcessingRecord } from '@/lib/formal-resource-remediation/contracts';
import { createPrismaClient } from '@/lib/prisma-client';

const ROOT = process.cwd();
const OUT_DIR = 'course-content/authoring/knowledge/formal-resource-remediation/resource-layer/simulations';
const ALLOCATION_PATH = 'course-content/authoring/knowledge/formal-resource-remediation/allocation-v037-scope.json';
const LAUNCHER_TYPES = ['INTERACTIVE_COMP', 'SIMULATION_APP', 'ETHICS_SCENARIO'] as const;

interface LauncherRow {
  readonly id: string;
  readonly type: string;
  readonly registryId: string;
  readonly category: string | null;
  readonly configText: string | null;
}

function writeDeterministicJson(filePath: string, value: unknown): 'created' | 'skipped' {
  const target = path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
  mkdirSync(path.dirname(target), { recursive: true });
  const bytes = Buffer.from(`${JSON.stringify(value, null, 1)}\n`);
  if (existsSync(target)) {
    if (!readFileSync(target).equals(bytes)) throw new Error(`refusing to overwrite diverging artifact ${target}`);
    return 'skipped';
  }
  writeFileSync(target, bytes);
  return 'created';
}

async function main(): Promise<void> {
  const allocation = JSON.parse(readFileSync(path.join(ROOT, ALLOCATION_PATH), 'utf8')) as { allocationHash: string };
  const prisma = createPrismaClient();
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, type::text AS type, "registryId", category, config::text AS "configText" FROM "TeachingResource" WHERE type::text IN ('INTERACTIVE_COMP','SIMULATION_APP','ETHICS_SCENARIO') ORDER BY id`,
  ) as unknown as LauncherRow[];
  await prisma.$disconnect();
  if (rows.length === 0) throw new Error('no governed launchers found in the production database');

  const records: ResourceProcessingRecord[] = [];
  const atoms: {
    atomId: string;
    resourceId: string;
    subtype: string;
    registryId: string;
    category: string | null;
    configSha256: string;
    launchAnchor: string;
    disposition: 'BOUND';
  }[] = [];
  for (const row of rows) {
    const resourceId = `launcher-${row.registryId}-${row.id}`;
    const configSha256 = createHash('sha256').update(row.configText ?? '').digest('hex');
    const sourceIdentity = `db:TeachingResource:${row.id}:registry:${row.registryId}:config:${configSha256}`;
    const atom = {
      atomId: `atom-${projectionDigest({ resourceId, kind: 'simulation-interactive-launcher', registryId: row.registryId, configSha256 }).slice(0, 24)}`,
      resourceId,
      subtype: row.type,
      registryId: row.registryId,
      category: row.category,
      configSha256,
      launchAnchor: `registry:${row.registryId}`,
      disposition: 'BOUND' as const,
    };
    atoms.push(atom);
    records.push({
      contract: 'resource-processing-record/v1',
      recordId: `rec-${projectionDigest({ resourceId, sourceSha: configSha256 }).slice(0, 24)}`,
      allocationHash: allocation.allocationHash,
      resourceId,
      resourceSubtype: 'simulation-interactive',
      origin: 'ACTIVE_BASELINE',
      sourceIdentity,
      externalInputId: null,
      processorIdentity: 'simulation-processor/v1-db-launcher',
      validatorIdentity: 'remediation-validator/v1',
      atomOutputIds: [atom.atomId],
      mappingOutputIds: [],
      anchorOutputIds: [atom.launchAnchor],
      launchOutputIds: [atom.launchAnchor],
      disposition: 'INCLUDED',
      failureCodes: [],
      limitations: [
        'task/scene semantics and Canonical mapping are pending semantic review; bindings imply no path eligibility, assessment authority, mastery, or learning evidence',
      ],
      outputManifestHash: projectionDigest({ resourceId, atomIds: [atom.atomId] }),
    });
  }
  const summary = {
    contract: 'remediation-simulation-run/v1',
    allocationHash: allocation.allocationHash,
    launcherCount: records.length,
    byType: LAUNCHER_TYPES.map((type) => ({ type, count: records.filter((record) => atoms.find((atom) => atom.resourceId === record.resourceId)?.subtype === type).length })),
    atomCount: atoms.length,
    runHash: projectionDigest({ records: records.map((record) => record.recordId), atoms: atoms.length }),
  };
  const states = {
    records: writeDeterministicJson(`${OUT_DIR}/simulation-processing-records.json`, records),
    atoms: writeDeterministicJson(`${OUT_DIR}/simulation-atoms.json`, atoms),
    summary: writeDeterministicJson(`${OUT_DIR}/simulation-run-summary.json`, summary),
  };
  console.log(JSON.stringify({ ...summary, states }, null, 2));
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
