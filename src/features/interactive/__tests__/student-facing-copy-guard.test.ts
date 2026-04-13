import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const interactiveRoot = join(repoRoot, 'src/features/interactive');
const bannedPhrases = [
  'runtime 导学资源',
  'runtime 导学内容',
  '不回读 authoring',
  '页面真值',
  'runtime 正式课包',
  'runtime 正式媒体',
] as const;

function collectTsxFiles(dir: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(dir)) {
    const absolutePath = join(dir, entry);
    const stat = statSync(absolutePath);
    if (stat.isDirectory()) {
      result.push(...collectTsxFiles(absolutePath));
      continue;
    }
    if (absolutePath.endsWith('.tsx') && !absolutePath.includes('/__tests__/')) {
      result.push(absolutePath);
    }
  }
  return result;
}

describe('student-facing copy guard', () => {
  it('does not leak implementation wording into interactive course pages', () => {
    for (const absolutePath of collectTsxFiles(interactiveRoot)) {
      const source = readFileSync(absolutePath, 'utf8');
      for (const phrase of bannedPhrases) {
        expect(source, `${absolutePath} should not contain "${phrase}"`).not.toContain(phrase);
      }
    }
  });
});
