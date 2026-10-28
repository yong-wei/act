import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const CJK = /[\u4e00-\u9fff]/;
const STRING_LITERAL = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\\n]|\\.)*`/g;
const ARENA_WORD = /(?<![A-Za-z0-9_$])Arena(?![A-Za-z0-9_])/;
const ENGLISH_LABEL_GROUPS = new Set(['src/lib/architecture-charter/types.ts']);
// 题干与选项按内容哈希冻结审核，改字须走重新审核，不在文案统一中直接修改。
const HASH_FROZEN_ASSESSMENT_CONTENT = new Set([
  'src/features/assessment/learning-goal-checkpoint-question-sets.ts',
  'src/features/assessment/learning-goal-terminal-validation-question-sets.ts',
]);
const MODEL_PREFIX_MATCH = "startsWith('Arena')";

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return entry === '__tests__' ? [] : collectSourceFiles(path);
    return /\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\./.test(entry) ? [path] : [];
  });
}

describe('control arena display name', () => {
  it('uses 竞技场 instead of the word Arena in Chinese copy and standalone labels', () => {
    const offenders: string[] = [];
    for (const file of collectSourceFiles('src')) {
      if (ENGLISH_LABEL_GROUPS.has(file) || HASH_FROZEN_ASSESSMENT_CONTENT.has(file)) continue;
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (!line.includes('Arena') || line.includes(MODEL_PREFIX_MATCH)) return;
          for (const literal of line.match(STRING_LITERAL) ?? []) {
            const body = literal.slice(1, -1);
            if (ARENA_WORD.test(body) && (CJK.test(body) || body.trim() === 'Arena')) {
              offenders.push(`${file}:${index + 1}: ${body}`);
            }
          }
          const jsxText = line.replace(STRING_LITERAL, '');
          if (!/^\s*(\/\/|\*|\/\*)/.test(jsxText) && ARENA_WORD.test(jsxText) && CJK.test(jsxText)) {
            offenders.push(`${file}:${index + 1}: ${jsxText.trim()}`);
          }
        });
    }
    expect(offenders).toEqual([]);
  });
});
