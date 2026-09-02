import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type ToolingInventoryCapture = {
  scripts: Array<[string, string]>;
  targetBlobSha1: Record<string, string>;
  documentedDirectCommands: string[];
  documentedInvocationIdentities: string[];
};

export type ToolingInventory = {
  sourceIdentity: { captureDenominatorSha256: string; note: string };
  namespaces: Record<string, { commands: Record<string, { target?: string }> }>;
  documentedDirectEntries: Array<{ command: string; target: string }>;
};

/** Git blob sha1 of file contents, matching `git hash-object`. */
export function gitBlobSha1(content: Buffer | string): string {
  const body = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
  const header = Buffer.from(`blob ${body.length}\0`, 'utf8');
  return createHash('sha1').update(Buffer.concat([header, body])).digest('hex');
}

/** Direct-invoke operator identities (bin + path) documented in README.md or AGENTS.md. */
export function parseDocumentedInvocations(docText: string): string[] {
  const identities = new Set<string>();
  const pattern = /\b(?:rtk )?(node|npx tsx|tsx|bash|python3) ((?:scripts|tools)\/[A-Za-z0-9_./-]+\.(?:ts|tsx|mjs|js|py|sh))\b/g;
  for (const match of docText.matchAll(pattern)) {
    identities.add(`${match[1]} ${match[2]}`);
  }
  return [...identities].sort();
}

function collectTargets(inventory: ToolingInventory): string[] {
  const targets = new Set<string>();
  for (const group of Object.values(inventory.namespaces)) {
    for (const entry of Object.values(group.commands)) {
      if (entry.target) targets.add(entry.target);
    }
  }
  for (const entry of inventory.documentedDirectEntries) targets.add(entry.target);
  return [...targets].sort();
}

function readWorkspace(target: string): Buffer {
  return readFileSync(join(process.cwd(), target));
}

function readHead(target: string): Buffer {
  return Buffer.from(execFileSync('git', ['show', `HEAD:${target}`]), 'buffer');
}

/** Full capture denominator recomputed from a file source (workspace or git HEAD). */
export function computeCapture(
  inventory: ToolingInventory,
  readRawPackageJson: () => string,
  readDoc: (doc: 'scripts/README.md' | 'AGENTS.md') => string,
  readFile: (target: string) => Buffer,
): ToolingInventoryCapture {
  const scripts = JSON.parse(readRawPackageJson()) as { scripts: Record<string, string> };
  const targetBlobSha1: Record<string, string> = {};
  for (const target of collectTargets(inventory)) {
    targetBlobSha1[target] = gitBlobSha1(readFile(target));
  }
  const docs = (['scripts/README.md', 'AGENTS.md'] as const).map(readDoc).join('\n');
  return {
    scripts: Object.keys(scripts.scripts).sort().map((key) => [key, scripts.scripts[key]]),
    targetBlobSha1,
    documentedDirectCommands: inventory.documentedDirectEntries.map((e) => e.command).sort(),
    documentedInvocationIdentities: parseDocumentedInvocations(docs),
  };
}

export function captureDenominatorSha256(capture: ToolingInventoryCapture): string {
  const canonicalTargetBlobSha1 = Object.keys(capture.targetBlobSha1).sort()
    .map((target) => [target, capture.targetBlobSha1[target]]);
  const canonical = JSON.stringify({
    scripts: capture.scripts,
    targetBlobSha1: canonicalTargetBlobSha1,
    documentedDirectCommands: capture.documentedDirectCommands,
    documentedInvocationIdentities: capture.documentedInvocationIdentities,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

export function workspaceCaptureDenominatorSha256(inventory: ToolingInventory): string {
  return captureDenominatorSha256(computeCapture(
    inventory,
    () => readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
    (doc) => readFileSync(join(process.cwd(), doc), 'utf8'),
    readWorkspace,
  ));
}

export function headCaptureDenominatorSha256(inventory: ToolingInventory): string {
  return captureDenominatorSha256(computeCapture(
    inventory,
    () => execFileSync('git', ['show', 'HEAD:package.json'], { encoding: 'utf8' }),
    (doc) => execFileSync('git', ['show', `HEAD:${doc}`], { encoding: 'utf8' }),
    readHead,
  ));
}

export function refreshIdentity(inventory: ToolingInventory): ToolingInventory {
  return {
    ...inventory,
    sourceIdentity: {
      captureDenominatorSha256: workspaceCaptureDenominatorSha256(inventory),
      note: 'captureDenominatorSha256 binds this inventory to its full capture denominator: the package.json scripts object (sorted), the git blob sha1 of every declared target file, the documented direct-invoke command list, and the direct-invoke operator identities parsed from scripts/README.md and AGENTS.md. Any later change to command bodies, target script contents, documented invocations, or inventory classification without an identity refresh fails closed in tooling-cli-inventory.test.ts via workspace and git-HEAD double comparison. Refresh with: npx tsx scripts/tests/refresh-tooling-cli-inventory-identity.ts',
    },
  };
}
