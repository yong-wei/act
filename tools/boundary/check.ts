import { listTrackedFiles } from './git-source';
import { buildSourceDenominator } from './denominator';
import { findProductToolEdges, findProductToolPathReads } from './product-imports';
import { buildCommandReceipt, digestJson, validateReceipt } from './receipt';
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

export function checkToolchainBoundary(
  cwd: string,
  generatedInputs: readonly GeneratedInputRecord[] = [],
): BoundaryCheckResult {
  const failures: BoundaryFailure[] = [];
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
    ...listTrackedFiles(cwd, 'src'),
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

  const receipt = buildCommandReceipt({
    commandId: 'toolchain:boundary-check',
    sourceRevision: denominator.sourceRevision,
    sourceTree: denominator.sourceTree,
    inputDigest: denominator.digest,
    outputDigest: digestJson({
      schemaVersion: TOOLCHAIN_BOUNDARY_SCHEMA_VERSION,
      registry: registry.denominatorDigest,
      recordCount: registry.records.length,
    }),
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
