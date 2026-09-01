import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it, vi } from 'vitest';

import { GovernedRichText } from '@/components/shared/governed-rich-text';
import { projectActiveNodeMathematics } from '../active-authority-graph-contracts';
import {
  activeNodeSearch,
  createActiveAuthorityGraphModel,
} from '../active-authority-presentation';
import { toActiveRuntimeNodes } from '../graph/authority-runtime-adapter';
import { createAuthorityGraphViewModel } from '../authority-graph-view-model';
import { GovernedFormulaLabel, SemanticLabelLayer } from '../graph/semantic-label-layer';
import {
  governedKatexCallCount,
  resetGovernedKatexCache,
  type GovernedFormulaProjection,
} from '@/lib/governed-math';
import type { ActiveCanvasNode, ActiveCanvasRelation } from '../active-authority-graph-contracts';

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

  it('renders repeated governed math spans without duplicate React keys', () => {
    const duplicateKeyWarning = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const markup = renderToStaticMarkup(
        createElement(GovernedRichText, {
          projection: {
            state: 'available',
            locale: 'zh-CN',
            contentHash: 'b'.repeat(64),
            renderKey: 'repeated-formula',
            accessibleName: '重复公式 P(s)',
            copyText: 'P(s) P(s)',
            searchText: 'P(s) P(s)',
            blocks: [{
              kind: 'paragraph',
              spans: [
                { kind: 'math', display: 'inline', latex: 'P(s)', macroProfileId: 'ctmacro:katex-default-v1', macroProfileHash: '9da48a920152b4ea1ca7eacd8b5d8f94aeb54ca3218b47ec08923611a3942b74', accessibleLabel: 'P(s)', copyLatex: 'P(s)', renderKey: 'same-math' },
                { kind: 'text', text: ' 与 ' },
                { kind: 'math', display: 'inline', latex: 'P(s)', macroProfileId: 'ctmacro:katex-default-v1', macroProfileHash: '9da48a920152b4ea1ca7eacd8b5d8f94aeb54ca3218b47ec08923611a3942b74', accessibleLabel: 'P(s)', copyLatex: 'P(s)', renderKey: 'same-math' },
              ],
            }],
          },
          density: 'preview',
        }),
      );
      expect(markup.match(/data-governed-math-span="same-math"/g)).toHaveLength(2);
      expect(duplicateKeyWarning).not.toHaveBeenCalled();
    } finally {
      duplicateKeyWarning.mockRestore();
    }
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

  it('carries governed mathematics through the view model and runtime nodes', () => {
    const mathematics: GovernedFormulaProjection = {
      state: 'available',
      display: 'block',
      latex: 'G(s)=\\frac{1}{s}',
      macroProfileId: 'ctmacro:katex-default-v1',
      macroProfileHash: '9da48a920152b4ea1ca7eacd8b5d8f94aeb54ca3218b47ec08923611a3942b74',
      accessibleLabel: 'G(s)=1/s',
      copyLatex: 'G(s)=\\frac{1}{s}',
      renderKey: 'a'.repeat(32),
    };
    const relations: ActiveCanvasRelation[] = [];
    const model = createActiveAuthorityGraphModel({
      nodes: [node('ctf:1', '传递函数', { mathematics })],
      relations,
    });
    expect(model.nodeByKey.get('ctf:1')?.mathematics?.state).toBe('available');
    const view = createAuthorityGraphViewModel({
      nodes: [node('ctf:1', '传递函数', { mathematics })],
      relations,
    });
    const runtimeNodes = toActiveRuntimeNodes(view);
    expect(runtimeNodes[0]?.mathematics?.state).toBe('available');
    if (runtimeNodes[0]?.mathematics?.state !== 'available') return;
    expect(runtimeNodes[0]?.mathematics.latex).toBe('G(s)=\\frac{1}{s}');
  });

  it('renders the governed formula label with cached KaTeX and bounded human context', () => {
    resetGovernedKatexCache();
    const projection: GovernedFormulaProjection = {
      state: 'available',
      display: 'inline',
      latex: '\\tau',
      macroProfileId: 'ctmacro:katex-default-v1',
      macroProfileHash: '9da48a920152b4ea1ca7eacd8b5d8f94aeb54ca3218b47ec08923611a3942b74',
      accessibleLabel: 'tau 时间常数',
      copyLatex: '\\tau',
      renderKey: 'b'.repeat(32),
    };
    const label = createElement(GovernedFormulaLabel, {
      projection,
      humanContext: '时间常数',
      theme: 'dark',
    });
    const first = renderToStaticMarkup(label);
    // Coordinates change → re-render: KaTeX must not execute again.
    const second = renderToStaticMarkup(label);
    expect(first).toContain(`data-governed-formula-label="${'b'.repeat(32)}"`);
    expect(first).toContain('katex');
    expect(first).toContain('aria-label="tau 时间常数"');
    expect(first).toContain('时间常数');
    expect(governedKatexCallCount()).toBe(1);
    expect(second).toBe(first);
  });

  it('renders the reviewed unavailable formula label without latex leakage', () => {
    const markup = renderToStaticMarkup(createElement(GovernedFormulaLabel, {
      projection: {
        state: 'registered-unavailable',
        reasonCode: 'katex-strict-failed',
        fallbackText: '公式暂不可用',
        accessibleName: '公式暂不可用',
      },
      theme: 'dark',
    }));
    expect(markup).toContain('data-governed-formula-label="unavailable"');
    expect(markup).toContain('公式暂不可用');
    expect(markup).not.toContain('\\tag');
  });

  it('renders formula labels through the shared semantic label layer', () => {
    resetGovernedKatexCache();
    const markup = renderToStaticMarkup(createElement(SemanticLabelLayer, {
      labels: [{
        id: 'ctf:label-1',
        mathematics: {
          state: 'available',
          display: 'inline',
          latex: '\\zeta',
          macroProfileId: 'ctmacro:katex-default-v1',
          macroProfileHash: '9da48a920152b4ea1ca7eacd8b5d8f94aeb54ca3218b47ec08923611a3942b74',
          accessibleLabel: 'zeta 阻尼比',
          copyLatex: '\\zeta',
          renderKey: 'c'.repeat(32),
        },
        humanContext: '阻尼比',
        fallbackLines: ['阻尼比'],
        accessibleName: 'zeta 阻尼比',
        visible: true,
        x: 10,
        y: 10,
        width: 120,
        height: 24,
        fontSize: 12,
        isRootBubble: false,
        opacity: 1,
      }],
      theme: 'dark',
    }));
    expect(markup).toContain(`data-governed-formula-label="${'c'.repeat(32)}"`);
    expect(markup).toContain('阻尼比');
    expect(markup).toContain('data-knowledge-2d-node-label="ctf:label-1"');
  });
});
