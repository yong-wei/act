import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  longformInputSnapshotRowMatchesReviewRow,
  validateLongformInputSnapshotContent,
} from '../data-governance/check-new-resource-semantic-completeness';

const generatorPath = path.join(process.cwd(), 'scripts/db/generate-longform-textbook-reference-resource-semantics.ts');
const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));

const deliveryEnv = {
  ...cleanEnv,
  LONGFORM_VALIDATION_MODE: 'delivery',
  LONGFORM_TEXTBOOK_ROOT: path.join(process.cwd(), '.missing-clean-delivery-textbooks'),
};
execFileSync('npx', ['tsx', generatorPath], { stdio: 'pipe', env: deliveryEnv });
const deliverySummary = readJson(path.join(process.cwd(), 'course-content/runtime/resource-governance/longform-textbook-reference-resource-semantics-summary.json'));
assert(deliverySummary.delivery.cleanDeliveryInput.validationMode === 'delivery', 'delivery mode must use the tracked sealed input snapshot');
assert(deliverySummary.delivery.validationEntrypoints.deliveryClean.guarantee.includes('does not claim live textbook-body coverage'), 'delivery evidence must not claim full live validation');

const cloneParent = fs.mkdtempSync(path.join(os.tmpdir(), 'act-longform-clean-staged-'));
const clone = path.join(cloneParent, 'repo');
execFileSync('git', ['clone', '--quiet', '--no-hardlinks', process.cwd(), clone], { stdio: 'pipe', env: cleanEnv });
const stagedPaths = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMRTUXB'], {
  cwd: process.cwd(),
  encoding: 'utf8',
  env: cleanEnv,
}).split(/\r?\n/).filter(Boolean);
for (const relativePath of stagedPaths) {
  const targetFile = path.join(clone, relativePath);
  fs.mkdirSync(path.dirname(targetFile), { recursive: true });
  fs.writeFileSync(targetFile, execFileSync('git', ['show', `:${relativePath}`], {
    cwd: process.cwd(),
    env: cleanEnv,
    maxBuffer: 64 * 1024 * 1024,
  }));
}
execFileSync('git', ['add', '-f', '--', ...stagedPaths], { cwd: clone, stdio: 'pipe', env: cleanEnv });
const gateEnv = {
  ...cleanEnv,
  PATH: `${path.join(process.cwd(), 'node_modules/.bin')}:${cleanEnv.PATH ?? ''}`,
};
execFileSync('npm', ['run', 'db:complete-longform-textbook-reference-resource-semantics'], {
  cwd: clone,
  stdio: 'pipe',
  env: {
    ...gateEnv,
    LONGFORM_VALIDATION_MODE: 'delivery',
    LONGFORM_TEXTBOOK_ROOT: path.join(clone, '.missing-untracked-textbook-exports'),
  },
});
const cloneSummary = readJson(path.join(clone, 'course-content/runtime/resource-governance/longform-textbook-reference-resource-semantics-summary.json'));
assert(cloneSummary.delivery.cleanDeliveryInput.validationMode === 'delivery', `clean staged clone must validate from tracked sealed delivery input without untracked textbook exports; got ${cloneSummary.delivery.cleanDeliveryInput.validationMode}`);
assert(cloneSummary.delivery.validationEntrypoints.deliveryClean.guarantee.includes('does not claim live textbook-body coverage'), 'clean clone must promise delivery validation only');

const validSnapshotPath = path.join(clone, 'openspec/changes/complete-longform-textbook-reference-resource-semantics/evidence/longform-textbook-reference-resource-input-snapshot.jsonl');
const validReviewSourcePath = path.join(clone, 'course-content/runtime/resource-governance/longform-textbook-reference-resource-semantics-review-source.jsonl');
const validProjectionPath = path.join(clone, 'course-content/runtime/resource-governance/runtime-resource-projections.jsonl');

execFileSync('git', ['config', 'user.name', 'Longform delivery fixture'], { cwd: clone, stdio: 'pipe', env: cleanEnv });
execFileSync('git', ['config', 'user.email', 'longform-delivery@example.invalid'], { cwd: clone, stdio: 'pipe', env: cleanEnv });
execFileSync('git', ['commit', '--no-verify', '-m', 'materialize valid staged delivery fixture'], { cwd: clone, stdio: 'pipe', env: cleanEnv });
stageAllLongformProjections();
const cleanGate = runStagedGate();
assert(cleanGate.status === 0, `clean staged clone must pass the real semantic gate without textbook exports:\n${cleanGate.stdout}\n${cleanGate.stderr}`);
const checkedCount = Number(cleanGate.stdout.match(/passed \((\d+) changed resources checked\)/)?.[1]);
assert(checkedCount >= 3082, `clean staged gate must check all 3082 sealed longform projection bindings; got ${cleanGate.stdout.trim()}`);
restoreFromHead(validProjectionPath);

const validSnapshotContent = readFileSync(validSnapshotPath);
const validSnapshotSealContent = readFileSync(path.join(
  clone,
  'openspec/changes/complete-longform-textbook-reference-resource-semantics/evidence/longform-textbook-reference-resource-input-snapshot.seal.json',
));
const resolveBaselineTree = (commit: string) => execFileSync('git', ['rev-parse', `${commit}^{tree}`], {
  cwd: clone,
  encoding: 'utf8',
  env: cleanEnv,
}).trim();
const validSnapshotIndex = validateLongformInputSnapshotContent(validSnapshotContent, validSnapshotSealContent, resolveBaselineTree);
assert(validSnapshotIndex?.size === 3082, 'valid sealed input snapshot must expose all 3082 rows');

const forgedSnapshotRows = readJsonl(validSnapshotPath);
forgedSnapshotRows[0].sourceHash = 'sha256:forged-snapshot-source-hash';
const forgedSnapshotContent = Buffer.from(`${forgedSnapshotRows.map((row) => JSON.stringify(row)).join('\n')}\n`);
assert(validateLongformInputSnapshotContent(forgedSnapshotContent, validSnapshotSealContent, resolveBaselineTree) === null, 'forged snapshot hash must fail row and aggregate seals');

const forgedCitationRows = readJsonl(validReviewSourcePath);
forgedCitationRows[0].citationAddress.contentHash = 'sha256:forged-citation-content-hash';
const matchingSnapshotRow = validSnapshotIndex.get(forgedCitationRows[0].resourceId)!;
assert(!longformInputSnapshotRowMatchesReviewRow(matchingSnapshotRow, forgedCitationRows[0]), 'forged citation identity/hash must fail sealed row binding');

const missingSnapshotRow = readJsonl(validSnapshotPath);
missingSnapshotRow.pop();
const missingSnapshotContent = Buffer.from(`${missingSnapshotRow.map((row) => JSON.stringify(row)).join('\n')}\n`);
assert(validateLongformInputSnapshotContent(missingSnapshotContent, validSnapshotSealContent, resolveBaselineTree) === null, 'missing sealed snapshot row must fail row-count and aggregate seals');

console.log('Longform textbook/reference resource semantics delivery/clean-clone tests passed.');

function runStagedGate() {
  return spawnSync('npm', ['run', 'verify:new-resource-semantics', '--', '--staged'], {
    cwd: clone,
    encoding: 'utf8',
    env: gateEnv,
  });
}

function stage(filePath: string) {
  execFileSync('git', ['add', path.relative(clone, filePath)], { cwd: clone, stdio: 'pipe', env: cleanEnv });
}

function stageAllLongformProjections() {
  const rows = readJsonl(validProjectionPath);
  let changed = 0;
  for (const row of rows) {
    if (row.reviewAudit?.status !== 'agent-reviewed') continue;
    row.title = `${row.title} [clean-staged-binding]`;
    changed += 1;
  }
  assert(changed === 3082, `delivery fixture must stage all 3082 longform projections; got ${changed}`);
  writeJsonl(validProjectionPath, rows);
  stage(validProjectionPath);
}

function restoreFromHead(filePath: string) {
  fs.writeFileSync(filePath, execFileSync('git', ['show', `HEAD:${path.relative(clone, filePath)}`], {
    cwd: clone,
    env: cleanEnv,
    maxBuffer: 64 * 1024 * 1024,
  }));
  stage(filePath);
}

function readJson(filePath: string): Record<string, any> {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function readJsonl(filePath: string): Record<string, any>[] {
  return readFileSync(filePath, 'utf8').trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function writeJsonl(filePath: string, rows: readonly Record<string, any>[]) {
  fs.writeFileSync(filePath, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
