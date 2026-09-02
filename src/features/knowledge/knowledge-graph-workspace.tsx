'use client';

import { useRef, useState, type ReactNode } from 'react';

import type { PlatformRole } from '@/components/platform/platform-ui-contracts';
import { ActiveAuthorityGraph } from './active-authority-graph';
import { CandidateAuthoritativeGraph } from './candidate-authoritative-graph';
import { knowledgeGraphProductVersionLabel } from './graph/graph-presentation-contract';
import { KNOWLEDGE_WORKSPACE_CHROME_SLOT_ID } from './graph/knowledge-workspace-chrome';
import { createGraphRuntimeSessionStore, type GraphDimension } from './graph-runtime-session';

interface KnowledgeGraphWorkspaceProps {
  viewerRole: PlatformRole;
  candidateAllowed: boolean;
  controlledVerification: boolean;
  legacy: ReactNode;
}

export function KnowledgeGraphWorkspace({
  viewerRole,
  candidateAllowed,
  controlledVerification,
  legacy,
}: KnowledgeGraphWorkspaceProps) {
  const [mode, setMode] = useState<'active' | 'legacy' | 'candidate'>('active');
  const [dimension, setDimension] = useState<GraphDimension>('2d');
  const [activeDomainId, setActiveDomainId] = useState<string | null>(null);
  const returnToRootRef = useRef<(() => void) | null>(null);
  const chromeHostRef = useRef<HTMLDivElement | null>(null);
  const runtimeControlsRef = useRef<{
    requestFitView: (target?: 'current' | 'root' | 'teaching-layout') => void;
    requestRelayout: () => void;
    requestUnpin: (nodeId?: string) => void;
  } | null>(null);
  const sessionsRef = useRef(createGraphRuntimeSessionStore());
  const candidateDiagnosticEnabled = candidateAllowed && controlledVerification;

  function persistCurrentSession() {
    if (mode === 'candidate') return;
    sessionsRef.current.write(mode, {
      dimension,
      inspectorOpen: Boolean(activeDomainId),
    });
  }

  function selectMode(next: 'active' | 'legacy' | 'candidate') {
    persistCurrentSession();
    setMode(next);
    if (next === 'active' || next === 'legacy') {
      const restored = sessionsRef.current.restore(next);
      if (next === 'active') setDimension(restored.dimension);
    }
  }

  function selectActiveDimension(next: GraphDimension) {
    setDimension(next);
    sessionsRef.current.write('active', { dimension: next });
  }

  return (
    <div
      className="relative flex h-full min-h-0 flex-col overflow-hidden"
      data-knowledge-graph-version={mode}
      data-knowledge-graph-mode={mode}
      data-knowledge-session-store="namespace"
    >
      <div
        className="absolute left-[16.5rem] right-3 top-3 z-50 flex min-w-0 flex-wrap items-center justify-end gap-1 rounded-lg border border-platform-border bg-platform-surface/95 p-1 shadow-lg backdrop-blur max-[639px]:left-3 max-[639px]:right-3 max-[639px]:w-auto max-[639px]:flex-nowrap max-[639px]:overflow-x-auto"
        data-knowledge-mode-switch="true"
        data-knowledge-workspace-toolbar="true"
        data-knowledge-toolbar-gutter="language"
      >
        <button
          type="button"
          aria-pressed={mode === 'active'}
          data-knowledge-mode="active"
          aria-label={knowledgeGraphProductVersionLabel('active')}
          onClick={() => selectMode('active')}
          className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ${mode === 'active' ? 'bg-platform-action-primary text-platform-fg-inverse' : 'text-platform-fg-secondary hover:bg-platform-action-subtle'}`}
        >
          {knowledgeGraphProductVersionLabel('active')}
        </button>
        <button
          type="button"
          aria-pressed={mode === 'legacy'}
          data-knowledge-mode="legacy"
          aria-label={knowledgeGraphProductVersionLabel('legacy')}
          onClick={() => selectMode('legacy')}
          className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ${mode === 'legacy' ? 'bg-platform-action-primary text-platform-fg-inverse' : 'text-platform-fg-secondary hover:bg-platform-action-subtle'}`}
        >
          {knowledgeGraphProductVersionLabel('legacy')}
        </button>
        {candidateDiagnosticEnabled ? (
          <button
            type="button"
            aria-pressed={mode === 'candidate'}
            data-knowledge-mode="candidate"
            onClick={() => selectMode('candidate')}
            className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ${mode === 'candidate' ? 'bg-platform-action-primary text-platform-fg-inverse' : 'text-platform-fg-secondary hover:bg-platform-action-subtle'}`}
          >
            受控候选诊断
          </button>
        ) : null}
        {mode === 'active' ? (
          <>
            <button
              type="button"
              aria-pressed={dimension === '2d'}
              data-active-authority-dimension="2d"
              aria-label="2D 视图"
              onClick={() => selectActiveDimension('2d')}
              className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ${dimension === '2d' ? 'bg-platform-action-subtle text-platform-fg-primary' : 'text-platform-fg-secondary hover:bg-platform-action-subtle'}`}
            >
              2D
            </button>
            <button
              type="button"
              aria-pressed={dimension === '3d'}
              data-active-authority-dimension="3d"
              aria-label="3D 视图"
              onClick={() => selectActiveDimension('3d')}
              className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ${dimension === '3d' ? 'bg-platform-action-subtle text-platform-fg-primary' : 'text-platform-fg-secondary hover:bg-platform-action-subtle'}`}
            >
              3D
            </button>
            <button
              type="button"
              data-knowledge-layout-control="fit-view"
              aria-label="适配视图"
              onClick={() => runtimeControlsRef.current?.requestFitView('current')}
              className="shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium text-platform-fg-secondary hover:bg-platform-action-subtle"
            >
              适配视图
            </button>
            <button
              type="button"
              data-knowledge-layout-control="relayout"
              aria-label="重新布局"
              onClick={() => runtimeControlsRef.current?.requestRelayout()}
              className="shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium text-platform-fg-secondary hover:bg-platform-action-subtle"
            >
              重新布局
            </button>
            {activeDomainId ? (
              <button
                type="button"
                data-active-authority-domain-return="true"
                data-knowledge-return-root="true"
                aria-label="返回全部领域"
                onClick={() => returnToRootRef.current?.()}
                className="shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium text-platform-fg-secondary hover:bg-platform-action-subtle"
              >
                返回全部领域
              </button>
            ) : null}
          </>
        ) : null}
      </div>
      {/* #1742：active 图的搜索与筛选 chrome 挂载在工具栏下方的独立行，
          全局工具栏只保留版本/维度/适配/重排/返回领域动作。顶部留白与
          active 画布的 pt-12/pt-14 对齐，避开悬浮工具栏。 */}
      <div
        ref={chromeHostRef}
        id={KNOWLEDGE_WORKSPACE_CHROME_SLOT_ID}
        data-knowledge-workspace-chrome-slot="true"
        className="mx-3 flex min-w-0 flex-col gap-1 pt-12 max-[639px]:pt-14"
        hidden={mode !== 'active'}
      />

      <div
        className={mode === 'active' ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'hidden'}
        hidden={mode !== 'active'}
        aria-hidden={mode !== 'active'}
        data-knowledge-session="active"
      >
        <ActiveAuthorityGraph
          viewerRole={viewerRole}
          dimension={dimension}
          onDimensionChange={selectActiveDimension}
          onActiveDomainChange={setActiveDomainId}
          returnToRootRef={returnToRootRef}
          chromeHostRef={chromeHostRef}
          runtimeControlsRef={runtimeControlsRef}
        />
      </div>
      {mode === 'candidate' && candidateDiagnosticEnabled ? (
        <div
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          data-knowledge-session="candidate"
        >
          <CandidateAuthoritativeGraph
            viewerRole={viewerRole}
            controlledVerification={controlledVerification}
          />
        </div>
      ) : null}
      <div
        className={mode === 'legacy' ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'hidden'}
        hidden={mode !== 'legacy'}
        aria-hidden={mode !== 'legacy'}
        data-knowledge-legacy-view="true"
        data-knowledge-session="legacy"
      >
        {legacy}
      </div>
    </div>
  );
}
