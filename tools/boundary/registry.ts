import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ClassifiedEntry, SourceDenominator, ToolRegistry, ToolRegistryRecord } from './types';
import { TOOLCHAIN_REGISTRY_SCHEMA_VERSION } from './types';

function commandForClass(toolClass: ClassifiedEntry['toolClass']): { commandId: string; testCommand: string; outputContract: string } {
  switch (toolClass) {
    case 'content-export-review':
      return { commandId: 'toolchain:content-export-review', testCommand: 'typecheck:tools', outputContract: 'public-content-runtime-manifest' };
    case 'knowledge-release':
      return { commandId: 'toolchain:knowledge-release', testCommand: 'typecheck:tools', outputContract: 'public-knowledge-release-manifest' };
    case 'runtime-oss-release':
      return { commandId: 'toolchain:runtime-oss-release', testCommand: 'typecheck:tools', outputContract: 'public-runtime-release-manifest' };
    case 'evidence-visual-qa':
      return { commandId: 'toolchain:evidence-visual-qa', testCommand: 'typecheck:test', outputContract: 'private-run-evidence-reference' };
    case 'migration-backfill':
      return { commandId: 'toolchain:migration-backfill', testCommand: 'typecheck:tools', outputContract: 'apply-gated-receipt' };
    case 'competition-material':
      return { commandId: 'toolchain:competition-material', testCommand: 'typecheck:tools', outputContract: 'private-run-evidence-reference' };
    case 'adapter':
      return { commandId: 'toolchain:boundary-check', testCommand: 'typecheck:tools', outputContract: 'boundary-registry-and-receipt' };
    case 'historical-evidence':
      return { commandId: 'toolchain:historical-evidence', testCommand: 'typecheck:test', outputContract: 'private-run-evidence-reference' };
    case 'existing-unrelated-tool':
      return { commandId: 'toolchain:existing-unrelated-tool', testCommand: 'typecheck:tools', outputContract: 'existing-tool-owned-outside-series' };
    default:
      return { commandId: 'toolchain:fixture', testCommand: 'typecheck:test', outputContract: 'fixture-only' };
  }
}

export function buildToolRegistry(
  denominator: SourceDenominator,
  entries: readonly ClassifiedEntry[],
): ToolRegistry {
  const grouped = new Map<string, ClassifiedEntry[]>();
  for (const entry of entries) {
    const key = `${entry.toolClass}:${entry.owner}`;
    const current = grouped.get(key) ?? [];
    current.push(entry);
    grouped.set(key, current);
  }

  const records: ToolRegistryRecord[] = [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, group]) => {
      const representative = group[0]!;
      const command = commandForClass(representative.toolClass);
      return {
        toolId: key,
        toolClass: representative.toolClass,
        owner: representative.owner,
        commandId: command.commandId,
        sourceRevision: denominator.sourceRevision,
        sourceTree: denominator.sourceTree,
        inputManifest: `git-ls-files:${representative.familyId}`,
        outputContract: command.outputContract,
        safetyMode: representative.safetyMode,
        privacyClass: representative.privacyClass,
        graphId: command.testCommand === 'typecheck:test' ? 'test' : 'tools',
        testCommand: command.testCommand,
        retirementCondition: representative.retirementCondition,
        followUpChange: representative.followUpChange,
        paths: group.map((item) => item.path).sort((left, right) => left.localeCompare(right)),
      };
    });

  return {
    schemaVersion: TOOLCHAIN_REGISTRY_SCHEMA_VERSION,
    sourceRevision: denominator.sourceRevision,
    sourceTree: denominator.sourceTree,
    denominatorDigest: denominator.digest,
    records,
  };
}

export function validateRegistry(registry: ToolRegistry): string[] {
  const failures: string[] = [];
  const commandOwners = new Map<string, string>();
  for (const record of registry.records) {
    if (!record.owner || !record.toolClass || !record.commandId) {
      failures.push(`incomplete-record:${record.toolId}`);
    }
    const existing = commandOwners.get(record.commandId);
    if (existing && existing !== record.owner) {
      failures.push(`duplicate-command:${record.commandId}:${existing}:${record.owner}`);
    } else {
      commandOwners.set(record.commandId, record.owner);
    }
    if (record.paths.length === 0) failures.push(`empty-denominator:${record.toolId}`);
  }
  return failures;
}

export function readPackageScripts(cwd: string): Record<string, string> {
  const raw = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')) as { scripts?: Record<string, string> };
  return raw.scripts ?? {};
}
