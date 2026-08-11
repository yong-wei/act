'use client';

import { useState, type ReactNode } from 'react';

import type { PlatformRole } from '@/components/platform/platform-ui-contracts';
import { ActiveAuthorityGraph } from './active-authority-graph';
import { CandidateAuthoritativeGraph } from './candidate-authoritative-graph';

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
  const candidateDiagnosticEnabled = candidateAllowed && controlledVerification;

  return (
    <div
      className="relative h-full min-h-0"
      data-knowledge-graph-version={mode}
      data-knowledge-graph-mode={mode}
    >
      <div className="absolute right-3 top-3 z-50 flex rounded-lg border border-platform-border bg-platform-surface/95 p-1 shadow-lg backdrop-blur">
        <button
          type="button"
          aria-pressed={mode === 'active'}
          data-knowledge-mode="active"
          onClick={() => setMode('active')}
          className={`rounded-md px-3 py-1.5 text-xs font-medium ${mode === 'active' ? 'bg-platform-action-primary text-platform-fg-inverse' : 'text-platform-fg-secondary hover:bg-platform-action-subtle'}`}
        >
          当前 Authority
        </button>
        <button
          type="button"
          aria-pressed={mode === 'legacy'}
          data-knowledge-mode="legacy"
          onClick={() => setMode('legacy')}
          className={`rounded-md px-3 py-1.5 text-xs font-medium ${mode === 'legacy' ? 'bg-platform-action-primary text-platform-fg-inverse' : 'text-platform-fg-secondary hover:bg-platform-action-subtle'}`}
        >
          历史 Legacy
        </button>
        {candidateDiagnosticEnabled ? (
          <button
            type="button"
            aria-pressed={mode === 'candidate'}
            data-knowledge-mode="candidate"
            onClick={() => setMode('candidate')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${mode === 'candidate' ? 'bg-platform-action-primary text-platform-fg-inverse' : 'text-platform-fg-secondary hover:bg-platform-action-subtle'}`}
          >
            受控候选诊断
          </button>
        ) : null}
      </div>

      {mode === 'active' ? (
        <ActiveAuthorityGraph key="active" viewerRole={viewerRole} />
      ) : mode === 'candidate' && candidateDiagnosticEnabled ? (
        <CandidateAuthoritativeGraph
          key="candidate"
          viewerRole={viewerRole}
          controlledVerification={controlledVerification}
        />
      ) : (
        <div key="legacy" className="h-full min-h-0" data-knowledge-legacy-view="true">
          {legacy}
        </div>
      )}
    </div>
  );
}
