import { readFileSync } from 'node:fs';
import path from 'node:path';

const FILE_NAMES = new Set([
  'micro-tutoring-goal-node-catalog.json',
  'micro-tutoring-option-attributions.json',
  'micro-tutoring-option-attributions-v2.json',
  'micro-tutoring-assessment-baseline-v2.json',
  'micro-tutoring-practice-baseline.json',
  'micro-tutoring-resource-projection.json',
  'micro-tutoring-validation-registry.json',
]);

const sourceCache = new Map<string, unknown>();

export function loadMicroTutoringRuntimeSource(fileName: string): unknown {
  if (!FILE_NAMES.has(fileName)) return null;
  const cached = sourceCache.get(fileName);
  if (cached !== undefined) return cached;
  try {
    const filePath = path.join(
      process.cwd(),
      'course-content',
      'runtime',
      'resource-governance',
      fileName,
    );
    const source = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
    sourceCache.set(fileName, source);
    return source;
  } catch {
    return null;
  }
}
