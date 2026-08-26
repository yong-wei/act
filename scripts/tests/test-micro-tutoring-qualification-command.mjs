import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = process.cwd();
const tsxCli = path.join(repoRoot, 'node_modules/tsx/dist/cli.mjs');
const script = path.join(repoRoot, 'scripts/data-governance/qualify-micro-tutoring.ts');
const outputDir = mkdtempSync(path.join(os.tmpdir(), 'act-micro-tutoring-qualification-'));
const optionReferenceSecret = 'test-only-micro-tutoring-option-reference-secret';

function run(args = [], environment = {}) {
  try {
    const output = execFileSync(process.execPath, [tsxCli, script, '--output-dir', outputDir, ...args], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        MICRO_TUTORING_COVERAGE_OPTION_REFERENCE_SECRET: optionReferenceSecret,
        ...environment,
      },
    });
    return { status: 0, output };
  } catch (error) {
    return { status: error.status ?? -1, output: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}

try {
  const result = run();
  const receiptPath = path.join(outputDir, 'micro-tutoring-candidate-receipt.json');
  const dirty = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim().length > 0;
  assert.notEqual(result.status, 0, result.output);
  assert.equal(existsSync(receiptPath), false, 'fail-closed qualification must not write a candidate receipt');
  if (dirty) {
    assert.match(result.output, /DIRTY_WORKTREE/);
  } else {
    assert.match(result.output, /MISSING_DB_CAPTURE/);
    assert.match(result.output, /MISSING_BROWSER_EVIDENCE/);
    assert.match(result.output, /MISSING_OCI_DIGEST/);
    assert.match(result.output, /REQUIRED_TESTS_INCOMPLETE/);
  }
  const v2Result = run(['--profile', 'v2']);
  const v2ReceiptPath = path.join(outputDir, 'micro-tutoring-v2-candidate-receipt.json');
  assert.notEqual(v2Result.status, 0, v2Result.output);
  assert.equal(existsSync(v2ReceiptPath), false, 'v2 fail-closed qualification must not write a candidate receipt');
  assert.equal(existsSync(receiptPath), false, 'v2 qualification must not overwrite the v1 receipt path');
  const v2Injected = run(['--profile', 'v2'], {
    DATABASE_URL: '',
    MICRO_TUTORING_QUALIFICATION_TEST_PROOFS: JSON.stringify([{
      name: 'test:micro-tutoring-qualification-postgres',
      status: 'passed',
      scope: 'injected-env',
      sourceRevision: 'a'.repeat(40),
    }]),
  });
  assert.notEqual(v2Injected.status, 0, v2Injected.output);
  assert.equal(existsSync(v2ReceiptPath), false, 'injected postgres proofs must not skip required v2 execution');
  assert.match(v2Injected.output, /TESTS_FAILED/);
  console.log('micro tutoring qualification command contract passed');
} finally {
  rmSync(outputDir, { recursive: true, force: true });
}
