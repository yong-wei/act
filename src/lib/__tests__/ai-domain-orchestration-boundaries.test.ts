import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

function aiProductionFiles(directory: string): string[] {
  return readdirSync(join(process.cwd(), directory), { withFileTypes: true })
    .flatMap((entry) => {
      const child = join(directory, entry.name);
      return entry.isDirectory() ? aiProductionFiles(child) : [child];
    })
    .filter((path) => /\.(ts|tsx)$/.test(path) && !path.includes('__tests__'));
}

const AI_DIRECTORIES = [
  'src/app/api/ai',
  'src/lib/ai',
  'src/features/ai',
];

const AI_LIB_FILES = readdirSync(join(process.cwd(), 'src/lib'))
  .filter((name) => /^konling-.*\.ts$/.test(name))
  .map((name) => `src/lib/${name}`);

function aiFiles(): string[] {
  return [
    ...AI_DIRECTORIES.flatMap(aiProductionFiles),
    ...AI_LIB_FILES,
  ];
}

describe('AI domain orchestration boundaries', () => {
  it('crosses into feature domains only through public-api boundaries', () => {
    for (const path of aiFiles()) {
      const imports = [...source(path).matchAll(/from '(@\/features\/[^']+)'/g)]
        .map((match) => match[1]);
      for (const specifier of imports) {
        // src/features/ai 是 AI 自己的域：AI runtime 与 AI 域内部互访不构成跨域。
        if (specifier.startsWith('@/features/ai/')) continue;
        // 认可的 owner 边界形式：显式 public-api，或 Arena 的
        // domain/client/server 公共边界（arena-module-boundary spec 所有权）。
        const isExplicitBoundary = /\/public-api$/.test(specifier)
          || /^@\/features\/arena\/(domain|client|server)$/.test(specifier);
        expect(
          isExplicitBoundary,
          `${path} deep-imports domain implementation: ${specifier}`,
        ).toBe(true);
      }
    }
  });

  it('keeps learner profile facts behind the personalization owner ports', () => {
    // 画像与能力快照是 personalization/learning-record 领域事实：AI route
    // 不得直接读 Prisma 模型，只能经 learner-state public-api 的 runtime port。
    // studentProfile 的 findFirst 属于 route 授权语义（班级成员校验，R5 留在
    // 现有边界），不属于画像事实消费。
    for (const path of aiProductionFiles('src/app/api/ai')) {
      const src = source(path);
      expect(src, path).not.toContain('prisma.studentProfileSummary');
      expect(src, path).not.toContain('prisma.studentCompetencySnapshot');
      expect(src, path).not.toContain('prisma.studentProfile.findMany');
      expect(src, path).not.toContain('prisma.studentProfile.update');
      expect(src, path).not.toContain('prisma.studentProfile.create');
    }
  });

  it('keeps the knowledge candidate-graph boundary explicit for AI callers', () => {
    expect(existsSync(join(process.cwd(), 'src/features/knowledge/public-api.ts'))).toBe(true);
    for (const path of AI_LIB_FILES) {
      const src = source(path);
      expect(src, path).not.toContain("from '@/features/knowledge/candidate-graph-contracts'");
      expect(src, path).not.toContain("from '@/features/knowledge/candidate-graph-policy'");
      expect(src, path).not.toContain("from '@/features/personalization/path-planning/control-correction-path-rounds'");
    }
  });

  it('rejects forged teacher/student scope before any learner fact is read', () => {
    // R3: 客户端提供的 userId/classId 必须先通过服务端身份与班级归属校验，
    // 才能进入画像/学习事实读取；教师代读只能命中自己班级的在册学生。
    const src = source('src/app/api/ai/konling-context/route.ts');
    const gateIndex = src.indexOf('verifyTeacherStudentScope({');
    const readIndex = src.indexOf('readLearnerState({');
    expect(gateIndex).toBeGreaterThan(-1);
    expect(readIndex).toBeGreaterThan(gateIndex);
    // 越权读取直接 403/404，不落到默认上下文。
    expect(src).toContain('return NextResponse.json({ error: scope.error }, { status: scope.status });');
  });
});
