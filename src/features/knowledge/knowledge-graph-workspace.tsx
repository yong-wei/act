'use client';

import { useState, type ReactNode } from 'react';

import type { PlatformRole } from '@/components/platform/platform-ui-contracts';
import { ActiveAuthorityGraph } from './active-authority-graph';
import { CandidateAuthoritativeGraph } from './candidate-authoritative-graph';
import { knowledgeGraphProductVersionLabel } from './graph/graph-presentation-contract';
import type { GraphDimension } from './graph-runtime-session';

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
  const candidateDiagnosticEnabled = candidateAllowed && controlledVerification;

  return (
    <div
      className="relative h-full min-h-0"
      data-knowledge-graph-version={mode}
      data-knowledge-graph-mode={mode}
    >
      <div
        className="absolute right-3 top-3 z-50 flex rounded-lg border border-platform-border bg-platform-surface/95 p-1 shadow-lg backdrop-blur max-[639px]:left-3 max-[639px]:right-3 max-[639px]:w-auto max-[639px]:flex-nowrap max-[639px]:overflow-x-auto"
        data-knowledge-mode-switch="true"
        data-knowledge-workspace-toolbar="true"
      >
        <button
          type="button"
          aria-pressed={mode === 'active'}
          data-knowledge-mode="active"
          aria-label={knowledgeGraphProductVersionLabel('active')}
          onClick={() => setMode('active')}
          className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ${mode === 'active' ? 'bg-platform-action-primary text-platform-fg-inverse' : 'text-platform-fg-secondary hover:bg-platform-action-subtle'}`}
        >
          {knowledgeGraphProductVersionLabel('active')}
        </button>
        <button
          type="button"
          aria-pressed={mode === 'legacy'}
          data-knowledge-mode="legacy"
          aria-label={knowledgeGraphProductVersionLabel('legacy')}
          onClick={() => setMode('legacy')}
          className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ${mode === 'legacy' ? 'bg-platform-action-primary text-platform-fg-inverse' : 'text-platform-fg-secondary hover:bg-platform-action-subtle'}`}
        >
          {knowledgeGraphProductVersionLabel('legacy')}
        </button>
        {candidateDiagnosticEnabled ? (
          <button
            type="button"
            aria-pressed={mode === 'candidate'}
            data-knowledge-mode="candidate"
            onClick={() => setMode('candidate')}
            className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ${mode === 'candidate' ? 'bg-platform-action-primary text-platform-fg-inverse' : 'text-platform-fg-secondary hover:bg-platform-action-subtle'}`}
          >
            受控候选诊断
          </button>
        ) : null}
      </div>

      <div className={mode === 'active' ? 'h-full min-h-0' : 'hidden'} data-knowledge-session="active">
        <ActiveAuthorityGraph
          viewerRole={viewerRole}
          dimension={dimension}
          onDimensionChange={setDimension}
        />
      </div>
      {mode === 'candidate' && candidateDiagnosticEnabled ? (
        <div className="h-full min-h-0" data-knowledge-session="candidate">
          <CandidateAuthoritativeGraph
            viewerRole={viewerRole}
            controlledVerification={controlledVerification}
          />
        </div>
      ) : null}
      <div className={mode === 'legacy' ? 'h-full min-h-0' : 'hidden'} data-knowledge-legacy-view="true" data-knowledge-session="legacy">
        {legacy}
      </div>
    </div>
  );
}
