import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd(), 'src/features/knowledge');
const source = fs.readFileSync(path.join(root, 'knowledge-graph-system.tsx'), 'utf8');
const resourcePanelSource = fs.readFileSync(path.join(root, 'resource-panel/resource-panel.tsx'), 'utf8');
const canvasSource = fs.readFileSync(path.join(root, 'graph/knowledge-graph-canvas.tsx'), 'utf8');

describe('knowledge graph direct activation contract', () => {
  it('restores the mounted guard during StrictMode effect replay', () => {
    expect(source).toContain('mountedRef.current = true;');
    expect(source).toContain('mountedRef.current = false;');
    expect(source).toContain('navigationRequestControllerRef.current?.abort();');
    expect(source).toContain('const loadingShardOwners = loadingShardOwnerByKeyRef.current;');
    expect(source).toContain('loadingShardOwners.clear();');
    expect(source).toContain('currentNavigationLoadingRef.current = null;');
  });

  it('routes every node entry surface through one id-based resolver', () => {
    expect(source).toContain('const activateNodeById = useCallback((nodeId: string) =>');
    expect(source).toContain('onNodeClick={activateNode}');
    expect(source).toContain('onNodeSelect={activateNode}');
    expect(source).toContain('onNodeClick={activateNodeById}');
    expect(source).toContain('const isPanelOpen = inspection.isPanelOpen;');
    expect(source).toContain("dispatchInspection({ type: 'inspect-node', node })");
  });

  it('keeps Related navigation id-only and lets absent cache targets resolve through the canonical activation path', () => {
    expect(resourcePanelSource).toContain('onClick={() => onNodeClick?.(node.id)}');
    expect(source).toContain('const node = graphCache.nodesById[nodeId]');
    expect(source).toContain('?? rootCatalogNodes.find((candidate) => candidate.id === nodeId);');
    expect(source).toContain('void loadDomain(domainId, false, nodeId);');
  });

  it('makes 3D depth consume the same first-reveal provenance helper as the 2D layout', () => {
    expect(canvasSource).toContain('resolveFocusedExpansionDepthByNodeId({');
    expect(canvasSource).toContain('activationSequenceByCenterId,');
    expect(canvasSource).not.toContain('[...expandedIdSet].sort()');
  });

  it('uses semantic native buttons for synchronized pointer and keyboard activation', () => {
    expect(source).toContain('data-knowledge-node-control={node.id}');
    expect(source).toContain("aria-busy={isCollapsedRootNode(node) && navigation.view.kind === 'domain'");
    expect(source).toContain("aria-expanded={isCollapsedRootNode(node) ? navigation.view.kind === 'domain'");
    expect(source).toContain('focus:opacity-100');
    expect(source).toContain('aria-describedby="knowledge-node-activation-status"');
    expect(source).not.toContain('className="sr-only" aria-label="知识图谱节点控制"');
    expect(source).not.toContain('onKeyDown={(event) =>');
  });

  it('removes the legacy following control and instruction panel', () => {
    expect(source).not.toContain('data-knowledge-node-expansion-control="true"');
    expect(source).not.toContain('data-knowledge-expansion-panel="selected-node"');
    expect(source).not.toContain('expansionControlAnchorRef');
    expect(source).not.toContain('handleSelectedNodeScreenPosition');
  });
});
