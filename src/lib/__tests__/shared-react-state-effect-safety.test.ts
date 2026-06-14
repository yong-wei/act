import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function readRepoFile(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

describe('shared React state/effect safety contracts', () => {
  it('resets selected knowledge resource panel state at the selected node identity boundary', () => {
    const source = readRepoFile('src/features/knowledge/resource-panel/resource-panel.tsx');

    expect(source).toContain('function ResourcePanelContent');
    expect(source).toContain('nodeDetailOwnerId');
    expect(source).toContain('nodeDetailOwnerId === selectedNode.id ? nodeDetail : null');
    expect(source).toContain('const selectedNodeId = selectedNode.id');
    expect(source).toContain('const controller = new AbortController();');
    expect(source).toContain('controller.abort();');
    expect(source).toContain('data?.id === selectedNodeId');
    expect(source).not.toContain('key={selectedNode.id}');
  });

  it('keeps MDX slide scaling as measured state and cleans up ResizeObserver subscriptions', () => {
    const source = readRepoFile('src/components/shared/mdx-slide.tsx');

    expect(source).toContain('const [measuredScale, setMeasuredScale] = useState(1)');
    expect(source).toContain('return () => observer.disconnect();');
    expect(source).toContain("const scale = size === 'ppt' ? measuredScale : 1;");
    expect(source).not.toContain('}, [size]);');
  });

  it('keeps MDX content loading keyed to the requested path so aborted requests cannot clear newer loading state', () => {
    const source = readRepoFile('src/hooks/use-mdx-content.ts');

    expect(source).toContain('MdxContentLoadState');
    expect(source).toContain('loadState?.path !== path');
    expect(source).toContain('controller.signal.aborted');
    expect(source).not.toContain('finally {');
  });

  it('initializes lesson orchestration drafts from the owning lesson identity without prop-sync effects', () => {
    const source = readRepoFile('src/features/lesson-engine/orchestrator-builder.tsx');

    expect(source).toContain('function createPlanStateFromInitialData');
    expect(source).toContain("key={initialData?.id ?? 'new'}");
    expect(source).toContain('() => createPlanStateFromInitialData(initialData)');
    expect(source).not.toContain('setPlanState(newState)');
  });

  it('initializes classroom poll runtime state at the poll identity boundary', () => {
    const source = readRepoFile('src/components/classroom/PollComponent.tsx');

    expect(source).toContain('function createInitialPollState');
    expect(source).toContain('function pollPlayerIdentityKey');
    expect(source).toContain('(config.options ?? []).map((option) => option.key).join');
    expect(source).toContain('() => createInitialPollState(options, config?.showLiveResults)');
    expect(source).toContain("${config.showLiveResults ? 'live' : 'hidden'}");
    expect(source).toContain('key={pollPlayerIdentityKey(config)}');
    expect(source).not.toContain('useState<PollState>({');
    expect(source).not.toContain('results: mockResults');
  });

  it('keeps URL-selected knowledge nodes working after asynchronous graph loading', () => {
    const source = readRepoFile('src/features/knowledge/knowledge-graph-system.tsx');

    expect(source).toContain('const initialRequestedNodeIdRef = useRef(initialRequestedNodeId)');
    expect(source).toContain('const requestedNode = fetchedNodes.find((item) => item.id === requestedNodeId)');
    expect(source).toContain('setSelectedNode(requestedNode)');
    expect(source).toContain('setIsPanelOpen(true)');
  });

  it('cleans up admin notice timers when status feedback unmounts or changes', () => {
    const source = readRepoFile('src/features/admin/system-config-dashboard.tsx');

    expect(source).toContain('noticeTimeoutRef');
    expect(source).toContain('clearNoticeTimer');
    expect(source).toContain('controller.abort();');
    expect(source).toContain('clearNoticeTimer();');
    expect(source).toContain('scheduleNoticeClear');
  });

  it('guards mount-time active platform fetches against unmounted updates', () => {
    const graphSource = readRepoFile('src/features/knowledge/knowledge-graph-system.tsx');
    const orchestratorSource = readRepoFile('src/features/lesson-engine/orchestrator-builder.tsx');

    expect(graphSource).toContain('const controller = new AbortController();');
    expect(graphSource).toContain('cancelled = true;');
    expect(graphSource).toContain('controller.abort();');
    expect(orchestratorSource).toContain("fetch('/api/resources?includeTeacherOnly=true', { signal: controller.signal })");
    expect(orchestratorSource).toContain("fetch('/api/knowledge/nodes', { signal: controller.signal })");
    expect(orchestratorSource.split('return () => controller.abort();').length - 1).toBeGreaterThanOrEqual(2);
  });
});
