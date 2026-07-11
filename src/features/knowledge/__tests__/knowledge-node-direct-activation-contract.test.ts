import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd(), 'src/features/knowledge');
const source = fs.readFileSync(path.join(root, 'knowledge-graph-system.tsx'), 'utf8');

describe('knowledge graph direct activation contract', () => {
  it('restores the mounted guard during StrictMode effect replay', () => {
    expect(source).toContain('mountedRef.current = true;');
    expect(source).toContain('const requestControllers = expansionRequestControllersRef.current;\n    return () => {');
    expect(source).toContain('mountedRef.current = false;');
    expect(source).toContain('setLoadingExpansionNodeIds((current) => current.filter((id) => id !== nodeId))');
  });

  it('routes every node entry surface through one id-based resolver', () => {
    expect(source).toContain('const activateNodeById = useCallback(async (nodeId: string) =>');
    expect(source).toContain('onNodeClick={activateNode}');
    expect(source).toContain('onNodeSelect={activateNode}');
    expect(source).toContain('onNodeClick={activateNodeById}');
    expect(source).toContain('const [isPanelOpen, setIsPanelOpen] = useState(false)');
  });

  it('uses semantic native buttons for synchronized pointer and keyboard activation', () => {
    expect(source).toContain('data-knowledge-node-control={node.id}');
    expect(source).toContain('aria-busy={loadingExpansionNodeIds.includes(node.id)}');
    expect(source).toContain('aria-expanded={node.expansion?.state === \'expandable\' ? expandedNodeIdSet.has(node.id) : undefined}');
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
