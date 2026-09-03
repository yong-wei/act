#!/usr/bin/env tsx
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { privacyViolation } from '../src/lib/architecture-census/privacy';
import { serializeDeterministic, sha256Text } from '../src/lib/architecture-census/serialize';
import {
  REQUIRED_SUCCESSOR,
  RESIDUAL_DENOMINATOR_PREFIX,
  RESIDUAL_SCHEMA_VERSION,
  adjudicateResidualDataGovernance,
  memberSetDigest,
  projectResidualDocuments,
  type Issue1876Snapshot,
  type ResidualAdjudication,
  type ResidualCallerInput,
  type ResidualMemberInput,
} from '../src/lib/architecture-charter/residual-data-governance';

const OUTPUT_DIR = 'docs/architecture/modular-monolith/post-convergence/residual-data-governance';
const TOOL_FILES = [
  'src/lib/architecture-charter/residual-data-governance.ts',
  'scripts/architecture-residual-data-governance.ts',
];

function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim();
}

function ghIssue(): Issue1876Snapshot {
  const payload = JSON.parse(execFileSync('gh', [
    'api',
    'graphql',
    '-f',
    'query={ repository(owner:"yong-wei", name:"act") { issue(number:1876) { number state labels(first:20) { nodes { name } } blockedBy(first:20) { nodes { number state } } } } }',
  ], { encoding: 'utf8' })) as {
    data: {
      repository: {
        issue: {
          number: number;
          state: string;
          labels: { nodes: { name: string }[] };
          blockedBy: { nodes: { number: number; state: string }[] };
        };
      };
    };
  };
  const issue = payload.data.repository.issue;
  return {
    number: 1876,
    state: issue.state,
    labels: issue.labels.nodes.map((node) => node.name),
    blockedBy: issue.blockedBy.nodes,
  };
}

function loadMembers(): ResidualMemberInput[] {
  return git(['ls-tree', '-r', '--name-only', REQUIRED_SUCCESSOR.sourceCommit, '--', 'src/lib/data-governance'])
    .split('\n')
    .filter(Boolean)
    .sort()
    .map((path) => ({ path, currentOwnerEvidence: [`sourceTree:${REQUIRED_SUCCESSOR.sourceTree}`] }));
}

function loadCallers(members: readonly ResidualMemberInput[]): ResidualCallerInput[] {
  const tokens = new Map<string, string[]>();
  for (const member of members) {
    const relative = member.path.replace(/^src\/lib\//u, '');
    for (const token of [member.path, relative]) {
      const bucket = tokens.get(token) ?? [];
      bucket.push(member.path);
      tokens.set(token, bucket);
    }
  }
  const grep = git([
    'grep',
    '-F',
    'lib/data-governance/',
    REQUIRED_SUCCESSOR.sourceCommit,
    '--',
    '*.ts',
    '*.tsx',
    '*.mjs',
    '*.md',
  ]);
  const callers: ResidualCallerInput[] = [];
  const seen = new Set<string>();
  for (const line of grep.split('\n')) {
    const match = line.match(/^[^:]+:([^:]+):(.*)$/u);
    if (!match) continue;
    const callerPath = match[1] ?? '';
    const text = match[2] ?? '';
    if (!callerPath) continue;
    const hits = new Set<string>();
    for (const [token, memberPaths] of tokens) {
      if (!text.includes(token)) continue;
      for (const memberPath of memberPaths) hits.add(memberPath);
    }
    for (const memberPath of hits) {
      if (callerPath === memberPath) continue;
      const key = `${memberPath}|${callerPath}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const relationship = callerPath.startsWith('openspec/changes/archive/')
        ? 'historical'
        : callerPath.startsWith('openspec/') || callerPath.startsWith('docs/')
          ? 'documentation'
          : /export .* from/u.test(text)
            ? 're-export'
            : 'import';
      callers.push({ memberPath, callerPath, relationship });
    }
  }
  return callers.sort((left, right) => (
    left.memberPath.localeCompare(right.memberPath) || left.callerPath.localeCompare(right.callerPath)
  ));
}

function verifyOwnerResidue(): void {
  const text = readFileSync(join(process.cwd(), 'docs/architecture/modular-monolith/post-convergence/owner-residue.md'), 'utf8');
  const digest = sha256Text(text);
  if (digest !== REQUIRED_SUCCESSOR.ownerResidueSha256) {
    throw new Error(`owner-residue-digest-mismatch:${digest}`);
  }
}

function verifySourceTree(): void {
  const tree = git(['rev-parse', `${REQUIRED_SUCCESSOR.sourceCommit}^{tree}`]);
  if (tree !== REQUIRED_SUCCESSOR.sourceTree) throw new Error(`source-tree-mismatch:${tree}`);
}

function fullInventoryVerified(): boolean {
  const locator = join(process.cwd(), REQUIRED_SUCCESSOR.fullInventoryLocator);
  try {
    const bytes = readFileSync(locator);
    return sha256Text(bytes.toString('utf8')) === REQUIRED_SUCCESSOR.fullInventorySha256
      || sha256Text(bytes.toString('binary')) === REQUIRED_SUCCESSOR.fullInventorySha256;
  } catch {
    return false;
  }
}

function toolIdentity(): { toolCommit: string; toolTree: string; entryBundleDigest: string } {
  const files = Object.fromEntries(TOOL_FILES.map((path) => [path, readFileSync(join(process.cwd(), path), 'utf8')]));
  return {
    toolCommit: git(['rev-parse', 'HEAD']),
    toolTree: git(['rev-parse', 'HEAD^{tree}']),
    entryBundleDigest: sha256Text(serializeDeterministic(files)),
  };
}

function main(): void {
  verifyOwnerResidue();
  verifySourceTree();
  const members = loadMembers();
  const callers = loadCallers(members);
  const tool = toolIdentity();
  const result = adjudicateResidualDataGovernance({
    gate: ghIssue(),
    subject: {
      successorCaptureId: REQUIRED_SUCCESSOR.successorCaptureId,
      sourceCommit: REQUIRED_SUCCESSOR.sourceCommit,
      sourceTree: REQUIRED_SUCCESSOR.sourceTree,
      schemaVersion: REQUIRED_SUCCESSOR.schemaVersion,
      packageDigest: REQUIRED_SUCCESSOR.packageDigest,
      ownerResidueLocator: REQUIRED_SUCCESSOR.ownerResidueLocator,
      ownerResidueSha256: REQUIRED_SUCCESSOR.ownerResidueSha256,
      fullInventoryLocator: REQUIRED_SUCCESSOR.fullInventoryLocator,
      fullInventorySha256: REQUIRED_SUCCESSOR.fullInventorySha256,
      memberSetDigest: memberSetDigest(members.map((member) => member.path)),
      fullInventoryBytesVerified: fullInventoryVerified(),
    },
    tool: {
      toolCommit: tool.toolCommit,
      toolTree: tool.toolTree,
      schemaVersion: RESIDUAL_SCHEMA_VERSION,
      toolVersions: {
        nodeVersion: process.version,
        npmVersion: execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim(),
      },
      entryBundleDigest: tool.entryBundleDigest,
    },
    members,
    callers,
    dirtySource: false,
    mixedSource: false,
  });
  if (result.kind === 'parent-coordination-gate-rejection') {
    process.stderr.write(`${JSON.stringify(result)}\n`);
    process.exit(2);
  }
  writeOutputs(result);
  process.stdout.write(`${result.qualified ? 'qualified' : 'blocker'} ${result.decisionIdentity} members=${result.summaries.memberCount} unresolved=${result.summaries.unresolvedCount}\n`);
}

function writeOutputs(result: ResidualAdjudication): void {
  const repoRoot = process.cwd();
  const outDir = join(repoRoot, OUTPUT_DIR);
  mkdirSync(outDir, { recursive: true });
  const compact = serializeDeterministic({
    schemaVersion: result.schemaVersion,
    qualified: result.qualified,
    blockers: result.blockers,
    subject: result.subject,
    tool: result.tool,
    summaries: result.summaries,
    families: result.families,
    futureSlices: result.futureSlices,
    fullLedger: result.fullLedger,
    decisionIdentity: result.decisionIdentity,
  });
  const compactPrivacy = privacyViolation(compact);
  if (compactPrivacy) throw new Error(`privacy:${compactPrivacy}:index.json`);
  writeFileSync(join(outDir, 'index.json'), compact);
  const documents = projectResidualDocuments(result);
  for (const [name, content] of Object.entries(documents)) {
    const normalized = content.replace(/\n+$/u, '\n');
    const violation = privacyViolation(normalized);
    if (violation) throw new Error(`privacy:${violation}:${name}`);
    writeFileSync(join(outDir, name), normalized);
  }
  const ledgerDir = join(repoRoot, 'artifacts/architecture-census', result.subject.successorCaptureId);
  mkdirSync(ledgerDir, { recursive: true });
  const ledger = serializeDeterministic({ records: result.records, families: result.families });
  if (sha256Text(ledger) !== result.fullLedger.sha256) throw new Error('ledger-digest-mismatch');
  writeFileSync(join(ledgerDir, 'residual-data-governance-ledger.ndjson'), ledger);
}

main();
