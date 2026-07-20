'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, RefreshCw, Route } from 'lucide-react';

import {
  buildAdaptivePathLaunchContext,
  resolveAdaptivePathLaunchReturnContext,
  type AdaptivePathLaunchContext,
} from './adaptive-learning-center-contracts';
import type {
  AdaptivePathJourneyNextActionState,
  AuthorizedAdaptivePathJourney,
} from './adaptive-path-journey-contracts';
import { canonicalizeAdaptivePathInternalHref } from './adaptive-path-journey-contracts';
import { cn } from '@/lib/utils';

export type AdaptivePathJourneyReadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface AdaptivePathJourneyControlProps {
  launchContext: AdaptivePathLaunchContext;
  status: AdaptivePathJourneyReadStatus;
  journey: AuthorizedAdaptivePathJourney | null;
  error: string | null;
  onRefresh: () => void;
  className?: string;
}

export interface AdaptivePathOwnedResourceActionProps {
  opened: boolean;
  completionAllowed: boolean;
  pending: boolean;
  onStart: () => void;
  onComplete: () => void;
}

interface AdaptivePathJourneyReadState {
  status: AdaptivePathJourneyReadStatus;
  journey: AuthorizedAdaptivePathJourney | null;
  error: string | null;
}

const JOURNEY_UPDATED_EVENT = 'adaptive-path:journey-updated';
const JOURNEY_REFRESH_REQUESTED_EVENT = 'adaptive-path:journey-refresh-requested';

export function buildAdaptivePathJourneyReadHref(context: AdaptivePathLaunchContext): string {
  const params = new URLSearchParams({
    nodeId: context.nodeId,
    goalId: context.goalId,
  });
  return `/api/learning-paths/${encodeURIComponent(context.pathId)}/journey?${params.toString()}`;
}

export function parseAdaptivePathJourneyResponse(value: unknown): AuthorizedAdaptivePathJourney | null {
  const response = readRecord(value);
  const journey = readRecord(response.journey);
  const path = readRecord(journey.path);
  const goal = readRecord(journey.goal);
  const context = readRecord(journey.context);
  const progress = readRecord(journey.progress);
  const returnAction = readRecord(journey.return);
  const nextAction = readRecord(journey.nextAction);
  const current = journey.current === null ? null : readRecord(journey.current);
  const recovery = nextAction.recovery === null ? null : readRecord(nextAction.recovery);
  const state = nextAction.state;

  if (!isNonEmptyString(path.id) || !isNonEmptyString(path.title)) return null;
  if (!isNonEmptyString(goal.id)) return null;
  if (!isNonEmptyString(context.pathId) || !isNonEmptyString(context.goalId)) return null;
  if (context.pathId !== path.id || context.goalId !== goal.id) return null;
  if (context.requestedNodeId !== null && !isNonEmptyString(context.requestedNodeId)) return null;
  if (!Number.isInteger(progress.completed) || !Number.isInteger(progress.total)) return null;
  if ((progress.completed as number) < 0 || (progress.total as number) < (progress.completed as number)) return null;
  if (!isNonEmptyString(returnAction.label) || !canonicalizeAdaptivePathInternalHref(String(returnAction.href ?? ''))) return null;
  if (!isNonEmptyString(journey.pathStatus) || !isJourneyState(state)) return null;
  if (current && (!isNonEmptyString(current.nodeId) || !isNonEmptyString(current.title) || !isNonEmptyString(current.type))) {
    return null;
  }
  if (!isNonEmptyString(nextAction.title)) return null;
  if (!hasValidNextActionShape(state, nextAction, recovery)) return null;

  return journey as unknown as AuthorizedAdaptivePathJourney;
}

export function publishAdaptivePathJourneyResponse(value: unknown): boolean {
  const journey = parseAdaptivePathJourneyResponse(value);
  if (!journey || typeof window === 'undefined') return false;
  window.dispatchEvent(new CustomEvent(JOURNEY_UPDATED_EVENT, { detail: journey }));
  return true;
}

export function requestAdaptivePathJourneyRefresh(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(JOURNEY_REFRESH_REQUESTED_EVENT));
}

export function useAdaptivePathJourney(
  launchContext: AdaptivePathLaunchContext | null,
): AdaptivePathJourneyReadState & { refresh: () => void } {
  const requestIdRef = useRef(0);
  const requestControllerRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<AdaptivePathJourneyReadState>({
    status: launchContext ? 'loading' : 'idle',
    journey: null,
    error: null,
  });

  const refresh = useCallback(() => {
    requestControllerRef.current?.abort();
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    if (!launchContext) {
      setState({ status: 'idle', journey: null, error: null });
      return;
    }
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setState({ status: 'loading', journey: null, error: null });
    void fetch(buildAdaptivePathJourneyReadHref(launchContext), {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error('journey-read-rejected');
        const journey = parseAdaptivePathJourneyResponse(payload);
        if (!journey) throw new Error('journey-read-invalid');
        if (requestId !== requestIdRef.current) return;
        setState({ status: 'ready', journey, error: null });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (requestId !== requestIdRef.current) return;
        setState({
          status: 'error',
          journey: null,
          error: '路径进度暂时无法读取，请稍后刷新。',
        });
      });
  }, [launchContext]);

  useEffect(() => {
    if (!launchContext) {
      setState({ status: 'idle', journey: null, error: null });
      return;
    }
    refresh();
    return () => requestControllerRef.current?.abort();
  }, [launchContext, refresh]);

  useEffect(() => {
    if (!launchContext) return;
    const handleJourneyUpdate = (event: Event) => {
      const journey = parseAdaptivePathJourneyResponse({ journey: (event as CustomEvent<unknown>).detail });
      if (!journey || !matchesJourneyLaunchContext(journey, launchContext)) return;
      requestControllerRef.current?.abort();
      requestIdRef.current += 1;
      setState({ status: 'ready', journey, error: null });
    };
    window.addEventListener(JOURNEY_UPDATED_EVENT, handleJourneyUpdate);
    return () => window.removeEventListener(JOURNEY_UPDATED_EVENT, handleJourneyUpdate);
  }, [launchContext]);

  return { ...state, refresh };
}

export function AdaptivePathJourneyControl({
  launchContext,
  status,
  journey,
  error,
  onRefresh,
  className,
}: AdaptivePathJourneyControlProps) {
  const state = journey?.nextAction.state ?? (status === 'error' ? 'blocked' : 'pending-result');
  const returnAction = journey?.return ?? { label: '返回学习路径', href: launchContext.returnHref };

  return (
    <section
      aria-label="学习路径旅程"
      aria-live="polite"
      className={cn(
        'mb-4 rounded-lg border border-platform-border bg-platform-surface-raised px-4 py-3 shadow-sm',
        className,
      )}
      data-adaptive-path-journey-control={state}
      data-adaptive-path-journey-node={launchContext.nodeId}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-platform-fg-secondary">
            <Route className="h-4 w-4 text-platform-action-primary" aria-hidden="true" />
            <span className="font-medium text-platform-fg-primary">{journey?.path.title ?? '学习路径'}</span>
            {journey ? <span>{journey.progress.completed} / {journey.progress.total}</span> : null}
          </div>
          <p className="mt-1 text-sm text-platform-fg-secondary">
            {journey?.current ? `当前：${journey.current.title}` : '正在读取当前节点与路径进度'}
          </p>
          {status === 'loading' ? (
            <p className="mt-1 inline-flex items-center gap-2 text-xs text-platform-fg-tertiary">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              正在刷新路径状态
            </p>
          ) : error ? (
            <p className="mt-1 text-xs text-platform-evidence-context">{error}</p>
          ) : journey?.nextAction.reason ? (
            <p className="mt-1 text-xs text-platform-fg-tertiary">{journey.nextAction.reason}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            href={returnAction.href}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-platform-border px-3 text-sm font-medium text-platform-fg-primary hover:border-platform-border-strong"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {returnAction.label}
          </Link>
          {journey?.nextAction.state === 'ready' && journey.nextAction.href ? (
            <Link
              href={journey.nextAction.href}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-platform-action-primary px-3 text-sm font-medium text-platform-action-primary-fg"
              data-adaptive-path-next-action="ready"
            >
              {journey.nextAction.title}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : journey?.nextAction.state === 'path-complete' && journey.nextAction.href ? (
            <Link
              href={journey.nextAction.href}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-platform-action-primary px-3 text-sm font-medium text-platform-action-primary-fg"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {journey.nextAction.title}
            </Link>
          ) : journey?.nextAction.state === 'blocked' && journey.nextAction.recovery ? (
            <Link
              href={journey.nextAction.recovery.href}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-platform-border px-3 text-sm font-medium text-platform-fg-primary hover:border-platform-border-strong"
            >
              {journey.nextAction.recovery.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-platform-border px-3 text-sm font-medium text-platform-fg-primary hover:border-platform-border-strong"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {journey?.nextAction.recovery?.label ?? '刷新路径状态'}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export function AdaptivePathOwnedResourceAction({
  opened,
  completionAllowed,
  pending,
  onStart,
  onComplete,
}: AdaptivePathOwnedResourceActionProps) {
  if (!opened) {
    return (
      <button
        type="button"
        onClick={onStart}
        disabled={pending}
        className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
      >
        开始学习
      </button>
    );
  }
  if (!completionAllowed) {
    return (
      <span className="rounded-lg border border-border px-3 py-2 text-xs text-subtle">
        等待受治理完成证据
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onComplete}
      disabled={pending}
      className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
      data-adaptive-path-owned-resource-completion="available"
    >
      已学习该资料，继续路径
    </button>
  );
}

export function AdaptivePathJourneyControlFromRoute() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? '';
  const launchContext = useMemo(() => resolveJourneyRouteContext({
    pathname,
    search,
  }), [pathname, search]);
  const journeyState = useAdaptivePathJourney(launchContext);
  const refreshJourney = journeyState.refresh;

  useEffect(() => {
    if (!launchContext) return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshJourney();
    };
    window.addEventListener('focus', refreshJourney);
    window.addEventListener('pageshow', refreshJourney);
    window.addEventListener(JOURNEY_REFRESH_REQUESTED_EVENT, refreshJourney);
    window.addEventListener('arena:evaluation-complete', refreshJourney);
    window.addEventListener('simulation:trace-summary', refreshJourney);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener('focus', refreshJourney);
      window.removeEventListener('pageshow', refreshJourney);
      window.removeEventListener(JOURNEY_REFRESH_REQUESTED_EVENT, refreshJourney);
      window.removeEventListener('arena:evaluation-complete', refreshJourney);
      window.removeEventListener('simulation:trace-summary', refreshJourney);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [refreshJourney, launchContext]);

  if (!launchContext) return null;
  return (
    <AdaptivePathJourneyControl
      launchContext={launchContext}
      status={journeyState.status}
      journey={journeyState.journey}
      error={journeyState.error}
      onRefresh={journeyState.refresh}
    />
  );
}

function matchesJourneyLaunchContext(
  journey: AuthorizedAdaptivePathJourney,
  launchContext: AdaptivePathLaunchContext,
): boolean {
  if (journey.path.id !== launchContext.pathId || journey.goal.id !== launchContext.goalId) return false;
  const requestedNodeId = journey.context.requestedNodeId;
  if (requestedNodeId !== null) return requestedNodeId === launchContext.nodeId;
  return journey.current === null || journey.current.nodeId === launchContext.nodeId;
}

function resolveJourneyRouteContext(location: Pick<Location, 'pathname' | 'search'>): AdaptivePathLaunchContext | null {
  const params = new URLSearchParams(location.search);
  const launchedContext = resolveAdaptivePathLaunchReturnContext(params);
  if (launchedContext) return launchedContext;
  if (location.pathname !== '/assessment/adaptive-practice') return null;
  const goalId = params.get('goalId') ?? params.get('goal');
  const pathId = params.get('pathId');
  const nodeId = params.get('nodeId');
  if (!goalId || !pathId || !nodeId || params.get('intent') !== 'path-execution') return null;
  return buildAdaptivePathLaunchContext({
    goalId,
    pathId,
    nodeId,
    routeIntent: 'path-execution',
    resourceType: params.get('resourceType') ?? 'path-center',
  });
}

function isJourneyState(value: unknown): value is AdaptivePathJourneyNextActionState {
  return value === 'ready' || value === 'blocked' || value === 'pending-result' || value === 'path-complete';
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasValidNextActionShape(
  state: AdaptivePathJourneyNextActionState,
  nextAction: Record<string, unknown>,
  recovery: Record<string, unknown> | null,
): boolean {
  if (state === 'ready') {
    return isNonEmptyString(nextAction.nodeId) &&
      isNonEmptyString(nextAction.type) &&
      Boolean(canonicalizeAdaptivePathInternalHref(String(nextAction.href ?? ''))) &&
      nextAction.reason === null &&
      nextAction.recovery === null;
  }
  if (state === 'path-complete') {
    return nextAction.nodeId === null &&
      nextAction.type === null &&
      Boolean(canonicalizeAdaptivePathInternalHref(String(nextAction.href ?? ''))) &&
      nextAction.reason === null &&
      nextAction.recovery === null;
  }
  const hasNodeIdentity = nextAction.nodeId === null && nextAction.type === null ||
    isNonEmptyString(nextAction.nodeId) && isNonEmptyString(nextAction.type);
  return hasNodeIdentity &&
    nextAction.href === null &&
    isNonEmptyString(nextAction.reason) &&
    Boolean(recovery) &&
    isNonEmptyString(recovery?.label) &&
    Boolean(canonicalizeAdaptivePathInternalHref(String(recovery?.href ?? '')));
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
