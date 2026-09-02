import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, beforeAll, expect, it } from 'vitest';

import {
  headCaptureDenominatorSha256,
  headRecordedCaptureDenominatorSha256,
  parseDocumentedInvocations,
  workspaceCaptureDenominatorSha256,
} from '../../../scripts/lib/tooling-cli-inventory-identity';

type InventoryEntry = {
  status: 'active' | 'compatibility' | 'unknown';
  target?: string;
};

type Inventory = {
  sourceIdentity: { captureDenominatorSha256: string; note: string };
  canonicalGates: {
    'verify:commit': string;
    'verify:push': string;
    typecheck: string;
    ciEntryPoints: string[];
  };
  namespaces: Record<string, { commands: Record<string, InventoryEntry> }>;
  documentedDirectEntries: Array<{ command: string; status: string; target: string; evidence: string }>;
  retired: Array<{ command: string; canonical: string; evidence: string }>;
  compatibility: Array<{ command: string; canonical: string; reason: string; sunset: string }>;
  unknown: Array<{ command: string; reason: string }>;
};

const VALID_STATUSES = new Set(['active', 'compatibility', 'unknown']);

function readJson(relativePath: string) {
  return JSON.parse(readFileSync(join(process.cwd(), relativePath), 'utf8'));
}

const packageJson = readJson('package.json') as { scripts: Record<string, string> };
const inventory = readJson('docs/architecture/tooling-cli-inventory.json') as Inventory;

function classifiedCommandNames(): Map<string, InventoryEntry> {
  const flattened = new Map<string, InventoryEntry>();
  for (const group of Object.values(inventory.namespaces)) {
    for (const [name, entry] of Object.entries(group.commands)) flattened.set(name, entry);
  }
  return flattened;
}

const classified = classifiedCommandNames();
const retiredNames = inventory.retired.map((entry) => entry.command);
const compatibilityNames = inventory.compatibility.map((entry) => entry.command);
const unknownNames = inventory.unknown.map((entry) => entry.command);

describe('tooling CLI inventory completeness', () => {
  it('classifies every package.json script exactly once with a valid status', () => {
    for (const [name, entry] of classified) {
      expect(VALID_STATUSES.has(entry.status), `${name} has status ${entry.status}`).toBe(true);
    }
    for (const name of Object.keys(packageJson.scripts)) {
      expect(classified.has(name), `package.json script ${name} is missing from the inventory`).toBe(true);
    }
    const duplicated = [...classified.keys()].filter((name) => name in packageJson.scripts);
    expect(new Set(duplicated).size).toBe(duplicated.length);
    expect(classified.size).toBe(Object.keys(packageJson.scripts).length);
  });

  it('keeps retired aliases deleted from package.json and bound to a live canonical entry', () => {
    expect(retiredNames.length).toBeGreaterThan(0);
    for (const entry of inventory.retired) {
      expect(packageJson.scripts[entry.command], `${entry.command} must stay deleted`).toBeUndefined();
      expect(packageJson.scripts[entry.canonical], `canonical ${entry.canonical} must exist`).toBeDefined();
      expect(entry.evidence.length).toBeGreaterThan(0);
      expect(classified.has(entry.command), `${entry.command} must not also be classified as live`).toBe(false);
    }
  });

  it('keeps compatibility adapters forwarding to an active canonical entry with a sunset condition', () => {
    expect(compatibilityNames.length).toBeGreaterThan(0);
    for (const entry of inventory.compatibility) {
      expect(packageJson.scripts[entry.command]).toBeDefined();
      const canonicalEntry = classified.get(entry.canonical);
      expect(canonicalEntry, `canonical ${entry.canonical} must be classified`).toBeDefined();
      expect(canonicalEntry?.status).toBe('active');
      expect(packageJson.scripts[entry.command]).toBe(packageJson.scripts[entry.canonical]);
      expect(entry.sunset.length).toBeGreaterThan(0);
    }
  });

  it('keeps unknown entries visible as unknown and without a canonical forwarding claim', () => {
    for (const entry of inventory.unknown) {
      expect(packageJson.scripts[entry.command]).toBeDefined();
      expect(classified.get(entry.command)?.status, `${entry.command} must be classified as unknown`).toBe('unknown');
      expect(entry.reason.length).toBeGreaterThan(0);
    }
  });

  it('binds every declared target to an existing repository file', () => {
    for (const [name, entry] of classified) {
      if (!entry.target) continue;
      expect(existsSync(join(process.cwd(), entry.target)), `${name} target ${entry.target} is missing`).toBe(true);
    }
  });
});

describe('tooling CLI delivery and graph gates', () => {
  it('preserves the verify:commit, verify:push and typecheck gate semantics', () => {
    const gates = inventory.canonicalGates;
    expect(packageJson.scripts['verify:commit']).toBe(gates['verify:commit']);
    expect(packageJson.scripts['verify:push']).toBe(gates['verify:push']);
    expect(packageJson.scripts.typecheck).toBe(gates.typecheck);
    expect(gates['verify:commit']).toContain('typecheck');
    expect(gates['verify:push']).toContain('typecheck');
    for (const ciEntry of gates.ciEntryPoints) {
      expect(packageJson.scripts[ciEntry], `CI entry ${ciEntry} must exist`).toBeDefined();
      expect(classified.get(ciEntry)?.status).toBe('active');
    }
  });

  it('keeps the five TypeScript graph gates independent', () => {
    const graphs = ['production', 'test', 'tools', 'web', 'worker'].map((graph) => {
      const script = packageJson.scripts[`typecheck:${graph === 'production' ? '' : graph}`] ?? packageJson.scripts.typecheck;
      return { graph, script };
    });
    const seen = new Set<string>();
    for (const { graph, script } of graphs) {
      expect(script, `typecheck graph ${graph} must exist`).toBeDefined();
      expect(script).toContain(`--graph ${graph}`);
      expect(seen.has(script), `typecheck graph ${graph} must not collapse into another graph`).toBe(false);
      seen.add(script);
    }
  });

  it('keeps release/rollback validation and non-activating publication checks active', () => {
    const releaseContractCommands = [
      'test:runtime-release-activation-rollback',
      'test:runtime-production-cutover-contract',
      'content-knowledge-runtime:check',
      'teaching-projection:check',
    ];
    for (const command of releaseContractCommands) {
      expect(packageJson.scripts[command], `${command} must remain defined`).toBeDefined();
      expect(classified.get(command)?.status, `${command} must stay active`).toBe('active');
    }
  });
});

describe('tooling CLI inventory source identity', () => {
  it('fails closed when the workspace or committed capture denominator drifts from the captured inventory identity', () => {
    const captured = inventory.sourceIdentity.captureDenominatorSha256;
    expect(captured).toMatch(/^[0-9a-f]{64}$/);
    expect(
      workspaceCaptureDenominatorSha256(inventory),
      'workspace capture denominator (inventory classification, package scripts, target script contents, documented invocations) drifted from the inventory; run npx tsx scripts/tests/refresh-tooling-cli-inventory-identity.ts',
    ).toBe(captured);
    expect(
      headCaptureDenominatorSha256(),
      'committed HEAD capture denominator drifted from the hash recorded by the committed inventory; refresh the identity and commit both together',
    ).toBe(headRecordedCaptureDenominatorSha256());
  });
});

describe('tooling CLI documented direct entries', () => {
  const npmTargets = new Set<string>();
  const directEntryTargets = new Set<string>();
  const directEntryCommands = new Set<string>();

  beforeAll(() => {
    for (const group of Object.values(inventory.namespaces)) {
      for (const entry of Object.values(group.commands)) {
        if (entry.target) npmTargets.add(entry.target);
      }
    }
    for (const entry of inventory.documentedDirectEntries) {
      directEntryTargets.add(entry.target);
      directEntryCommands.add(entry.command);
    }
  });

  it('classifies every documented direct-invoke entry with an existing target', () => {
    expect(inventory.documentedDirectEntries.length).toBeGreaterThan(0);
    for (const entry of inventory.documentedDirectEntries) {
      expect(entry.status).toBe('active');
      expect(entry.evidence.length).toBeGreaterThan(0);
      expect(existsSync(join(process.cwd(), entry.target)), `${entry.command} target ${entry.target} is missing`).toBe(true);
    }
  });

  it('registers every documented direct invocation by call identity, not merely by target path', () => {
    const docs = (['scripts/README.md', 'AGENTS.md'] as const)
      .map((doc) => readFileSync(join(process.cwd(), doc), 'utf8'))
      .join('\n');
    const documentedInvocations = new Set(parseDocumentedInvocations(docs));
    expect(documentedInvocations.size).toBeGreaterThan(0);
    for (const identity of documentedInvocations) {
      expect(
        directEntryCommands.has(identity),
        `${identity} is documented as a direct invocation but is not registered in documentedDirectEntries with its own command, status and evidence`,
      ).toBe(true);
    }
    for (const command of directEntryCommands) {
      expect(documentedInvocations.has(command), `registered direct entry ${command} no longer appears in scripts/README.md or AGENTS.md`).toBe(true);
    }
  });

  it('covers every script path mentioned in scripts/README.md and AGENTS.md', () => {
    const documentedPaths = new Set<string>();
    for (const doc of ['scripts/README.md', 'AGENTS.md']) {
      const text = readFileSync(join(process.cwd(), doc), 'utf8');
      for (const match of text.matchAll(/\b(?:scripts|tools)\/[A-Za-z0-9_./-]+\.(?:ts|tsx|mjs|js|py|sh)\b/g)) {
        documentedPaths.add(match[0]);
      }
    }
    expect(documentedPaths.size).toBeGreaterThan(0);
    for (const path of documentedPaths) {
      const known = npmTargets.has(path) || directEntryTargets.has(path);
      expect(known, `${path} is documented but missing from the inventory targets`).toBe(true);
    }
  });
});

describe('tooling CLI inventory privacy', () => {
  it('excludes machine absolute paths and credential-shaped values', () => {
    const serialized = JSON.stringify(inventory);
    expect(serialized).not.toMatch(/\/Users\/|\/home\/[A-Za-z0-9_-]+\/|[A-Z]:\\\\/);
    expect(serialized).not.toMatch(/(?:password|secret|token|api[-_]?key)"\s*:\s*"[^"]/i);
  });
});
