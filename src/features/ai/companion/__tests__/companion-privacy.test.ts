import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * 陪伴数据隐私边界（任务 2.3 / spec「陪伴数据隐私边界」）：
 * 陪伴事件与投递仅供控灵运行时与策略评估——
 * 不写 LearningFact、不进学生画像、不进教师端任何投影。
 */

const repoRoot = process.cwd();

function listSourceFiles(dir: string, extension: string): string[] {
  const absolute = path.join(repoRoot, dir);
  const entries = readdirSync(absolute);
  return entries.flatMap((entry) => {
    const full = path.join(absolute, entry);
    if (statSync(full).isDirectory()) {
      return entry === '__tests__' || entry === 'node_modules' ? [] : listSourceFiles(path.join(dir, entry), extension);
    }
    return entry.endsWith(extension) ? [full] : [];
  });
}

function readSource(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

/** 只保留代码本身（剥注释），避免文档性说明误伤静态断言。 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('companion data privacy boundary', () => {
  it('companion modules never write LearningFact or evidence stores', () => {
    const companionFiles = [
      ...listSourceFiles('src/features/ai/companion', '.ts'),
      ...listSourceFiles('src/features/ai/companion', '.tsx'),
      ...listSourceFiles('src/app/api/ai/companion', '.ts'),
    ];
    expect(companionFiles.length).toBeGreaterThan(0);
    for (const file of companionFiles) {
      const source = stripComments(readFileSync(file, 'utf8'));
      expect(
        source,
        `${path.relative(repoRoot, file)} must not touch LearningFact/evidence stores`,
      ).not.toMatch(/learningFact|LearningFact|learningEvidence|evidenceOutbox/);
    }
  });

  it('the proactive turn module stays free of memory/persistence side effects', () => {
    const source = stripComments(readSource('src/features/ai/companion/proactive-turn.ts'));
    expect(source).not.toMatch(/persistKonlingSessionMemories|buildScopedKonlingAiTools|konlingMemory/);
    expect(source).toContain('generateText');
  });

  it('teacher-facing projections never read companion tables', () => {
    const teacherFiles = listSourceFiles('src/features/teacher', '.ts')
      .concat(listSourceFiles('src/features/teacher', '.tsx'));
    expect(teacherFiles.length).toBeGreaterThan(0);
    for (const file of teacherFiles) {
      const source = stripComments(readFileSync(file, 'utf8'));
      expect(
        source,
        `${path.relative(repoRoot, file)} must not read companion tables`,
      ).not.toMatch(/konlingCompanion|KonlingCompanion/);
    }
  });

  it('the konling agent runtime does not consume companion tables', () => {
    const source = stripComments(readSource('src/lib/konling-agent-runtime.ts'));
    expect(source).not.toMatch(/konlingCompanion|KonlingCompanion/);
  });

  it('companion Prisma models relate only to the owning user (no fact/profile edges)', () => {
    const schema = readSource('prisma/schema.prisma');
    const eventModel = schema.match(/model KonlingCompanionEvent \{[\s\S]*?\n\}/)?.[0] ?? '';
    const deliveryModel = schema.match(/model KonlingCompanionDelivery \{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(eventModel).not.toBe('');
    expect(deliveryModel).not.toBe('');
    for (const model of [eventModel, deliveryModel]) {
      expect(model).toMatch(/user\s+User/);
      expect(model).not.toMatch(/learningFact|studentProfile|riskFlag|aIIntervention/i);
    }
  });
});
