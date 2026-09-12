import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { createAuthorityGraphViewModel } from '../authority-graph-view-model';
import type { ActiveCanvasNode, ActiveCanvasRelation } from '../active-authority-graph-contracts';
import {
  ACTIVE_ROOT_PRESENTATION_KIND,
  isActiveRootNavigationNode,
  toActiveRuntimeNodes,
  toActiveRootRuntimeNodes,
} from '../graph/authority-runtime-adapter';
import { getEmptyKnowledgeGraphLayoutState, storeKnowledgeGraphNodePosition } from '../graph/layout-state';
import {
  createEmptyDimensionLayoutStore,
  isMutableRuntimeLayout,
  selectDimensionLayout,
  writeDimensionLayout,
} from '../graph/use-knowledge-graph-runtime-layout';
import { getKnowledgeConceptNodeShape, getKnowledgeNodeScale } from '../graph/visual-config';

function node(id: string, canonicalType: string, label: string): ActiveCanvasNode {
  return {
    id,
    canonicalType,
    label,
    aliases: [],
    description: null,
    governance: { reviewStatus: null, publicationStatus: null, lifecycleStatus: null },
    semanticSupport: { supported: true, readOnly: true },
  };
}

function relation(id: string, predicate: string, sourceId: string, targetId: string): ActiveCanvasRelation {
  return {
    id,
    predicate,
    sourceId,
    targetId,
    direction: 'source_to_target',
    direct: null,
    qualityTier: 'GOLD',
    governance: { reviewStatus: null, publicationStatus: null },
    semanticSupport: { supported: true, readOnly: true },
    layer: 'ACT_TEACHING',
    relationFamily: 'teaching-prerequisite',
  };
}

describe('active authority shared force runtime', () => {
  it('rejects the archived SVG root, bounded canvas card, and reduced wrapper as product owners', () => {
    const graph = readFileSync(path.join(process.cwd(), 'src/features/knowledge/active-authority-graph.tsx'), 'utf8');
    const workspace = readFileSync(path.join(process.cwd(), 'src/features/knowledge/knowledge-graph-workspace.tsx'), 'utf8');
    const runtimeView = readFileSync(path.join(process.cwd(), 'src/features/knowledge/active-authority-runtime-view.tsx'), 'utf8');
    const adapter = readFileSync(path.join(process.cwd(), 'src/features/knowledge/graph/authority-runtime-adapter.ts'), 'utf8');
    const system = readFileSync(path.join(process.cwd(), 'src/features/knowledge/knowledge-graph-system.tsx'), 'utf8');

    expect(graph).not.toContain('ActiveAuthorityForceCanvas');
    expect(graph).not.toContain('ActiveAuthorityRootCanvas');
    expect(graph).not.toContain('layoutActiveAuthorityNodes');
    expect(graph).not.toContain('h-[min(70vh');
    expect(graph).not.toContain('0 0 960 520');
    expect(graph).toContain('ActiveAuthorityRuntimeView');
    expect(workspace).toContain('data-active-authority-dimension="2d"');
    expect(workspace).toContain('data-active-authority-dimension="3d"');
    expect(workspace).toContain('data-active-authority-domain-return');
    expect(workspace).toContain('min-h-0');
    expect(workspace).not.toContain('overflow-y-auto');
    expect(workspace).toContain('data-knowledge-workspace-chrome-slot');
    expect(workspace).toContain('data-knowledge-toolbar-gutter="language"');
    expect(workspace).toContain('right-3 top-3');
    expect(workspace).toContain('max-w-[min(28rem,calc(50%-1.25rem))]');
    expect(workspace).toContain('data-knowledge-workspace-overlay="true"');
    expect(graph).toContain('data-graph-language-switch="true"');
    expect(graph).toContain('useKnowledgeGraphRuntimeLayout({ dimension, scopeKey: graphScopeKey, fixedLayout: true })');
    expect(workspace).toContain('data-knowledge-layout-control="fit-view"');
    expect(workspace).toContain('data-knowledge-layout-control="relayout"');
    expect(workspace).toContain('createGraphRuntimeSessionStore');
    expect(workspace).toContain('data-knowledge-session="legacy"');
    expect(workspace).toContain("mode === 'legacy' ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'hidden'");
    expect(workspace).not.toContain('{mode === \'legacy\' ? (');
    expect(runtimeView).toContain('ActiveAuthorityRenderer');
    expect(runtimeView).not.toContain('KnowledgeGraphRuntimeCanvas');
    expect(runtimeView).toContain('data-active-authority-runtime="dedicated-renderer"');
    expect(runtimeView).toContain('onNodeDragEnd={handleNodeDragEnd}');
    expect(runtimeView).not.toContain('onNodeDragEnd={() => undefined}');
    expect(runtimeView).not.toContain("nodeType: 'THEORY'");
    expect(runtimeView).toContain('sessionKey');
    expect(runtimeView).not.toContain('nodeIdsKey, requestFitView');
    expect(graph).toContain('KnowledgeWorkspaceChromePortal');
    expect(adapter).toContain('runtimeNodeTypeFor');
    expect(adapter).not.toMatch(/nodeType:\s*'THEORY'/);
    expect(system).toContain('KnowledgeGraphRuntimeCanvas');
    expect(system).toContain('useKnowledgeGraphRuntimeLayout');
    expect(system).not.toContain("from './graph/knowledge-graph-2d'");
  });

  it('emits registered active types instead of flattening every node to THEORY', () => {
    const view = createAuthorityGraphViewModel({
      nodes: [
        node('ctc:concept', 'DomainConcept', '稳定性'),
        node('ctc:model', 'SystemModel', '一阶模型'),
        node('ctc:repr', 'ModelRepresentation', '传递函数'),
      ],
      relations: [relation('edge-1', 'PREREQUISITE', 'ctc:concept', 'ctc:model')],
    });
    const nodes = toActiveRuntimeNodes(view);
    expect(new Set(nodes.map((row) => row.nodeType)).size).toBeGreaterThan(1);
    expect(nodes.every((row) => row.nodeType === 'THEORY')).toBe(false);
    expect(nodes.find((row) => row.id === 'ctc:concept')?.metadata?.registeredType).toBe('DomainConcept');
    expect(nodes.find((row) => row.id === 'ctc:model')?.nodeType).toBe('ETHICS');
    expect(nodes.find((row) => row.id === 'ctc:repr')?.nodeType).toBe('SCENARIO');
  });

  it('keeps root navigation identities outside Canonical object space', () => {
    const nodes = toActiveRootRuntimeNodes({
      kind: 'presentation-root-catalog',
      domains: [{
        kind: 'presentation-domain',
        order: 1,
        displayName: '系统建模',
        summary: '从对象到模型',
        presentationRole: 'domain',
        visualRole: 'modeling',
        memberCount: 12,
      }],
      aggregate: {
        kind: 'presentation-aggregate',
        order: 9,
        displayName: '综合',
        summary: '跨域汇总',
        presentationRole: 'aggregate',
        visualRole: 'aggregate',
        domainCount: 1,
      },
    });

    expect(nodes.every((row) => isActiveRootNavigationNode(row))).toBe(true);
    expect(nodes.every((row) => row.metadata?.canonicalObjectId == null)).toBe(true);
    expect(nodes.every((row) => row.metadata?.presentationKind === ACTIVE_ROOT_PRESENTATION_KIND)).toBe(true);
    expect(nodes.some((row) => String(row.id).startsWith('ctc:'))).toBe(false);
  });

  it('uses a mutable shared layout store rather than an empty frozen layout', () => {
    const empty = getEmptyKnowledgeGraphLayoutState();
    expect(isMutableRuntimeLayout(empty)).toBe(true);
    expect(empty.positionsByNodeId).toEqual({});
  });

  it('keeps 2D drag pins out of the 3D layout store', () => {
    const pinned = storeKnowledgeGraphNodePosition(getEmptyKnowledgeGraphLayoutState(), {
      id: 'node-a',
      x: 48,
      y: -12,
    });
    const afterTwoD = writeDimensionLayout(createEmptyDimensionLayoutStore(), '2d', pinned);
    expect(selectDimensionLayout(afterTwoD, '2d').positionsByNodeId['node-a']).toMatchObject({
      x: 48,
      y: -12,
      pinned: true,
    });
    expect(selectDimensionLayout(afterTwoD, '3d').positionsByNodeId).toEqual({});
  });

  it('lets governed presentation metadata win over legacy type flattening', () => {
    expect(getKnowledgeConceptNodeShape({
      conceptKind: 'system_kind',
      nodeType: 'THEORY',
      metadata: { presentationShape: 'diamond' },
    })).toBe('diamond');
    expect(getKnowledgeNodeScale({
      metadata: { decoration: { glyphRadius: 22 } },
      degree: 0,
    }).radius).toBe(22);
  });
});
