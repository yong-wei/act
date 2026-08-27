import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { listTrackedFiles, worktreeIsClean } from './git-source';
import { buildSourceDenominator } from './denominator';
import { findProductToolEdges, findProductToolPathReads, PRODUCT_SCAN_ROOTS } from './product-imports';
import { buildCommandReceipt, digestRegistry, validateReceipt } from './receipt';
import { buildToolRegistry, validateRegistry } from './registry';
import type {
  BoundaryFailure,
  GeneratedInputRecord,
  ProductToolPathRead,
  SourceDenominator,
  ToolRegistry,
} from './types';
import { SOURCE_FAMILIES, TOOLCHAIN_BOUNDARY_SCHEMA_VERSION } from './types';

export interface BoundaryCheckResult {
  readonly ok: boolean;
  readonly failures: BoundaryFailure[];
  readonly denominator: SourceDenominator;
  readonly registry: ToolRegistry;
  readonly preexistingPathReads: readonly ProductToolPathRead[];
}

function pathReadKey(item: ProductToolPathRead): string {
  return `${item.from}\0${item.to}`;
}

function loadAllowedPathReads(cwd: string): ProductToolPathRead[] {
  const allowlistPath = join(cwd, 'tools/boundary/allowed-product-path-reads.json');
  if (!existsSync(allowlistPath)) return [];
  return JSON.parse(readFileSync(allowlistPath, 'utf8')) as ProductToolPathRead[];
}

export function checkToolchainBoundary(
  cwd: string,
  generatedInputs: readonly GeneratedInputRecord[] = [],
): BoundaryCheckResult {
  const failures: BoundaryFailure[] = [];
  if (!worktreeIsClean(cwd)) {
    failures.push({
      code: 'dirty-worktree',
      message: 'Source revision/tree cannot be bound while the worktree has staged, unstaged, or untracked changes',
    });
  }
  const { denominator, entries, unresolved } = buildSourceDenominator(cwd, generatedInputs);
  for (const path of unresolved) {
    failures.push({ code: 'unclassified-entry', message: 'Tracked tool entry has no class or owner', path });
  }

  const registry = buildToolRegistry(denominator, entries);
  for (const message of validateRegistry(registry)) {
    failures.push({ code: 'registry-invalid', message });
  }

  const tracked = [
    ...SOURCE_FAMILIES.flatMap((family) => listTrackedFiles(cwd, family.path)),
    ...PRODUCT_SCAN_ROOTS.flatMap((root) => listTrackedFiles(cwd, root)),
  ];
  const productionEdges = findProductToolEdges(cwd, tracked);
  for (const edge of productionEdges) {
    failures.push({
      code: 'product-to-tool-import',
      message: `${edge.from} imports ${edge.to} via ${edge.specifier}`,
      path: edge.from,
    });
  }

  const preexistingPathReads = findProductToolPathReads(cwd, tracked);
  const allowed = new Set(loadAllowedPathReads(cwd).map(pathReadKey));
  for (const read of preexistingPathReads) {
    if (allowed.has(pathReadKey(read))) continue;
    failures.push({
      code: 'product-to-tool-path-read',
      message: `${read.from} reads tool path ${read.to}`,
      path: read.from,
    });
  }

  const receipt = buildCommandReceipt({
    commandId: 'toolchain:boundary-check',
    sourceRevision: denominator.sourceRevision,
    sourceTree: denominator.sourceTree,
    inputDigest: denominator.digest,
    outputDigest: digestRegistry(registry),
    validatorVersion: TOOLCHAIN_BOUNDARY_SCHEMA_VERSION,
    exitStatus: failures.length === 0 ? 0 : 1,
    graphId: 'tools',
    privacyClass: 'none',
    safetyMode: 'read-only',
  });
  for (const message of validateReceipt(receipt)) {
    failures.push({ code: 'receipt-invalid', message });
  }

  return {
    ok: failures.length === 0,
    failures,
    denominator,
    registry,
    preexistingPathReads,
  };
}
