import { createHash } from 'node:crypto';
import { link, mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  buildCurrentCourseCoverageBatchReceipt,
  type CurrentCourseCoverageBatchBinding,
  type CurrentCourseCoverageStageReview,
} from '../../src/lib/aggregate-governance/current-course-coverage-batch-review';
import { stableStringify } from '../../src/lib/aggregate-governance/hash';
import type {
  CurrentCourseCoverageWorklist,
  CurrentReviewBatchManifest,
} from '../../src/lib/aggregate-governance/current-course-coverage-review';

const ROOT = process.cwd();
const DEFAULT_INPUT_ROOT =
  'course-content/authoring/knowledge/issue-1180-current-course-coverage-review';
const FORBIDDEN_OUTPUT_PARTS = [
  '/course-coverage/aggregate/active/',
  '/canonical-rag/',
  '/canonical-learning-fact-identity/',
];

interface CliOptions {
  worklist: string;
  manifest: string;
  primary: string;
  challenger: string | null;
  third: string | null;
  output: string;
  expectedBinding: CurrentCourseCoverageBatchBinding;
}

function valueAfter(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] ?? null : null;
}

function required(args: string[], flag: string): string {
  const value = valueAfter(args, flag)?.trim();
  if (!value) throw new Error(`${flag} is required`);
  return value;
}

function integer(args: string[], flag: string): number {
  const parsed = Number(required(args, flag));
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${flag} must be a non-negative integer`);
  return parsed;
}

function options(args: string[]): CliOptions {
  return {
    worklist: valueAfter(args, '--worklist') ?? `${DEFAULT_INPUT_ROOT}/worklist.json`,
    manifest: valueAfter(args, '--manifest') ?? `${DEFAULT_INPUT_ROOT}/batch-manifest.json`,
    primary: required(args, '--primary'),
    challenger: valueAfter(args, '--challenger'),
    third: valueAfter(args, '--third'),
    output: required(args, '--output'),
    expectedBinding: {
      batchId: required(args, '--expected-batch-id'),
      manifestBatchIndex: integer(args, '--batch-index'),
      sequence: integer(args, '--sequence'),
      semanticGroupKey: required(args, '--semantic-group-key'),
      memberCount: integer(args, '--member-count'),
      memberDigest: required(args, '--member-digest'),
      worklistInputDigest: required(args, '--worklist-input-digest'),
      worklistDigest: required(args, '--worklist-digest'),
      manifestDigest: required(args, '--manifest-digest'),
      manifestArtifactSha256: required(args, '--manifest-artifact-sha256'),
    },
  };
}

function absolute(input: string): string {
  return path.resolve(ROOT, input);
}

async function json<T>(input: string): Promise<T> {
  return JSON.parse(await readFile(absolute(input), 'utf8')) as T;
}

async function exists(input: string): Promise<boolean> {
  try {
    await stat(input);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

function assertSafeOutput(output: string): void {
  const normalized = output.replaceAll('\\', '/');
  if (!normalized.startsWith(`${ROOT.replaceAll('\\', '/')}/course-content/authoring/knowledge/`)) {
    throw new Error('Batch receipt output must remain under course-content/authoring/knowledge');
  }
  if (FORBIDDEN_OUTPUT_PARTS.some((part) => normalized.includes(part))) {
    throw new Error('Batch receipt output targets a forbidden production authority path');
  }
  if (!normalized.endsWith('/batch-receipt.json')) {
    throw new Error('Batch receipt output must end with batch-receipt.json');
  }
}

async function publishImmutable(output: string, bytes: string): Promise<'published' | 'identical'> {
  assertSafeOutput(output);
  if (await exists(output)) {
    const current = await readFile(output, 'utf8');
    if (current !== bytes) throw new Error('Existing batch receipt is immutable and differs');
    return 'identical';
  }
  await mkdir(path.dirname(output), { recursive: true });
  const temporary = `${output}.tmp-${process.pid}`;
  await writeFile(temporary, bytes, { encoding: 'utf8', flag: 'wx' });
  try {
    await link(temporary, output);
    return 'published';
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    const current = await readFile(output, 'utf8');
    if (current !== bytes) throw new Error('Existing batch receipt is immutable and differs');
    return 'identical';
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}

async function main(): Promise<void> {
  const input = options(process.argv.slice(2));
  const manifestBytes = await readFile(absolute(input.manifest));
  const worklist = await json<CurrentCourseCoverageWorklist>(input.worklist);
  const manifest = JSON.parse(manifestBytes.toString('utf8')) as CurrentReviewBatchManifest;
  const primary = await json<CurrentCourseCoverageStageReview>(input.primary);
  const challenger = input.challenger
    ? await json<CurrentCourseCoverageStageReview>(input.challenger)
    : null;
  const third = input.third ? await json<CurrentCourseCoverageStageReview>(input.third) : null;
  const receipt = buildCurrentCourseCoverageBatchReceipt({
    worklist,
    manifest,
    expectedBinding: input.expectedBinding,
    observedManifestArtifactSha256: createHash('sha256').update(manifestBytes).digest('hex'),
    primary,
    challenger,
    third,
  });
  const bytes = `${JSON.stringify(receipt, null, 2)}\n`;
  const publication = await publishImmutable(absolute(input.output), bytes);
  process.stdout.write(`${stableStringify({
    status: receipt.status,
    batchId: receipt.batchBinding.batchId,
    receiptDigest: receipt.receiptDigest,
    output: input.output,
    publication,
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
