import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { projectActiveNodeMathematics } from '../active-authority-graph-contracts';
import {
  activeNodeSearch,
  createActiveAuthorityGraphModel,
} from '../active-authority-presentation';
import type { ActiveCanvasNode } from '../active-authority-graph-contracts';

function node(id: string, label: string, extras: Partial<ActiveCanvasNode> = {}): ActiveCanvasNode {
  return {
    id,
    canonicalType: 'Formula',
    label,
    description: '增益 $G(s)$',
    governance: { reviewStatus: 'approved', publicationStatus: 'published', lifecycleStatus: 'active' },
    semanticSupport: { supported: true, readOnly: true },
    typeLabel: '公式',
    ...extras,
  };
}

describe('governed math knowledge presentation', () => {
  it('still projects explicit legacy formula_latex without scanning surrounding text', () => {
    expect(projectActiveNodeMathematics({ formula_latex: 'G(s)=\\frac{1}{s}' })).toEqual({
      state: 'available',
      expression: 'G(s)=\\frac{1}{s}',
      display: 'block',
    });
    expect(projectActiveNodeMathematics({ concept_kind: 'engineering' })).toEqual({ state: 'missing' });
  });

  it('searches governed labels instead of raw LaTeX command noise', () => {
    const model = createActiveAuthorityGraphModel({
      nodes: [node('ctc:1', '时间常数', {
        searchText: '时间常数 tau',
        richTitle: {
          state: 'available',
          locale: 'zh-CN',
          contentHash: 'a'.repeat(64),
          renderKey: 'title',
          accessibleName: '时间常数 tau',
          copyText: '时间常数 τ',
          searchText: '时间常数 tau',
          blocks: [{ kind: 'paragraph', spans: [{ kind: 'text', text: '时间常数 ' }, {
            kind: 'math',
            display: 'inline',
            latex: '\\tau',
            macroProfileId: 'ctmacro:katex-default-v1',
            macroProfileHash: '9da48a920152b4ea1ca7eacd8b5d8f94aeb54ca3218b47ec08923611a3942b74',
            accessibleLabel: 'tau',
            copyLatex: '\\tau',
            renderKey: 'tau',
          }] }],
        },
      })],
      relations: [],
    });
    expect(activeNodeSearch(model, 'tau').map((row) => row.key)).toEqual(['ctc:1']);
    expect(activeNodeSearch(model, '\\frac').map((row) => row.key)).toEqual([]);
    expect(activeNodeSearch(model, '$G(s)$').map((row) => row.key)).toEqual([]);
  });

  it('hides formula titles that lost meaning after registered unavailability', () => {
    const model = createActiveAuthorityGraphModel({
      nodes: [node('ctc:hidden', '名称暂不可用', {
        richTitle: {
          state: 'registered-unavailable',
          locale: 'zh-CN',
          reasonCode: 'katex-strict-failed',
          fallbackText: '名称暂不可用',
          accessibleName: '名称暂不可用',
        },
      })],
      relations: [],
    });
    expect(model.nodes).toEqual([]);
  });

  it('keeps shared graph and card consumers on one KaTeX factory', () => {
    const card = readFileSync(path.join(process.cwd(), 'src/features/knowledge/knowledge-card.tsx'), 'utf8');
    const markdown = readFileSync(path.join(process.cwd(), 'src/components/shared/runtime-markdown.tsx'), 'utf8');
    const graph2d = readFileSync(path.join(process.cwd(), 'src/features/knowledge/graph/knowledge-graph-2d.tsx'), 'utf8');
    const graph3d = readFileSync(path.join(process.cwd(), 'src/features/knowledge/graph/knowledge-graph-canvas.tsx'), 'utf8');
    const dockerignore = readFileSync(path.join(process.cwd(), '.dockerignore'), 'utf8');
    expect(card).toContain('createGovernedRehypeKatexOptions');
    expect(markdown).toContain('createGovernedRehypeKatexOptions');
    expect(graph2d).toContain('SemanticLabelLayer');
    expect(graph2d).toContain('node.richTitle');
    expect(graph3d).toContain('GovernedRichText');
    expect(dockerignore).toContain('course-content/authoring/knowledge/governance/governed-math');
  });
});
