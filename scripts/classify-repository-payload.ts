#!/usr/bin/env tsx
/**
 * Current repository-payload eligibility classification (#1916).
 *
 * Runs on a clean implementation HEAD. Freezes the claim-time origin/integration
 * commit/tree as the classification subject, reconciles the complete tracked
 * denominator through digest-bound evidence adapters, writes the external full
 * inventory plus compact package under docs/architecture/repository-payload-classification/current/,
 * independently verifies the inventory bytes, and proves read-only behavior with
 * pre/post guards. The archived #1876/#1881 packages stay byte-for-byte untouched.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  A_ISSUE,
  CURRENT_SUBJECT_BASE_BRANCH,
  PAYLOAD_CLASSIFICATION_OUTPUT_DIR,
  classifyPackage,
  loadCommittedAHandoff,
  loadCommittedPredecessorPackage,
  loadPredecessorEntries,
  loadSourceTreeEntries,
  readIssueGateFromGh,
  subjectIdentityOf,
  toolCheckpointFromGit,
  verifyInventoryArtifact,
  type CurrentSubject,
  type InventoryEntry,
} from '../src/lib/architecture-census/payload-classification';
import {
  buildConsumerReferenceAdapter,
  buildContentCompilerAdapter,
  buildIdentityInventoryScan,
  buildKnowledgeCutoverAdapter,
  buildPrivacyScanAdapter,
  buildQaEvidenceAdapter,
  buildReleaseAdapter,
  combineAdapters,
  type QaLifecycleOutcome,
  type SubjectTreeReader,
} from '../src/lib/architecture-census/payload-classification-adapters';
import { serializeDeterministic, sha256Text } from '../src/lib/architecture-census/serialize';
import { classifyArtifact } from '../tools/evidence-lifecycle/classify';
import { privacyFailures } from '../tools/evidence-lifecycle/privacy';
import { checkEvidenceLifecycle } from '../tools/evidence-lifecycle/check';
import { checkContentKnowledgeRuntimeRelease } from '../tools/content-knowledge-runtime-release/check';

function compatibilityFrom(name: string, run: () => { ok: boolean; failures: string[] }): { name: string; status: 'ok' | 'unresolved'; detail: string } {
  try {
    const result = run();
    if (result.ok) return { name, status: 'ok', detail: 'ok' };
    return { name, status: 'unresolved', detail: (result.failures[0] ?? 'failed').slice(0, 180) };
  } catch (error) {
    const detail = error instanceof Error ? error.message.split('\n')[0] ?? 'failed' : 'failed';
    return { name, status: 'unresolved', detail: detail.slice(0, 180) };
  }
}

const repoRoot = process.cwd();

// 1. Freeze the claim-time current subject: the exact, clean origin/integration commit/tree.
execFileSync('git', ['-C', repoRoot, 'fetch', 'origin', 'integration'], { stdio: 'ignore' });
const subjectCommit = execFileSync('git', ['-C', repoRoot, 'rev-parse', 'origin/integration^{commit}'], { encoding: 'utf8' }).trim();
const subjectTree = execFileSync('git', ['-C', repoRoot, 'rev-parse', 'origin/integration^{tree}'], { encoding: 'utf8' }).trim();
const subject: CurrentSubject = { baseBranch: CURRENT_SUBJECT_BASE_BRANCH, subjectCommit, subjectTree };
const subjectIdentity = subjectIdentityOf(subject);

// 2. Immutable predecessor identities and evidence inputs.
const baselinePath = join(repoRoot, 'docs/architecture/modular-monolith/post-convergence/baseline.json');
const predecessorIndexPath = join(repoRoot, 'docs/architecture/repository-payload-classification/index.json');
const deletionReceiptPath = join(repoRoot, 'docs/architecture/qa-evidence-lifecycle/deletion-receipt.json');
const readOnlyBytesBefore = [
  ['baseline.json', baselinePath],
  ['predecessor-index.json', predecessorIndexPath],
  ['deletion-receipt.json', deletionReceiptPath],
] as const;
const readOnlySnapshots = readOnlyBytesBefore.map(([name, path]) => [name, sha256Text(readFileSync(path, 'utf8'))] as const);

const issueGate = readIssueGateFromGh(A_ISSUE);
const predecessorIssueGate = readIssueGateFromGh(1881);
const handoff = loadCommittedAHandoff(repoRoot);
const predecessor = loadCommittedPredecessorPackage(repoRoot);
const predecessorEntries = loadPredecessorEntries(repoRoot);

// 3. Subject-tree reader: every adapter reads Git object bytes from the frozen subject only.
const entries = loadSourceTreeEntries(repoRoot, subjectTree);
const blobCache = new Map<string, Buffer>();
function blobBytes(hash: string): Buffer {
  const cached = blobCache.get(hash);
  if (cached) return cached;
  const bytes = execFileSync('git', ['-C', repoRoot, 'cat-file', 'blob', hash], { maxBuffer: 256 * 1024 * 1024 });
  blobCache.set(hash, bytes);
  return bytes;
}
const treeReader: SubjectTreeReader = {
  blobBytes,
  listEntries: (prefix: string): readonly InventoryEntry[] => entries.filter((entry) => entry.path.startsWith(prefix)),
};

// 4. QA evidence lifecycle contract and real consumer references, digest-bound
//    to subject-tree bytes. One pass over subject source extracts both the QA
//    retain set and every quoted path-like token referenced from code.
const retainPaths = new Set<string>();
const productImportPattern = /['"](artifacts\/[^'"]+)['"]/g;
const pathTokenPattern = /['"`]([^'"`\n]{3,200}?)['"`]/g;
const consumerReferences = new Map<string, Set<'production' | 'test'>>();
let dynamicReferencesObserved = false;
for (const entry of entries) {
  if (!entry.path.startsWith('src/') || !/\.tsx?$/u.test(entry.path)) continue;
  const isTest = entry.path.includes('/__tests__/') || /\.(?:test|spec)\./u.test(entry.path);
  const text = blobBytes(entry.hash).toString('utf8');
  if (!isTest) {
    for (const match of text.matchAll(productImportPattern)) {
      if (match[1]) retainPaths.add(match[1]);
    }
  }
  for (const match of text.matchAll(pathTokenPattern)) {
    const token = match[1];
    if (token && token.includes('$')) dynamicReferencesObserved = true;
    if (!token || !/(?:^|\/)[$_@a-z0-9.~-]+\.[a-z0-9]{1,8}$/iu.test(token)) continue;
    if (/^[a-z]+:\/\//iu.test(token)) continue;
    const kind = isTest ? ('test' as const) : ('production' as const);
    const kinds = consumerReferences.get(token) ?? new Set<'production' | 'test'>();
    kinds.add(kind);
    consumerReferences.set(token, kinds);
  }
}
const qaContract = {
  classifyArtifact: (path: string, blobHash: string): QaLifecycleOutcome | null => {
    const outcome = classifyArtifact(path, blobHash, retainPaths);
    return {
      evidenceClass: outcome.evidenceClass,
      privacyClass: outcome.privacyClass,
      retentionDecision: outcome.retentionDecision,
      owner: outcome.owner,
    };
  },
};
const privacyContract = {
  scanText: (text: string): readonly string[] | null => privacyFailures(text),
};

// 5. Digest-bound evidence adapters over the frozen subject.
const identityScan = buildIdentityInventoryScan(treeReader, entries, privacyContract);
const evidenceBundle = combineAdapters([
  buildReleaseAdapter(treeReader, entries),
  buildContentCompilerAdapter(treeReader, entries),
  buildKnowledgeCutoverAdapter(treeReader, entries),
  buildQaEvidenceAdapter(treeReader, entries, qaContract, privacyContract),
  buildPrivacyScanAdapter(treeReader, entries, privacyContract),
  buildConsumerReferenceAdapter(entries, consumerReferences, dynamicReferencesObserved),
]);
// An identity-value hit vetoes any weaker privacy override another adapter produced.
const adapterBundle = combineAdapters([{
  overrides: evidenceBundle.overrides.filter((item) => !identityScan.hitPaths.has(item.path)),
  identities: evidenceBundle.identities,
}, identityScan]);

// 6. Tool checkpoint on this clean implementation HEAD, independent of the subject.
const tool = toolCheckpointFromGit(repoRoot);

// Compatibility gates must qualify the frozen subject, not this tool HEAD:
// run them inside an independent clean checkout of the subject commit.
const subjectCheckoutRoot = mkdtempSync(join(tmpdir(), 'payload-subject-'));
execFileSync('git', ['-C', repoRoot, 'worktree', 'add', '--detach', subjectCheckoutRoot, subjectCommit], { stdio: 'ignore' });
let compatibilityChecks: { name: string; status: 'ok' | 'unresolved'; detail: string }[];
try {
  const checkedSubjectCommit = execFileSync('git', ['-C', subjectCheckoutRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const checkedSubjectTree = execFileSync('git', ['-C', subjectCheckoutRoot, 'rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim();
  if (checkedSubjectCommit !== subjectCommit || checkedSubjectTree !== subjectTree) {
    throw new Error('subject-checkout-identity-mismatch');
  }
  compatibilityChecks = [
    compatibilityFrom('qa-evidence-lifecycle', () => checkEvidenceLifecycle(subjectCheckoutRoot)),
    compatibilityFrom('content-knowledge-runtime', () => checkContentKnowledgeRuntimeRelease(subjectCheckoutRoot)),
  ];
} finally {
  execFileSync('git', ['-C', repoRoot, 'worktree', 'remove', '--force', subjectCheckoutRoot], { stdio: 'ignore' });
  rmSync(subjectCheckoutRoot, { recursive: true, force: true });
}

function runClassification(verification: Parameters<typeof classifyPackage>[0]['inventoryVerification']) {
  return classifyPackage({
    issueGate,
    predecessorIssueGate,
    handoff,
    subject,
    predecessor,
    predecessorEntries,
    tool,
    entries,
    overrides: adapterBundle.overrides,
    adapterIdentities: adapterBundle.identities,
    inventoryVerification: verification,
    compatibilityChecks,
    subjectSourceBytes: readOnlySnapshots[0]?.[1],
  });
}

// 7. First pass writes the external full inventory, then an independent read-and-hash
//    verification receipt gates the final compact package.
const firstPass = runClassification(null);
if (firstPass.status === 'blocked' || !firstPass.files) {
  process.stderr.write(`repository-payload-classification:${firstPass.status}:${firstPass.reason ?? 'unknown'}\n`);
  process.exit(1);
}
const inventoryLocator = `artifacts/architecture-census/${subjectIdentity}/payload-classification-inventory.ndjson`;
const inventoryPath = join(repoRoot, inventoryLocator);
mkdirSync(dirname(inventoryPath), { recursive: true });
writeFileSync(inventoryPath, firstPass.files.inventoryNdjson);
const verification = verifyInventoryArtifact({
  inventoryAbsolutePath: inventoryPath,
  expectedLocator: inventoryLocator,
  expectedSha256: sha256Text(firstPass.files.inventoryNdjson),
  expectedMemberDenominator: firstPass.members.length,
  subjectIdentity,
  toolCommit: tool.toolCommit,
});
if ('error' in verification) {
  process.stderr.write(`repository-payload-classification:inventory-verification:${verification.error}\n`);
  process.exit(1);
}

// 8. Final package with the verified receipt bound in.
const result = runClassification(verification);
if (result.status === 'blocked' || !result.files) {
  process.stderr.write(`repository-payload-classification:${result.status}:${result.reason ?? 'unknown'}\n`);
  process.exit(1);
}
const outDir = join(repoRoot, PAYLOAD_CLASSIFICATION_OUTPUT_DIR);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'summary.md'), result.files['summary.md']);
writeFileSync(join(outDir, 'index.json'), result.files['index.json']);
writeFileSync(join(outDir, 'policy-matrix.md'), result.files['policy-matrix.md']);
writeFileSync(join(outDir, 'unresolved.md'), result.files['unresolved.md']);
writeFileSync(join(outDir, 'future-eligibility.md'), result.files['future-eligibility.md']);
writeFileSync(join(outDir, 'inventory-verification.json'), serializeDeterministic(verification));

// 9. Read-only post guards: subject identity and contract inputs must be unchanged.
const subjectCommitAfter = execFileSync('git', ['-C', repoRoot, 'rev-parse', 'origin/integration^{commit}'], { encoding: 'utf8' }).trim();
const subjectTreeAfter = execFileSync('git', ['-C', repoRoot, 'rev-parse', 'origin/integration^{tree}'], { encoding: 'utf8' }).trim();
if (subjectCommitAfter !== subjectCommit || subjectTreeAfter !== subjectTree) {
  process.stderr.write('repository-payload-classification:subject-drifted-during-run\n');
  process.exit(1);
}
for (const [name, path] of readOnlyBytesBefore) {
  const before = readOnlySnapshots.find(([snapshotName]) => snapshotName === name)?.[1];
  if (before && sha256Text(readFileSync(path, 'utf8')) !== before) {
    process.stderr.write(`repository-payload-classification:read-only-input-mutated:${name}\n`);
    process.exit(1);
  }
}

process.stdout.write(
  `repository-payload-classification:${result.status} reason=${result.reason ?? 'none'} members=${result.members.length} subject=${subjectCommit.slice(0, 12)} digest=${result.packageDigest} inventory=${inventoryLocator}\n`,
);
