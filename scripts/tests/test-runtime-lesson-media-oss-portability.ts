import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { assertRuntimeLessonSemanticReviewEvidence } from '../db/runtime-lesson-semantic-evidence';

type JsonRow = Record<string, unknown>;

const governanceDir = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const readJsonl = (filename: string): JsonRow[] => readFileSync(path.join(governanceDir, filename), 'utf8')
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line) as JsonRow);
const assert = (condition: unknown, message: string): asserts condition => {
  if (!condition) throw new Error(message);
};

const auditById = new Map(readJsonl('resource-field-completion-audit.jsonl').map((row) => [row.resourceId, row]));
const source = readJsonl('runtime-lesson-media-resource-semantics-review-source.jsonl').find((row) => (
  row.resourceId === 'runtime-media:1-1:1-1-audio'
));
assert(source, 'expected the published lesson 1-1 audio review source');
const observation = source.assetObservation as Record<string, unknown> | undefined;
assert(observation?.gitIndexTracked === false, 'portable release asset must remain outside the Git index');
assert(observation.workingTreePresent === false, 'historical review observation must remain immutable');
assert(typeof observation.localPath === 'string', 'portable release asset must retain its runtime-relative path');
assert(existsSync(path.join(process.cwd(), observation.localPath)), 'publisher workspace must contain the ignored runtime asset');
assertRuntimeLessonSemanticReviewEvidence(auditById.get(source.resourceId as string), source);

console.log('runtime lesson media OSS portability contract passed');
