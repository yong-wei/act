'use client';

import { useEffect, useMemo, useState } from 'react';

import type { AdmittedLocale } from '@/lib/authority-locale-readiness/contracts';
import type { ActiveAuthorityMasteryOverlay, ActiveAuthorityMasteryReport } from '@/lib/authority-learner-mastery';
import { formatGraphInterfaceText } from '@/lib/authority-locale-readiness/graph-interface-catalog';

import { graphCopy } from './active-authority-graph-i18n';
import { useActiveCanvasPalette, type ActiveMasteryState } from './graph/active-renderer/active-authority-palette';
import type { ActiveNodeMasteryMark } from './graph/active-renderer/active-authority-renderer-types';

export type ActiveMasteryLoadState =
  | { status: 'idle' | 'loading' | 'unavailable' | 'not-applicable' }
  | { status: 'empty' }
  | { status: 'ready'; overlay: ActiveAuthorityMasteryReport };

const MASTERY_STATES: readonly ActiveMasteryState[] = ['mastered', 'developing', 'weak', 'evidence-needed'];

export function useActiveAuthorityMastery(enabled: boolean): ActiveMasteryLoadState {
  const [state, setState] = useState<ActiveMasteryLoadState>({ status: 'idle' });
  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle' });
      return;
    }
    const controller = new AbortController();
    setState({ status: 'loading' });
    fetch('/api/knowledge/shards/active/mastery', { signal: controller.signal, headers: { accept: 'application/json' } })
      .then(async (response) => {
        if (!response.ok) throw new Error(`mastery ${response.status}`);
        const overlay = await response.json() as ActiveAuthorityMasteryOverlay;
        if (overlay.status === 'ready') setState({ status: 'ready', overlay });
        else if (overlay.status === 'empty') setState({ status: 'empty' });
        else setState({ status: 'not-applicable' });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'unavailable' });
      });
    return () => controller.abort();
  }, [enabled]);
  return state;
}

export function useActiveMasteryMarks(state: ActiveMasteryLoadState): {
  byVisualRole?: ReadonlyMap<string, ActiveNodeMasteryMark>;
  byNodeId?: ReadonlyMap<string, ActiveNodeMasteryMark>;
} {
  return useMemo(() => {
    if (state.status !== 'ready') return {};
    return {
      byVisualRole: new Map(state.overlay.domains.map((domain) => [domain.visualRole, { state: domain.state, score: domain.score }])),
      byNodeId: new Map(state.overlay.objects.map((object) => [object.id, { state: object.state, score: object.score }])),
    };
  }, [state]);
}

export function activeRootCaptions(input: {
  locale: AdmittedLocale;
  domains: ReadonlyArray<{ visualRole: string; memberCount: number }>;
  mastery?: ReadonlyMap<string, ActiveNodeMasteryMark>;
}): ReadonlyMap<string, string> {
  const captions = new Map<string, string>();
  for (const domain of input.domains) {
    const mark = input.mastery?.get(domain.visualRole);
    captions.set(
      domain.visualRole,
      mark && mark.score !== null && mark.state !== 'evidence-needed'
        ? formatGraphInterfaceText('mastery.domainScore', input.locale, { percent: Math.round(mark.score * 100) })
        : formatGraphInterfaceText('mastery.pointCount', input.locale, { count: domain.memberCount }),
    );
  }
  return captions;
}

export function ActiveMasteryLegend({ state, locale, className = '' }: {
  state: ActiveMasteryLoadState;
  locale: AdmittedLocale;
  className?: string;
}) {
  const palette = useActiveCanvasPalette();
  if (state.status === 'empty') {
    return (
      <p role="status" data-active-mastery-empty="true" className={`text-xs text-platform-fg-muted ${className}`}>
        {graphCopy(locale, 'mastery.empty')}
      </p>
    );
  }
  if (state.status !== 'ready') return null;
  return (
    <div data-active-mastery-legend="true" className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-platform-fg-secondary ${className}`}>
      <span className="font-medium text-platform-fg-primary">{graphCopy(locale, 'mastery.legend')}</span>
      {MASTERY_STATES.map((key) => (
        <span key={key} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: palette.mastery[key] }} />
          {graphCopy(locale, `mastery.${key}`)}
        </span>
      ))}
    </div>
  );
}
