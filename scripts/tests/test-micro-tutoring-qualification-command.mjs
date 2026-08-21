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

function run() {
  try {
    const output = execFileSync(process.execPath, [tsxCli, script, '--output-dir', outputDir], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        MICRO_TUTORING_COVERAGE_OPTION_REFERENCE_SECRET: optionReferenceSecret,
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
  }
  console.log('micro tutoring qualification command contract passed');
} finally {
  rmSync(outputDir, { recursive: true, force: true });
}
