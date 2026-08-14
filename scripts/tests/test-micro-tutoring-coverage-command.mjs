import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = process.cwd();
const tsxCli = path.join(repoRoot, 'node_modules/tsx/dist/cli.mjs');
const script = path.join(repoRoot, 'scripts/data-governance/check-micro-tutoring-coverage.ts');
const outputDir = mkdtempSync(path.join(os.tmpdir(), 'act-micro-tutoring-coverage-'));

function run(args) {
  try {
    const output = execFileSync(process.execPath, [tsxCli, script, '--offline', '--output-dir', outputDir, ...args], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, output };
  } catch (error) {
    return { status: error.status ?? -1, output: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}

try {
  const reportResult = run([]);
  assert.equal(reportResult.status, 0, reportResult.output);
  const report = JSON.parse(readFileSync(path.join(outputDir, 'micro-tutoring-coverage.json'), 'utf8'));
  const markdown = readFileSync(path.join(outputDir, 'micro-tutoring-coverage.md'), 'utf8');
  assert.equal(report.qualifiedPracticeItemCount, 54);
  assert.equal(report.errorOptionCount, 108);
  assert.equal(report.gapOptionCount, 108);
  assert.equal(report.baselineIssues.length, 0);
  const baseline = JSON.parse(readFileSync(
    path.join(repoRoot, 'course-content/runtime/resource-governance/micro-tutoring-practice-baseline.json'),
    'utf8',
  ));
  assert.equal(JSON.stringify(report).includes('isCorrect'), false);
  assert.equal(JSON.stringify(report).includes('answerKey'), false);
  assert.equal(JSON.stringify(report).includes(baseline.optionReferenceSalt), false);
  assert.equal(markdown.includes('isCorrect'), false);

  const strictResult = run(['--strict']);
  assert.notEqual(strictResult.status, 0, 'strict mode must fail when governed dependencies are unavailable');
  assert.equal(readFileSync(path.join(outputDir, 'micro-tutoring-coverage.json'), 'utf8').includes('REFERENCE_DRIFT'), true);
  console.log('micro tutoring coverage command contract passed');
} finally {
  rmSync(outputDir, { recursive: true, force: true });
}
