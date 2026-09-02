vi.mock('server-only', () => ({}));
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { buildKonlingRuntimeContext } from '@/lib/konling-agent-runtime';

/**
 * #1864 边界回归：完整控灵运行时 DTO 不再对学生浏览器可达；治理上下文
 * 只在服务端构建并供模型 grounding 使用。
 */
describe('konling runtime context confidentiality boundary', () => {
  it('retires the browser-readable konling-context endpoint', () => {
    expect(existsSync(join(process.cwd(), 'src/app/api/ai/konling-context'))).toBe(false);
    // 生产 src/ 与 scripts/ 都不得再请求该端点。
    const requestNeedle = /['"`]\/api\/ai\/konling-context/;
    const scanRoots = ['src', 'scripts'];
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name.includes('.test-results')) continue;
          walk(fullPath);
          continue;
        }
        if (!/\.(ts|tsx|mjs|cjs|js)$/.test(entry.name)) continue;
        const content = readFileSync(join(process.cwd(), fullPath), 'utf8');
        if (requestNeedle.test(content) && !fullPath.endsWith('konling-context-boundary.test.ts')) {
          offenders.push(fullPath);
        }
      }
    };
    for (const root of scanRoots) walk(root);
    expect(offenders).toEqual([]);
  });

  it('keeps governed context server-side for model grounding with internal canaries intact', async () => {
    const db = {
      knowledgeNode: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'CANARY-node-root-locus',
          name: '根轨迹设计',
          nodeType: 'THEORY',
          description: 'CANARY-server-grounding-description',
          knowledgeDim: 'CONCEPTUAL',
          metadata: { chapterName: '根轨迹法', capabilityTargetRefs: ['capability:root-locus-design'] },
          tags: ['根轨迹'],
        }]),
      },
    };
    const runtime = await buildKonlingRuntimeContext(db as never, {
      authenticatedUserId: 'CANARY-student-1',
      role: 'STUDENT',
      courseId: 'unit-4-5',
      pageId: '/knowledge',
      knowledgeWorkspaceHint: { status: 'selected-node', selectedNodeId: 'CANARY-node-root-locus' },
      trustedContentContext: true,
    });
    // 服务端模型 grounding 仍可消费治理上下文（含内部 canary 值）。
    expect(runtime.knowledgeWorkspace).toBeTruthy();
    expect(JSON.stringify(runtime)).toContain('CANARY-node-root-locus');
    // 运行时构建器保持为服务端模块。
    const runtimeSource = readFileSync(join(process.cwd(), 'src/lib/konling-agent-runtime.ts'), 'utf8');
    expect(runtimeSource).not.toContain("'use client'");
  });
});
