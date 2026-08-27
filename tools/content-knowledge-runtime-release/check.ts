import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { worktreeIsClean } from '../boundary/git-source';
import { findProductToolEdges } from '../boundary/product-imports';
import { buildCommandReceipt, commandInputHash, evaluateApplyGate, hashValue } from './apply-gate';
import {
  classifyReleasePath,
  collectReleaseBlobs,
  compareCodepoints,
  countByRoot,
  inventoryReleaseCommands,
  listTracked,
} from './classify';
import { findUngatedPublicationPackageScripts } from './entrypoints';
import type { CommandReceipt, InventoryCommandRecord, ReleaseCommand } from './types';
import {
  CHARACTERIZATION_PATHS,
  FROZEN_COUNTS,
  PROJECTION_HANDOFF,
  RELEASE_TOOLCHAIN_SCHEMA_VERSION,
  SOURCE_ROOTS,
} from './types';

export interface ReleaseCheckResult {
  readonly ok: boolean;
  readonly failures: string[];
  readonly commands: readonly ReleaseCommand[];
  readonly blobs: ReadonlyMap<string, string>;
  readonly counts: ReturnType<typeof countByRoot>;
  readonly sampleReceipt: CommandReceipt;
  readonly characterization: {
    readonly content: CommandReceipt;
    readonly knowledge: CommandReceipt;
    readonly runtime: CommandReceipt;
  };
}

export function commandRecords(
  commands: readonly ReleaseCommand[],
  blobs: ReadonlyMap<string, string>,
): InventoryCommandRecord[] {
  return commands.map((item) => ({
    path: item.path,
    commandId: item.commandId,
    toolchain: item.toolchain,
    owner: item.owner,
    role: item.role,
    safetyMode: item.safetyMode,
    contentHash: commandInputHash(item, blobs.get(item.path) ?? ''),
  }));
}

export function inventoryFingerprint(rows: readonly InventoryCommandRecord[]): string {
  return rows
    .map((row) => [row.path, row.commandId, row.toolchain, row.owner, row.role, row.safetyMode, row.contentHash].join('\t'))
    .sort((left, right) => compareCodepoints(left, right))
    .join('\n');
}

export function resolveCommand(
  commands: readonly ReleaseCommand[],
  token: string | undefined,
): ReleaseCommand | undefined {
  if (!token) return undefined;
  return commands.find((item) => item.path === token || item.commandId === token);
}

function characterizationReceipt(
  commands: readonly ReleaseCommand[],
  blobs: ReadonlyMap<string, string>,
  path: string,
  sourceRevision: string,
  sourceTree: string,
): CommandReceipt {
  const command = commands.find((item) => item.path === path) ?? classifyReleasePath(path);
  const blob = blobs.get(path) ?? '';
  const inputHash = commandInputHash(command, blob);
  return buildCommandReceipt({
    command,
    sourceRevision,
    sourceTree,
    planHash: inputHash,
    inputHash,
    outputDigest: hashValue(`not-executed:${path}:${command.role}:${blob}`),
    targetIdentity: 'fixture:unspecified',
    gate: evaluateApplyGate({
      mode: 'dry-run',
      approval: null,
      planHash: inputHash,
      currentInputHash: inputHash,
      targetIdentity: 'fixture:unspecified',
    }),
  });
}

export function checkContentKnowledgeRuntimeRelease(cwd: string): ReleaseCheckResult {
  const failures: string[] = [];
  if (!worktreeIsClean(cwd)) failures.push('dirty-worktree');
  const headRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
  const headTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd, encoding: 'utf8' }).trim();
  let sourceRevision = headRevision;
  let sourceTree = headTree;
  const commands = inventoryReleaseCommands(cwd);
  const blobs = collectReleaseBlobs(cwd);
  const counts = countByRoot(commands);

  for (const root of SOURCE_ROOTS) {
    if (counts[root] !== FROZEN_COUNTS[root]) {
      failures.push(`count-drift:${root}:${counts[root]}`);
    }
  }
  if (commands.some((item) => !item.owner || !item.commandId || !item.role)) {
    failures.push('unclassified-release-entry');
  }
  if (commands.some((item) => !blobs.get(item.path))) failures.push('missing-command-blob');
  if (!commands.some((item) => item.toolchain === 'content-compiler' && item.role === 'compiler')) {
    failures.push('missing-content-compiler');
  }
  if (!commands.some((item) => item.toolchain === 'knowledge-release' && item.role === 'publication-writer')) {
    failures.push('missing-knowledge-publication-writer');
  }
  if (!commands.some((item) => item.toolchain === 'runtime-release' && item.role === 'publication-writer')) {
    failures.push('missing-runtime-publication-writer');
  }
  if (!commands.some((item) => item.role === 'operator-adapter')) {
    failures.push('missing-operator-adapter');
  }
  for (const path of Object.values(CHARACTERIZATION_PATHS)) {
    if (!commands.some((item) => item.path === path)) failures.push(`characterization-missing:${path}`);
  }

  const writers = commands.filter((item) => (
    item.role === 'publication-writer' || item.role === 'compiler' || item.role === 'candidate-adapter'
  ));
  const productFiles = [
    ...listTracked(cwd, 'src'),
    ...listTracked(cwd, 'scripts/workers'),
  ].filter((path) => (
    !path.includes('/__tests__/')
    && !path.includes('/fixtures/')
    && !/\.(?:test|spec)\./.test(path)
  ));
  for (const edge of findProductToolEdges(cwd, [...productFiles, ...writers.map((item) => item.path)])) {
    const target = writers.find((item) => edge.to === item.path || edge.to.startsWith(`${item.path}`));
    if (target) failures.push(`product-to-release-writer:${edge.from}->${edge.to}`);
  }

  for (const hit of findUngatedPublicationPackageScripts(cwd, commands)) {
    failures.push(`ungated-npm-script:${hit.name}:${hit.path}`);
  }

  const inventoryPath = join(cwd, 'docs/architecture/content-knowledge-runtime-release/inventory.json');
  if (!existsSync(inventoryPath)) {
    failures.push('inventory-missing');
  } else {
    const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8')) as {
      sourceRevision?: string;
      sourceTree?: string;
      generatedInputs?: unknown[];
      commands?: InventoryCommandRecord[];
    };
    if (inventory.generatedInputs && inventory.generatedInputs.length > 0) {
      failures.push('generated-input-mixed-into-denominator');
    }
    if (!inventory.sourceRevision || !inventory.sourceTree) {
      failures.push('inventory-missing-source-revision');
    } else {
      try {
        execFileSync('git', ['cat-file', '-e', `${inventory.sourceRevision}^{commit}`], { cwd });
        const capturedTree = execFileSync('git', ['rev-parse', `${inventory.sourceRevision}^{tree}`], {
          cwd,
          encoding: 'utf8',
        }).trim();
        if (inventory.sourceTree !== capturedTree) {
          failures.push('inventory-source-tree-mismatch');
        } else {
          sourceRevision = inventory.sourceRevision;
          sourceTree = inventory.sourceTree;
        }
      } catch {
        failures.push('inventory-revision-unreadable');
      }
    }
    const records = commandRecords(commands, blobs);
    if (!inventory.commands || inventory.commands.length === 0) {
      failures.push('inventory-missing-content-hash');
    } else if (inventoryFingerprint(inventory.commands) !== inventoryFingerprint(records)) {
      failures.push('inventory-command-set-drift');
    }
  }

  const sampleReceipt = characterizationReceipt(
    commands,
    blobs,
    CHARACTERIZATION_PATHS.content,
    sourceRevision,
    sourceTree,
  );
  const characterization = {
    content: sampleReceipt,
    knowledge: characterizationReceipt(commands, blobs, CHARACTERIZATION_PATHS.knowledge, sourceRevision, sourceTree),
    runtime: characterizationReceipt(commands, blobs, CHARACTERIZATION_PATHS.runtime, sourceRevision, sourceTree),
  };
  if (characterization.knowledge.projectionHandoff?.owner !== PROJECTION_HANDOFF.owner) {
    failures.push('knowledge-projection-handoff-missing');
  }
  if (
    sampleReceipt.executed
    || sampleReceipt.productionActivation
    || characterization.runtime.selectorMutation
  ) {
    failures.push('receipt-claimed-execution');
  }
  if (!sampleReceipt.schemaVersion.startsWith(RELEASE_TOOLCHAIN_SCHEMA_VERSION.slice(0, 20))) {
    failures.push('schema-mismatch');
  }
  const serialized = JSON.stringify({
    sampleReceipt: { ...sampleReceipt, commandId: 'redacted-command' },
    characterization: {
      content: { ...characterization.content, commandId: 'redacted-command' },
      knowledge: { ...characterization.knowledge, commandId: 'redacted-command' },
      runtime: { ...characterization.runtime, commandId: 'redacted-command' },
    },
  });
  if (/\/Users\/|\/home\/|NEXTAUTH_SECRET|DATABASE_URL=/.test(serialized)) {
    failures.push('privacy-unsafe-receipt');
  }

  return {
    ok: failures.length === 0,
    failures,
    commands,
    blobs,
    counts,
    sampleReceipt,
    characterization,
  };
}

