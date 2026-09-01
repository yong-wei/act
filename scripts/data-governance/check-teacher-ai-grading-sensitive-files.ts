import { spawnSync } from 'node:child_process';

import { findSensitiveTeacherAiGradingLabStagedFiles } from '../../src/lib/data-governance/teacher-ai-grading-lab-sensitive-files';

const cwd = process.cwd();

async function main() {
  const result = runGit(['diff', '--cached', '--name-only', '--diff-filter=AMR', '-z', '--no-ext-diff'], 'utf8');
  if (result.status !== 0) failInspection();

  const paths = String(result.stdout).split('\0').filter(Boolean);
  const files = paths.map((path) => {
    const content = runGit(['show', `:${path}`], null);
    if (content.status !== 0 || !Buffer.isBuffer(content.stdout)) failInspection();
    return {
      path,
      content: content.stdout,
      trackedBefore: runGit(['cat-file', '-e', `HEAD:${path}`], null).status === 0,
    };
  });
  const findings = await findSensitiveTeacherAiGradingLabStagedFiles(files);
  if (findings.length > 0) {
    const counts = new Map<string, number>();
    for (const finding of findings) counts.set(finding.reason, (counts.get(finding.reason) ?? 0) + 1);
    console.error(`Sensitive teacher AI grading files must not be committed (${findings.length} findings).`);
    for (const [reason, count] of counts) console.error(`- ${reason}: ${count}`);
    process.exit(1);
  }
  console.log(`Teacher AI grading sensitive-file check passed (${paths.length} staged paths).`);
}

function runGit(args: string[], encoding: BufferEncoding | null) {
  // Sealed runtime artifacts (for example Authority shard-set manifests) can
  // exceed spawnSync's 1 MiB default and would otherwise abort inspection.
  return spawnSync('git', args, { cwd, encoding, maxBuffer: 64 * 1024 * 1024 });
}

function failInspection(): never {
  console.error('Unable to inspect staged files for teacher AI grading data.');
  process.exit(1);
}

void main();
