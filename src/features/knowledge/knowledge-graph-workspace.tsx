'use client';

import { useState, type ReactNode } from 'react';

import type { PlatformRole } from '@/components/platform/platform-ui-contracts';
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
  const [mode, setMode] = useState<'candidate' | 'legacy'>(
    candidateAllowed ? 'candidate' : 'legacy',
  );

  return (
    <div className="relative h-full min-h-0" data-knowledge-graph-version={mode}>
      {candidateAllowed ? (
        <div className="absolute right-3 top-3 z-50 flex rounded-lg border border-platform-border bg-platform-surface/95 p-1 shadow-lg backdrop-blur">
          <button
            type="button"
            aria-pressed={mode === 'candidate'}
            onClick={() => setMode('candidate')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${mode === 'candidate' ? 'bg-platform-action-primary text-platform-fg-inverse' : 'text-platform-fg-secondary hover:bg-platform-action-subtle'}`}
          >
            新版候选
          </button>
          <button
            type="button"
            aria-pressed={mode === 'legacy'}
            onClick={() => setMode('legacy')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${mode === 'legacy' ? 'bg-platform-action-primary text-platform-fg-inverse' : 'text-platform-fg-secondary hover:bg-platform-action-subtle'}`}
          >
            旧版 Legacy
          </button>
        </div>
      ) : null}

      {mode === 'candidate' && candidateAllowed ? (
        <CandidateAuthoritativeGraph
          key="candidate"
          viewerRole={viewerRole}
          controlledVerification={controlledVerification}
        />
      ) : (
        <div key="legacy" className="h-full min-h-0">
          {legacy}
        </div>
      )}
    </div>
  );
}
