import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { projectActiveNodeMathematics } from '../active-authority-graph-contracts';
import {
  KNOWLEDGE_GRAPH_PRODUCT_VERSION,
  knowledgeGraphProductVersionLabel,
  layoutKnowledgeNodeLabel,
  layoutKnowledgeRootLabel,
} from '../graph/graph-presentation-contract';

describe('shared graph presentation contract', () => {
  it('exposes ordinary product version names without internal Authority or Legacy titles', () => {
    expect(knowledgeGraphProductVersionLabel('active')).toBe('新版');
    expect(knowledgeGraphProductVersionLabel('legacy')).toBe('旧版');
    expect(KNOWLEDGE_GRAPH_PRODUCT_VERSION.active.label).toBe('新版');
    expect(KNOWLEDGE_GRAPH_PRODUCT_VERSION.legacy.label).toBe('旧版');
  });

  it('reuses the established node and root label layouts', () => {
    const node = layoutKnowledgeNodeLabel('传递函数建模基础对象');
    expect(node.lines.length).toBeGreaterThan(1);
    expect(node.truncated).toBe(false);
    const root = layoutKnowledgeRootLabel('传递函数、系统模型与时域分析方法');
    expect(root.lines.length).toBeGreaterThan(1);
    expect(root.truncated).toBe(false);
  });

  it('projects only declared formula_latex as governed mathematics', () => {
    expect(projectActiveNodeMathematics({ formula_latex: 'G(s)=\\frac{1}{s}' })).toEqual({
      state: 'available',
      expression: 'G(s)=\\frac{1}{s}',
      display: 'block',
    });
    expect(projectActiveNodeMathematics({ concept_kind: 'engineering' })).toEqual({ state: 'missing' });
    expect(projectActiveNodeMathematics({ formula_latex: '   ' })).toEqual({ state: 'missing' });
  });

  it('keeps the active graph on shared presentation contracts without Legacy DTOs', () => {
    const workspace = readFileSync(path.join(process.cwd(), 'src/features/knowledge/knowledge-graph-workspace.tsx'), 'utf8');
    const activeGraph = readFileSync(path.join(process.cwd(), 'src/features/knowledge/active-authority-graph.tsx'), 'utf8');
    expect(workspace).toContain('knowledgeGraphProductVersionLabel');
    expect(workspace).toContain("knowledgeGraphProductVersionLabel('active')");
    expect(workspace).toContain("knowledgeGraphProductVersionLabel('legacy')");
    expect(activeGraph).toContain('ActiveAuthorityRuntimeView');
    expect(activeGraph).not.toMatch(/from ['"]\.\/knowledge-graph-system['"]/);
    expect(activeGraph).not.toContain('KnowledgeGraphSystem');
    expect(activeGraph).not.toContain('ActiveAuthorityForceCanvas');
    expect(activeGraph).not.toContain('ActiveAuthorityRootCanvas');
  });
});
