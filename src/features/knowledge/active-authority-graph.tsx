'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MutableRefObject, useCallback } from 'react';
import Image from 'next/image';
import {
  AlertTriangle,
  ChevronDown,
  CircleHelp,
  Loader2,
  Network,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';

import {
  ACTIVE_RESOURCE_BINDING_ROLES,
  type ActiveNodeDetailResponse,
} from './active-authority-graph-contracts';
import 'katex/dist/katex.min.css';
import { GovernedBlockMath, GovernedRichText, GovernedUnavailableMath } from '@/components/shared/governed-rich-text';
import {
  GOVERNED_KATEX_MACRO_PROFILE_HASH,
  GOVERNED_KATEX_MACRO_PROFILE_ID,
} from '@/lib/governed-math';
import {
  activeModelRelationSummaries,
  activeNodeRelationSummaries,
  createActiveAuthorityGraphModel,
  expandActiveAuthorityOneHop,
  knownActiveNodeTypes,
  materializeActiveNodeScope,
  presentActiveNodeType,
  presentActiveRelation,
  presentActiveHumanText,
  presentGovernanceLabel,
  presentSourceCitation,
  isPrimaryDomainObject,
  selectAuthorityDomainOverviewScope,
  selectInitialPrimaryDomainScope,
  visibleActiveGraph,
  ACTIVE_GRAPH_NODE_LIMIT,
  type ActiveAuthorityGraphModel,
  type ActiveNodePresentation,
} from './active-authority-presentation';
import {
  createEmptyAuthorityShardWorkspace,
  disableAuthorityShardFamily,
  enableAuthorityShardFamily,
  invalidateTeachingBearingShards,
  isTeachingBearingShard,
  mergeAuthorityShard,
  completeAuthorityLocaleRefresh,
  resetAuthorityShardDomain,
  shardIdentityDrift,
  visibleAuthorityShardRelations,
  type AuthorityShardWorkspaceState,
  type IncomingAuthorityShard,
} from './active-authority-shard-store';
import { ActiveAuthorityRuntimeView } from './active-authority-runtime-view';
import { crossDomainNodeId } from './graph/cross-domain-cluster';
import { ActiveAuthorityFilterPanel } from './active-authority-filter-panel';
import { GovernedFormulaLabel } from './graph/semantic-label-layer';
import { KnowledgeWorkspaceChromePortal } from './graph/knowledge-workspace-chrome';
import { useKnowledgeGraphRuntimeLayout } from './graph/use-knowledge-graph-runtime-layout';
import { KNOWLEDGE_GRAPH_COMPACT_MAX_WIDTH } from './graph/viewport-fit';
import {
  createAuthorityGraphViewModel,
  defaultEnabledTeachingFamilies,
} from './authority-graph-view-model';
import {
  openResourceViewer,
  UniversalResourceViewerHost,
} from './universal-resource-viewer';
import type { GraphDimension } from './graph-runtime-session';
import {
  AUTHORITY_DOMAIN_SEARCH_CONTRACT,
  type AuthorityShardPublicEnvelope,
  type AuthorityShardMembership,
  type AuthorityDomainSearchHit,
  type EngineeringRelationFamily,
} from '@/lib/authority-domain-shards/contracts';
import { REGISTERED_PEER_DOMAIN_IDS } from '@/lib/authority-domain-catalog/contracts';
import {
  isPublicAuthorityLearnerShard,
  publicEnvelopesShareAuthorityAndCatalog,
  publicEnvelopesShareLocaleProfile,
  publicTeachingIdentityMatches,
} from '@/lib/authority-domain-shards/envelope';
import type { AdmittedLocale } from '@/lib/authority-locale-readiness/contracts';
import {
  createGraphLanguageState,
  projectOptionalContentForLocale,
  selectGraphLanguage,
} from '@/lib/authority-locale-readiness/presentation-state';
import {
  formatLoadMore,
  formatLoadMoreAria,
  formatUnpinAllAria,
  formatSearchShownCount,
  graphCopy,
  shardUrl,
  totalCoverageCopy,
  visibleCoverageCopy,
} from './active-authority-graph-i18n';
interface ActiveAuthorityGraphProps {
  viewerRole: 'student' | 'teacher' | 'admin' | 'audit';
  dimension?: GraphDimension;
  onDimensionChange?: (dimension: GraphDimension) => void;
  onActiveDomainChange?: (domainId: string | null) => void;
  onShowLegacy?: () => void;
  returnToRootRef?: MutableRefObject<(() => void) | null>;
  chromeHostRef?: { current: HTMLElement | null };
  runtimeControlsRef?: { current: {
    requestFitView: (target?: 'current' | 'root' | 'teaching-layout') => void;
    requestRelayout: () => void;
    requestUnpin: (nodeId?: string) => void;
  } | null };
}

type WorkspaceLoadState =
  | { status: 'loading' }
  | { status: 'ready'; workspace: AuthorityShardWorkspaceState }
  | { status: 'error'; message: string; unauthenticated?: boolean; contentNotReady?: boolean };

/** 次级分片失败条目：内容未就绪类失败不提供重试（重试必然复现同一缺失）。 */
interface ShardFailureEntry {
  message: string;
  retryable: boolean;
}

/** Keep an in-domain selection stable; otherwise choose the reviewed owner deterministically. */
export function selectActiveAuthorityMembership(
  memberships: readonly AuthorityShardMembership[],
  activeDomainId?: string | null,
): AuthorityShardMembership | null {
  const ordered = [...memberships].sort((left, right) => (
    (REGISTERED_PEER_DOMAIN_IDS as readonly string[]).indexOf(left.domainId)
    - (REGISTERED_PEER_DOMAIN_IDS as readonly string[]).indexOf(right.domainId)
    || left.domainId.localeCompare(right.domainId)
    || left.visualRole.localeCompare(right.visualRole)
  ));
  return ordered.find((membership) => membership.domainId === activeDomainId)
    ?? ordered.find((membership) => membership.preferred)
    ?? ordered[0]
    ?? null;
}

function errorMessage(status: number, locale: AdmittedLocale = 'zh-CN'): string {
  if (status === 401) return graphCopy(locale, 'error.login');
  if (status === 403) return graphCopy(locale, 'error.forbidden');
  if (status === 409) return graphCopy(locale, 'error.identityDrift');
  return graphCopy(locale, 'error.generic');
}

class AuthorityShardFetchError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, code: string | null = null) {
    super(errorMessage(status));
    this.name = 'AuthorityShardFetchError';
    this.status = status;
    this.code = code;
  }
}

function isIdentityFailure(error: unknown): boolean {
  return error instanceof AuthorityShardFetchError && error.status === 409;
}

function isUnauthenticatedError(error: unknown): boolean {
  return error instanceof AuthorityShardFetchError && error.status === 401;
}

// 内容未就绪类失败码（#1942）：分片/分片集/指针/激活缺失或消费者未就绪，
// 属于「发布未完成」而非暂时故障。身份失配（MISMATCH/TAMPER）不匹配此模式。
const CONTENT_NOT_READY_CODE = /(?:ABSENT|NOT_READY)/u;

export function isContentNotReadyFailure(error: unknown): boolean {
  return error instanceof AuthorityShardFetchError
    && error.code !== null
    && CONTENT_NOT_READY_CODE.test(error.code);
}

function shardErrorState(
  error: unknown,
  locale: AdmittedLocale,
  fallbackKey: 'error.generic' | 'error.domainShard' = 'error.generic',
): WorkspaceLoadState {
  const contentNotReady = isContentNotReadyFailure(error);
  return {
    status: 'error',
    message: contentNotReady
      ? graphCopy(locale, 'error.contentNotReady')
      : error instanceof AuthorityShardFetchError
        ? errorMessage(error.status, locale)
        : error instanceof Error ? error.message : graphCopy(locale, fallbackKey),
    contentNotReady,
    unauthenticated: isUnauthenticatedError(error) || undefined,
  };
}

function shardFailureEntry(
  error: unknown,
  locale: AdmittedLocale,
  fallbackKey: 'error.familyShard' | 'error.neighborhoodShard',
): ShardFailureEntry {
  const contentNotReady = isContentNotReadyFailure(error);
  return {
    message: contentNotReady
      ? graphCopy(locale, 'error.contentNotReady')
      : error instanceof Error ? error.message : graphCopy(locale, fallbackKey),
    retryable: !contentNotReady,
  };
}

function isShardClass<T extends IncomingAuthorityShard['shardClass']>(
  value: unknown,
  shardClass: T,
): value is Extract<IncomingAuthorityShard, { shardClass: T }> {
  return isPublicAuthorityLearnerShard(value) && value.shardClass === shardClass;
}

async function readShardErrorCode(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object' && typeof (body as { code?: unknown }).code === 'string') {
      return (body as { code: string }).code;
    }
  } catch {
    // 非 JSON 错误体（网关/代理错误页）没有失败码，按暂时故障处理。
  }
  return null;
}

async function fetchAuthorityShard(
  url: string,
  shardClass: IncomingAuthorityShard['shardClass'],
  signal: AbortSignal,
): Promise<IncomingAuthorityShard> {
  const response = await fetch(url, { signal, headers: { accept: 'application/json' } });
  if (!response.ok) {
    throw new AuthorityShardFetchError(response.status, await readShardErrorCode(response));
  }
  const payload: unknown = await response.json();
  if (!isShardClass(payload, shardClass)) {
    throw new Error('当前知识图谱响应身份校验失败，已停止显示。');
  }
  return payload as IncomingAuthorityShard;
}

function useActiveAuthorityWorkspace(
  retry: number,
  requestedLocale: AdmittedLocale,
  onLocaleTransactionFailure?: (previousLocale: AdmittedLocale) => void,
  onLocaleTransactionSuccess?: (nextLocale: AdmittedLocale) => void,
): {
  state: WorkspaceLoadState;
  workspace: AuthorityShardWorkspaceState;
  enterDomain: (visualRole: string) => Promise<boolean>;
  enableFamily: (family: EngineeringRelationFamily) => void;
  disableFamily: (family: EngineeringRelationFamily) => void;
  familyFailures: Partial<Record<EngineeringRelationFamily, ShardFailureEntry>>;
  requestNeighborhood: (nodeId: string) => void;
  neighborhoodFailures: Record<string, ShardFailureEntry>;
  localeRefreshFailure: string | null;
  resetDomain: () => void;
  applyShard: (shard: IncomingAuthorityShard, generation?: number, domainRevision?: number) => boolean;
  onIdentityFailure: () => void;
} {
  const [state, setState] = useState<WorkspaceLoadState>({ status: 'loading' });
  const [workspace, setWorkspace] = useState<AuthorityShardWorkspaceState>(createEmptyAuthorityShardWorkspace);
  const [familyFailures, setFamilyFailures] = useState<Partial<Record<EngineeringRelationFamily, ShardFailureEntry>>>({});
  const [neighborhoodFailures, setNeighborhoodFailures] = useState<Record<string, ShardFailureEntry>>({});
  const [localeRefreshFailure, setLocaleRefreshFailure] = useState<string | null>(null);
  const workspaceRef = useRef(workspace);
  const requestGenerationRef = useRef(0);
  const requestControllersRef = useRef(new Set<AbortController>());
  const failClosedRef = useRef(false);
  const localeRef = useRef<AdmittedLocale>(workspace.selectedLocale);
  localeRef.current = workspace.selectedLocale;
  workspaceRef.current = workspace;

  function updateWorkspace(
    update: (current: AuthorityShardWorkspaceState) => AuthorityShardWorkspaceState,
  ): AuthorityShardWorkspaceState {
    const next = update(workspaceRef.current);
    // Requests may resolve before React commits the state update. Keep the
    // request coordinator on the same snapshot so a just-accepted Teaching
    // identity cannot be mistaken for another version change.
    workspaceRef.current = next;
    setWorkspace(next);
    return next;
  }

  function nextRequestGeneration(): number {
    requestGenerationRef.current += 1;
    for (const controller of requestControllersRef.current) controller.abort();
    requestControllersRef.current.clear();
    return requestGenerationRef.current;
  }

  function onIdentityFailure(): void {
    failClosedRef.current = true;
    nextRequestGeneration();
    const empty = createEmptyAuthorityShardWorkspace();
    workspaceRef.current = empty;
    setWorkspace(empty);
    setFamilyFailures({});
    setNeighborhoodFailures({});
    setState({ status: 'error', message: errorMessage(409, localeRef.current) });
  }

  function fetchDomainDefault(visualRole: string, generation: number, domainRevision: number): Promise<boolean> {
    const controller = new AbortController();
    requestControllersRef.current.add(controller);
    return fetchAuthorityShard(
      shardUrl(`/api/knowledge/shards/active/domains/${encodeURIComponent(visualRole)}`, localeRef.current),
      'domain-default',
      controller.signal,
    )
      .then((shard) => applyShard(shard, generation, domainRevision))
      .catch((error: unknown) => {
        if (controller.signal.aborted || generation !== requestGenerationRef.current) return false;
        if (isIdentityFailure(error)) {
          onIdentityFailure();
          return false;
        }
        setState(shardErrorState(error, localeRef.current, 'error.domainShard'));
        return false;
      })
      .finally(() => {
        requestControllersRef.current.delete(controller);
      });
  }

  function applyShard(shard: IncomingAuthorityShard, generation?: number, domainRevision?: number): boolean {
    if (failClosedRef.current) return false;
    if (domainRevision !== undefined && domainRevision !== workspaceRef.current.domainRevision) {
      return false;
    }
    if (generation !== undefined && generation !== requestGenerationRef.current) {
      return false;
    }

    const previous = workspaceRef.current;
    const drift = shardIdentityDrift(previous, shard);
    if (drift === 'authority-catalog') {
      // Authority/catalog drift invalidates every request in the current
      // generation.  Do not recover from the mismatching response: a fresh
      // root request must be explicitly started by the user.
      onIdentityFailure();
      return false;
    }
    const identityChanged = drift === 'teaching';
    const refreshVisualRole = identityChanged
      ? previous.activeVisualRole
        ?? (shard.shardClass === 'domain-default' ? shard.visualRole : null)
      : null;

    const next = updateWorkspace((current) => {
      const invalidated = identityChanged
        && current.envelope
        ? invalidateTeachingBearingShards(current, shard.envelope)
        : current;
      return mergeAuthorityShard(invalidated, shard);
    });
    setState({ status: 'ready', workspace: next });

    // A root/domain response is itself the signal that the live Teaching
    // identity changed.  Re-read the active domain once, under a newer
    // generation, so an old in-flight response cannot restore stale edges.
    if (refreshVisualRole) {
      const refreshGeneration = nextRequestGeneration();
      fetchDomainDefault(refreshVisualRole, refreshGeneration, workspaceRef.current.domainRevision);
    }
    return true;
  }

  // Root loading is deliberately retried only through `retry`; its helpers
  // coordinate the latest workspace and request generation through refs.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const controller = new AbortController();
    const requestControllers = requestControllersRef.current;
    const generation = nextRequestGeneration();
    failClosedRef.current = false;
    requestControllers.add(controller);
    setState({ status: 'loading' });
    setFamilyFailures({});
    setNeighborhoodFailures({});
    updateWorkspace(() => createEmptyAuthorityShardWorkspace());
    fetchAuthorityShard(shardUrl('/api/knowledge/shards/active', localeRef.current), 'root', controller.signal)
      .then((shard) => {
        applyShard(shard, generation);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (isIdentityFailure(error)) {
          onIdentityFailure();
          return;
        }
        setState(shardErrorState(error, localeRef.current));
      });
    return () => {
      controller.abort();
      requestControllers.delete(controller);
      nextRequestGeneration();
    };
    // Root reload is keyed only by retry. applyShard/onIdentityFailure close
    // over the current request generation and must not retrigger the fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retry]);
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    const current = workspaceRef.current;
    if (state.status !== 'ready' || !current.envelope) return;
    if (current.selectedLocale === requestedLocale) return;
    const visualRole = current.activeVisualRole;
    const families = [...current.enabledFamilies];
    const selectedId = current.selectedCanonicalId;
    const loadedNodeIds = [...new Set([
      ...current.loadedShardKeys
        .filter((key) => key.startsWith('node-neighborhood:') || key.startsWith('node-detail:'))
        .map((key) => key.slice(key.indexOf(':') + 1)),
      ...selectedId ? [selectedId] : [],
    ])];
    const previousLocale = current.selectedLocale;
    setLocaleRefreshFailure(null);
    const generation = nextRequestGeneration();
    const domainRevision = current.domainRevision;
    const controller = new AbortController();
    const requestControllers = requestControllersRef.current;
    requestControllers.add(controller);

    function abortLocaleRefresh(): void {
      onLocaleTransactionFailure?.(previousLocale);
      setLocaleRefreshFailure(graphCopy(previousLocale, 'error.generic'));
    }

    // 事务性 locale 刷新（#1741）：一次代内并行取回当前已加载的全部逻辑
    // 分片，全部成功后同一批提交——中途失败或代过期则整体丢弃并回滚到
    // 旧 locale 完整帧，绝不出现混合语言帧。
    type ShardPlan = { url: string; kind: Parameters<typeof fetchAuthorityShard>[1] };
    const plan: ShardPlan[] = [
      { url: shardUrl('/api/knowledge/shards/active', requestedLocale), kind: 'root' },
      ...(visualRole ? [{
        url: shardUrl(`/api/knowledge/shards/active/domains/${encodeURIComponent(visualRole)}`, requestedLocale),
        kind: 'domain-default' as const,
      }] : []),
      ...(visualRole ? families.map((family) => ({
        url: shardUrl(`/api/knowledge/shards/active/domains/${encodeURIComponent(visualRole)}/families/${encodeURIComponent(family)}`, requestedLocale),
        kind: 'relation-family' as const,
      })) : []),
      ...loadedNodeIds.flatMap((nodeId): ShardPlan[] => [
        {
          url: shardUrl(`/api/knowledge/shards/active/neighborhoods/${encodeURIComponent(nodeId)}`, requestedLocale),
          kind: 'node-neighborhood',
        },
        {
          url: shardUrl(`/api/knowledge/shards/active/nodes/${encodeURIComponent(nodeId)}`, requestedLocale),
          kind: 'node-detail',
        },
      ]),
    ];
    const CONCURRENCY = 4;
    const results: IncomingAuthorityShard[] = [];
    let failed = false;
    let cursor = 0;
    async function worker(): Promise<void> {
      while (cursor < plan.length && !failed && !controller.signal.aborted) {
        const item = plan[cursor++]!;
        const shard = await fetchAuthorityShard(item.url, item.kind, controller.signal);
        results.push(shard);
      }
    }
    void (async () => {
      try {
        await Promise.all(Array.from({ length: Math.min(CONCURRENCY, plan.length) }, () => worker()));
        if (controller.signal.aborted || generation !== requestGenerationRef.current) return;
        // 原子提交：在本地快照上串行 merge 全部响应，任何漂移即整体放弃；
        // 只有一次 setState 把完整的新 locale 帧写入工作区（#1741）。
        let next = workspaceRef.current;
        const targetEnvelope = results[0]?.envelope;
        if (!targetEnvelope) {
          abortLocaleRefresh();
          return;
        }
        for (const shard of results) {
          const catalogDrift = shardIdentityDrift(next, shard) === 'authority-catalog';
          const localeDrift = !publicEnvelopesShareLocaleProfile(targetEnvelope, shard.envelope);
          const teachingDrift = isTeachingBearingShard(shard)
            && !publicTeachingIdentityMatches(targetEnvelope, shard.envelope);
          if (catalogDrift || localeDrift || teachingDrift) {
            abortLocaleRefresh();
            return;
          }
          if (generation !== requestGenerationRef.current || controller.signal.aborted) return;
          next = mergeAuthorityShard(next, shard);
        }
        next = {
          ...completeAuthorityLocaleRefresh(next),
          selectedLocale: requestedLocale,
        };
        if (generation === requestGenerationRef.current) {
          updateWorkspace(() => next);
          setState({ status: 'ready', workspace: next });
          onLocaleTransactionSuccess?.(requestedLocale);
        }
      } catch {
        if (controller.signal.aborted) return;
        // HTTP 409 与其它 shard 失败同属“切换失败”：保留旧 locale 完整帧，
        // 回滚 selectedLocale 与外层 locale。不得走 onIdentityFailure() 清空图。
        abortLocaleRefresh();
      } finally {
        requestControllers.delete(controller);
      }
    })();
    return () => {
      controller.abort();
      requestControllers.delete(controller);
    };
    // Locale changes refresh display only; retry remains the identity reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedLocale, state.status]);

  function enterDomain(visualRole: string): Promise<boolean> {
    const current = workspaceRef.current;
    if (current.activeVisualRole === visualRole && current.activeDomainId) {
      return Promise.resolve(true);
    }
    if (current.activeDomainId) {
      nextRequestGeneration();
      updateWorkspace(resetAuthorityShardDomain);
    }
    updateWorkspace((workspace) => ({
      ...workspace,
      activeVisualRole: visualRole,
    }));
    setFamilyFailures({});
    setNeighborhoodFailures({});
    const generation = nextRequestGeneration();
    return fetchDomainDefault(visualRole, generation, workspaceRef.current.domainRevision);
  }

  function disableFamily(family: EngineeringRelationFamily) {
    updateWorkspace((workspace) => disableAuthorityShardFamily(workspace, family));
  }

  function enableFamily(family: EngineeringRelationFamily) {
    const current = workspaceRef.current;
    const domainId = current.activeDomainId;
    const visualRole = current.activeVisualRole;
    const domainRevision = current.domainRevision;
    setFamilyFailures((currentFailures) => {
      if (!currentFailures[family]) return currentFailures;
      const next = { ...currentFailures };
      delete next[family];
      return next;
    });
    updateWorkspace((workspace) => enableAuthorityShardFamily(workspace, family));
    if (!domainId || !visualRole) return;
    const key = `relation-family:${domainId}:${family}`;
    const envelope = workspaceRef.current.envelope;
    const displayKey = envelope ? `${envelope.localeProfileVersion}:${key}` : key;
    if (workspaceRef.current.loadedDisplayKeys.includes(displayKey)) return;
    const generation = requestGenerationRef.current;
    const controller = new AbortController();
    requestControllersRef.current.add(controller);
    fetchAuthorityShard(
      shardUrl(`/api/knowledge/shards/active/domains/${encodeURIComponent(visualRole)}/families/${encodeURIComponent(family)}`, localeRef.current),
      'relation-family',
      controller.signal,
      )
      .then((shard) => {
        const applied = applyShard(shard, generation, domainRevision);
        if (applied) {
          setFamilyFailures((currentFailures) => {
            if (!currentFailures[family]) return currentFailures;
            const next = { ...currentFailures };
            delete next[family];
            return next;
          });
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || generation !== requestGenerationRef.current) return;
        if (isIdentityFailure(error)) {
          onIdentityFailure();
          return;
        }
        updateWorkspace((current) => ({
          ...current,
          enabledFamilies: current.enabledFamilies.filter((enabledFamily) => enabledFamily !== family),
        }));
        setFamilyFailures((currentFailures) => ({
          ...currentFailures,
          [family]: shardFailureEntry(error, localeRef.current, 'error.familyShard'),
        }));
      })
      .finally(() => requestControllersRef.current.delete(controller));
  }

  function requestNeighborhood(nodeId: string) {
    const key = `node-neighborhood:${nodeId}`;
    const envelope = workspaceRef.current.envelope;
    const displayKey = envelope ? `${envelope.localeProfileVersion}:${key}` : key;
    if (workspaceRef.current.loadedDisplayKeys.includes(displayKey)) return;
    const domainRevision = workspaceRef.current.domainRevision;
    const generation = requestGenerationRef.current;
    setNeighborhoodFailures((currentFailures) => {
      if (!currentFailures[nodeId]) return currentFailures;
      const next = { ...currentFailures };
      delete next[nodeId];
      return next;
    });
    const controller = new AbortController();
    requestControllersRef.current.add(controller);
    fetchAuthorityShard(
      shardUrl(`/api/knowledge/shards/active/neighborhoods/${encodeURIComponent(nodeId)}`, localeRef.current),
      'node-neighborhood',
      controller.signal,
      )
      .then((shard) => {
        const applied = applyShard(shard, generation, domainRevision);
        if (applied) {
          setNeighborhoodFailures((currentFailures) => {
            if (!currentFailures[nodeId]) return currentFailures;
            const next = { ...currentFailures };
            delete next[nodeId];
            return next;
          });
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || generation !== requestGenerationRef.current) return;
        if (isIdentityFailure(error)) {
          onIdentityFailure();
          return;
        }
        setNeighborhoodFailures((currentFailures) => ({
          ...currentFailures,
          [nodeId]: shardFailureEntry(error, localeRef.current, 'error.neighborhoodShard'),
        }));
      })
      .finally(() => requestControllersRef.current.delete(controller));
  }

  function resetDomain() {
    nextRequestGeneration();
    updateWorkspace(resetAuthorityShardDomain);
    setFamilyFailures({});
    setNeighborhoodFailures({});
  }

  return {
    state,
    workspace,
    enterDomain,
    enableFamily,
    disableFamily,
    familyFailures,
    requestNeighborhood,
    neighborhoodFailures,
    localeRefreshFailure,
    resetDomain,
    applyShard,
    onIdentityFailure,
  };
}

function useActiveNodeDetail(
  nodeId: string | null,
  expectedEnvelope: AuthorityShardPublicEnvelope | null,
  onShard?: (shard: IncomingAuthorityShard) => boolean,
  onIdentityFailure?: () => void,
  locale: AdmittedLocale = 'zh-CN',
): {
  detail: ActiveNodeDetailResponse | null;
  failure: string | null;
  loading: boolean;
} {
  const [detail, setDetail] = useState<ActiveNodeDetailResponse | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const onShardRef = useRef(onShard);
  onShardRef.current = onShard;
  const onIdentityFailureRef = useRef(onIdentityFailure);
  onIdentityFailureRef.current = onIdentityFailure;

  useEffect(() => {
    if (!nodeId || !expectedEnvelope) {
      setDetail(null);
      setFailure(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setDetail(null);
    setFailure(null);
    setLoading(true);
    fetch(shardUrl(`/api/knowledge/shards/active/nodes/${encodeURIComponent(nodeId)}`, locale), {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    })
      .then(async (response) => {
        if (!response.ok) {
          if (!controller.signal.aborted && response.status === 409) onIdentityFailureRef.current?.();
          throw new AuthorityShardFetchError(response.status, await readShardErrorCode(response));
        }
        const candidate: unknown = await response.json();
        if (!isShardClass(candidate, 'node-detail')) {
          throw new Error(graphCopy(locale, 'error.detail'));
        }
        const shard = candidate;
        if (onShardRef.current && !onShardRef.current(shard)) {
          throw new Error('当前知识图谱身份发生漂移，已停止显示。');
        }
        if (!publicEnvelopesShareAuthorityAndCatalog(expectedEnvelope, shard.envelope)) {
          throw new Error('节点详情身份校验失败，已停止显示。');
        }
        const node = {
          ...shard.node,
          adjacency: [],
        } as ActiveNodeDetailResponse['node'] & { media?: unknown };
        return {
          projectionVersion: 'act.node-detail.v2',
          source: {
            authorityState: 'active',
            releaseSetId: '',
            releaseId: '',
            productionAuthoritative: false,
            historical: false,
            projectionDigest: null,
          },
          role: 'STUDENT',
          fields: { included: ['node.id'], hidden: ['node.payload'] },
          node: {
            ...node,
            adjacency: Array.isArray(node.adjacency) ? node.adjacency : [],
            sources: Array.isArray(node.sources) ? node.sources : [],
            semanticSupport: node.semanticSupport ?? { supported: true, readOnly: true as const },
          },
          provenance: {
            authority: {
              consumerId: 'engineering-graph',
              snapshotId: '',
              snapshotHash: '',
              releaseId: '',
              releaseSetId: '',
            },
            activation: { mode: 'use-combination', status: 'READY', activationId: '', activationHash: '' },
            projection: { status: 'not-applicable', projectionId: null, projectionHash: null },
          },
        } satisfies ActiveNodeDetailResponse;
      })
      .then(setDetail)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setFailure(
            isContentNotReadyFailure(error)
              ? graphCopy(locale, 'error.contentNotReady')
              : error instanceof Error ? error.message : '节点详情暂时无法加载。',
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [nodeId, expectedEnvelope, locale]);

  return { detail, failure, loading };
}

const ACTIVE_MOBILE_NODE_LIMIT = 6;
const SEARCH_RESULT_PAGE_SIZE = 12;
function trapInspectorFocus(event: KeyboardEvent<HTMLElement>, root: HTMLElement | null) {
  if (event.key !== 'Tab' || !root) return;
  const focusable = [...root.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
  )].filter((element) => element.tabIndex !== -1 && !element.hasAttribute('disabled'));
  if (focusable.length === 0) {
    event.preventDefault();
    root.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !root.contains(active))) {
    event.preventDefault();
    last.focus();
    return;
  }
  if (!event.shiftKey && (active === last || !root.contains(active))) {
    event.preventDefault();
    first.focus();
  }
}

function ActiveNodeDetail({
  nodeKey,
  fallbackNode,
  model,
  envelope,
  onShard,
  onIdentityFailure,
  onClose,
  compact,
  onActivateNeighbor,
  locale,
  pinned = false,
  onUnpin,
}: {
  nodeKey: string;
  fallbackNode: ActiveNodePresentation | undefined;
  model: ActiveAuthorityGraphModel;
  envelope: AuthorityShardPublicEnvelope | null;
  onShard: (shard: IncomingAuthorityShard) => boolean;
  onIdentityFailure: () => void;
  onClose: () => void;
  compact: boolean;
  onActivateNeighbor: (key: string) => void;
  locale: AdmittedLocale;
  pinned?: boolean;
  onUnpin?: () => void;
}) {
  const { detail, failure, loading } = useActiveNodeDetail(nodeKey, envelope, onShard, onIdentityFailure, locale);
  const panelRef = useRef<HTMLElement>(null);
  const [infographFailed, setInfographFailed] = useState(false);
  useEffect(() => {
    panelRef.current?.focus();
  }, [nodeKey]);
  useEffect(() => {
    setInfographFailed(false);
  }, [nodeKey, detail?.node.learningContent?.infograph.state]);
  const node = detail?.node;
  const type = presentActiveNodeType(
    node?.canonicalType ?? fallbackNode?.type.canonicalType ?? '',
    node?.typeLabel ?? fallbackNode?.type.label,
  );
  const summaries = node && node.adjacency.length > 0
    ? activeNodeRelationSummaries(node, model)
    : activeModelRelationSummaries(model, nodeKey);
  const detailLabel = presentActiveHumanText(
    node && node.label !== nodeKey ? node.label : fallbackNode?.label,
    graphCopy(locale, 'inspector.nameUnavailable'),
  );
  const cardProjection = projectOptionalContentForLocale({
    availableLocales: ['zh-CN'],
    bodyLocale: 'zh-CN',
    selectedLocale: locale,
  });
  const infographProjection = projectOptionalContentForLocale({
    availableLocales: ['zh-CN'],
    bodyLocale: 'zh-CN',
    selectedLocale: locale,
  });
  return (
    <aside
      ref={panelRef}
      tabIndex={-1}
      role={compact ? 'dialog' : 'complementary'}
      aria-modal={compact ? true : undefined}
      onKeyDown={compact ? (event) => trapInspectorFocus(event, panelRef.current) : undefined}
      className={compact
        ? 'absolute inset-x-3 bottom-3 z-20 max-h-[70%] overflow-y-auto rounded-xl border border-platform-border bg-platform-surface/95 p-4 shadow-2xl outline-none'
        : 'absolute inset-y-3 right-3 z-20 w-[min(27rem,calc(100%-1.5rem))] overflow-y-auto rounded-xl border border-platform-border bg-platform-surface/95 p-4 shadow-2xl outline-none'}
      aria-label={graphCopy(locale, 'inspector.label')}
      data-active-node-detail={nodeKey}
      data-active-inspector-surface={compact ? 'mobile-drawer' : 'desktop-overlay'}
      data-active-inspector-focus-contract={compact ? 'mobile-contained-drawer' : 'desktop-overlay'}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-platform-fg-muted">{graphCopy(locale, 'inspector.label')}</div>
          <div className="mt-1 text-sm text-platform-fg-secondary">{graphCopy(locale, 'inspector.subtitle')}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {pinned && onUnpin ? (
            <button
              type="button"
              onClick={onUnpin}
              data-active-authority-unpin={nodeKey}
              aria-label={graphCopy(locale, 'controls.unpinAria')}
              className="rounded-md border border-platform-border px-2 py-2 text-xs text-platform-fg-secondary hover:bg-platform-action-subtle"
            >
              {graphCopy(locale, 'controls.unpin')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label={graphCopy(locale, 'inspector.close')}
            className="rounded-md border border-platform-border p-2 text-platform-fg-secondary hover:bg-platform-action-subtle"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="mt-8 flex items-center gap-2 text-sm text-platform-fg-secondary" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {graphCopy(locale, 'loading.detail')}
        </div>
      ) : failure ? (
        <div className="mt-6 rounded-lg border border-red-400/35 bg-red-400/10 p-3 text-sm text-red-100" role="alert">
          {failure}
        </div>
      ) : detail ? (
        <div className="mt-5 space-y-5">
          <div>
            <div className="text-lg font-semibold text-platform-fg-primary">
              {node?.richTitle
                ? <GovernedRichText projection={node.richTitle} density="detail" />
                : detailLabel}
            </div>
            <div className="mt-1 text-xs text-platform-fg-muted">{type.label}</div>
            <div className="mt-3 text-sm leading-6 text-platform-fg-secondary">
              {node?.richDescription
                ? <GovernedRichText projection={node.richDescription} density="detail" />
                : presentActiveHumanText(node?.description ?? fallbackNode?.description, graphCopy(locale, 'inspector.noDescription'))}
            </div>
            {node?.aliases && node.aliases.length > 0 ? (
              <p className="mt-2 text-xs text-platform-fg-muted">{graphCopy(locale, 'inspector.aliases')}{node.aliases.join('、')}</p>
            ) : null}
            {node?.mathematics?.state === 'available' ? (
              <div className="mt-3 overflow-x-auto text-platform-fg-primary" data-active-inspector-math="true">
                {node.mathematics.macroProfileId && node.mathematics.macroProfileHash ? (
                  <GovernedBlockMath
                    latex={node.mathematics.expression}
                    macroProfileId={node.mathematics.macroProfileId}
                    macroProfileHash={node.mathematics.macroProfileHash}
                    accessibleLabel={node.mathematics.accessibleLabel ?? node.mathematics.expression}
                    copyLatex={node.mathematics.copyLatex ?? node.mathematics.expression}
                    display={node.mathematics.display}
                  />
                ) : (
                  <GovernedBlockMath
                    latex={node.mathematics.expression}
                    macroProfileId={GOVERNED_KATEX_MACRO_PROFILE_ID}
                    macroProfileHash={GOVERNED_KATEX_MACRO_PROFILE_HASH}
                    accessibleLabel={node.mathematics.accessibleLabel ?? node.mathematics.expression}
                    copyLatex={node.mathematics.copyLatex ?? node.mathematics.expression}
                    display={node.mathematics.display}
                  />
                )}
              </div>
            ) : node?.mathematics?.state === 'unavailable' ? (
              <GovernedUnavailableMath message={node.mathematics.message} />
            ) : null}
          </div>
          {node?.learningContent?.card.state === 'available' && cardProjection.visibility === 'render' ? (
            <section aria-labelledby="active-detail-card" className="rounded-lg border border-platform-border bg-platform-canvas-muted p-3">
              <h3 id="active-detail-card" className="text-sm font-semibold text-platform-fg-primary">{graphCopy(locale, 'inspector.card')}</h3>
              <div className="mt-2 space-y-2 text-sm leading-6 text-platform-fg-secondary">
                <p>{node.learningContent.card.summary}</p>
                {node.learningContent.card.insight ? <p>{node.learningContent.card.insight}</p> : null}
                {node.learningContent.card.explanation ? <p>{node.learningContent.card.explanation}</p> : null}
              </div>
            </section>
          ) : node?.learningContent?.card.state === 'available' && cardProjection.visibility === 'unavailable' ? (
            <p data-optional-content-unavailable="card" className="text-sm text-platform-fg-muted">{cardProjection.message}</p>
          ) : null}
          {node?.learningContent?.infograph.state === 'available' && !infographFailed && infographProjection.visibility === 'render' ? (
            <section aria-labelledby="active-detail-infograph" className="rounded-lg border border-platform-border bg-platform-canvas-muted p-3">
              <h3 id="active-detail-infograph" className="text-sm font-semibold text-platform-fg-primary">{graphCopy(locale, 'inspector.infograph')}</h3>
              <Image
                src={shardUrl(`/api/knowledge/shards/active/nodes/${encodeURIComponent(nodeKey)}/infograph`, locale)}
                alt={node.learningContent.infograph.alternativeText}
                width={1200}
                height={675}
                sizes="(max-width: 640px) 100vw, 30rem"
                unoptimized
                onError={() => setInfographFailed(true)}
                className="mt-3 h-auto w-full rounded-md border border-platform-border bg-platform-surface object-contain"
              />
            </section>
          ) : null}
          <section aria-labelledby="active-detail-resources" data-active-inspector-resources="true">
            <h3 id="active-detail-resources" className="text-sm font-semibold text-platform-fg-primary">{graphCopy(locale, 'inspector.resources')}</h3>
            {node?.resourceBindings?.state === 'available' ? (
              <div className="mt-2 space-y-3">
                {ACTIVE_RESOURCE_BINDING_ROLES.map((role) => {
                  const bindings = node.resourceBindings;
                  const items = bindings?.state === 'available'
                    ? bindings.items.filter((item) => item.bindingRole === role)
                    : [];
                  if (items.length === 0) return null;
                  return (
                    <div key={role} data-active-resource-role={role}>
                      <h4 className="text-xs font-medium text-platform-fg-muted">{role}</h4>
                      <div className="mt-1 space-y-1">
                        {items.map((item) => (
                          item.availability === 'available'
                          && (item.launch.href || item.launch.kind === 'viewer-shell') ? (
                            <button
                              type="button"
                              key={`${role}-${item.title}`}
                              onClick={() => openResourceViewer({
                                title: item.title,
                                resourceKind: item.resourceKind,
                                href: item.launch.href,
                                node: item.resourceKind === '知识卡'
                                  ? {
                                      name: item.title,
                                      description: node?.description ?? item.title,
                                      nodeType: node?.canonicalType ?? 'KnowledgeStatement',
                                      metadata: node?.learningContent?.card.state === 'available'
                                        ? {
                                            content: [
                                              node.learningContent.card.summary,
                                              node.learningContent.card.insight,
                                              node.learningContent.card.explanation,
                                            ].filter(Boolean).join('\n\n'),
                                          }
                                        : undefined,
                                    }
                                  : undefined,
                                imageSrc: item.resourceKind === '信息图'
                                  ? shardUrl(`/api/knowledge/shards/active/nodes/${encodeURIComponent(nodeKey)}/infograph`, locale)
                                  : undefined,
                              })}
                              data-active-resource-launch={item.launch.kind}
                              className="block w-full rounded-md border border-platform-border bg-platform-canvas-muted px-2 py-1.5 text-left text-xs text-platform-fg-primary hover:bg-platform-action-subtle"
                            >
                              {item.title}
                              <span className="ml-2 text-platform-fg-muted">{item.resourceKind}</span>
                            </button>
                          ) : (
                            <p
                              key={`${role}-${item.title}`}
                              data-active-resource-unavailable="true"
                              className="rounded-md border border-platform-border px-2 py-1.5 text-xs text-platform-fg-muted"
                            >
                              {item.title}（暂不可启动）
                            </p>
                          )
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-2 text-sm text-platform-fg-muted">
                {node?.resourceBindings?.message ?? graphCopy(locale, 'inspector.noAuthorizedResources')}
              </p>
            )}
          </section>
          <section aria-labelledby="active-detail-relations">
            <h3 id="active-detail-relations" className="text-sm font-semibold text-platform-fg-primary">{graphCopy(locale, 'inspector.relations')}</h3>
            <div className="mt-2 space-y-2">
              {summaries.length === 0 ? (
                <p className="text-sm text-platform-fg-muted">{node?.adjacency.length ? graphCopy(locale, 'inspector.hiddenRelations') : graphCopy(locale, 'empty.noPublishedRelation')}</p>
              ) : summaries.slice(0, 20).map((relation) => (
                <button
                  key={relation.key}
                  type="button"
                  data-active-inspector-neighbor={relation.neighborKey}
                  onClick={() => onActivateNeighbor(relation.neighborKey)}
                  className="block w-full rounded-md border border-platform-border bg-platform-canvas-muted p-2 text-left text-xs hover:bg-platform-action-subtle"
                >
                  <span className="font-medium text-platform-fg-primary">{relation.relationLabel}</span>
                  <span className="ml-2 text-platform-fg-muted">
                    {relation.kind === 'undirected'
                      ? `${graphCopy(locale, 'inspector.undirected')} · ${relation.neighborLabel}`
                      : `${graphCopy(locale, relation.traversal === 'outgoing' ? 'inspector.outgoing' : 'inspector.incoming')} · ${relation.directionLabel} · ${relation.neighborLabel}`}
                  </span>
                </button>
              ))}
              {node && node.adjacency.length > summaries.length ? <p className="text-xs text-platform-fg-muted">{graphCopy(locale, 'inspector.hiddenRelations')}</p> : null}
            </div>
          </section>
          <section aria-labelledby="active-detail-sources">
            <h3 id="active-detail-sources" className="text-sm font-semibold text-platform-fg-primary">{graphCopy(locale, 'inspector.sources')}</h3>
            <p className="mt-2 text-xs text-platform-fg-secondary">{presentSourceCitation(node?.sources, locale)}</p>
          </section>
          {node?.governance ? (
            <section className="rounded-lg border border-platform-border bg-platform-canvas-muted p-3 text-xs text-platform-fg-secondary">
              <h3 className="font-semibold text-platform-fg-primary">{graphCopy(locale, 'inspector.governance')}</h3>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt>{graphCopy(locale, 'inspector.review')}</dt><dd>{presentGovernanceLabel(node.governance.reviewStatus, locale)}</dd>
                <dt>{graphCopy(locale, 'inspector.publication')}</dt><dd>{presentGovernanceLabel(node.governance.publicationStatus, locale)}</dd>
              </dl>
            </section>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}

interface DomainSearchState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  queryKey: string;
  pageSize: number;
  total: number;
  hits: readonly AuthorityDomainSearchHit[];
}

const IDLE_DOMAIN_SEARCH: DomainSearchState = {
  status: 'idle',
  queryKey: '',
  pageSize: SEARCH_RESULT_PAGE_SIZE,
  total: 0,
  hits: [],
};

function isAuthorityDomainSearchResponse(value: unknown): value is {
  contract: typeof AUTHORITY_DOMAIN_SEARCH_CONTRACT;
  envelope?: unknown;
  domainId: string;
  total: number;
  pageSize: number;
  hits: AuthorityDomainSearchHit[];
} {
  if (!value || typeof value !== 'object') return false;
  const record = value as {
    contract?: unknown;
    domainId?: unknown;
    total?: unknown;
    page?: unknown;
    pageSize?: unknown;
    hits?: unknown;
  };
  if (record.contract !== AUTHORITY_DOMAIN_SEARCH_CONTRACT) return false;
  if (typeof record.domainId !== 'string') return false;
  if (typeof record.total !== 'number' || typeof record.page !== 'number') return false;
  if (typeof record.pageSize !== 'number' || !Array.isArray(record.hits)) return false;
  return record.hits.every((hit) => (
    hit && typeof hit === 'object'
    && typeof (hit as { id?: unknown }).id === 'string'
    && typeof (hit as { label?: unknown }).label === 'string'
    && typeof (hit as { canonicalType?: unknown }).canonicalType === 'string'
  ));
}

/**
 * Fail closed: a domain-search response from another Authority, Teaching or
 * locale generation must not enter the current workspace.
 */
function searchResponseSharesEnvelope(
  workspaceEnvelope: AuthorityShardPublicEnvelope,
  payload: { envelope?: unknown },
): boolean {
  const responseEnvelope = payload.envelope as AuthorityShardPublicEnvelope | undefined;
  return Boolean(
    responseEnvelope
    && publicEnvelopesShareAuthorityAndCatalog(workspaceEnvelope, responseEnvelope)
    && publicTeachingIdentityMatches(workspaceEnvelope, responseEnvelope)
    && publicEnvelopesShareLocaleProfile(workspaceEnvelope, responseEnvelope),
  );
}

function SearchResults({
  state,
  onSelect,
  onLoadMore,
  locale,
}: {
  state: DomainSearchState;
  onSelect: (hit: AuthorityDomainSearchHit) => void;
  onLoadMore: () => void;
  locale: AdmittedLocale;
}) {
  if (state.status === 'error') {
    return (
      <p
        role="alert"
        data-active-search-failed="true"
        className="mt-2 rounded-md border border-red-400/35 bg-red-400/10 px-3 py-2 text-xs text-red-100"
      >
        {graphCopy(locale, 'search.failed')}
      </p>
    );
  }
  const loadingNextPage = state.status === 'loading';
  if (state.status !== 'ready' || state.hits.length === 0) return null;
  const remainingCount = Math.max(0, state.total - state.hits.length);
  return (
    <div className="mt-2 max-h-44 overflow-y-auto rounded-md border border-platform-border bg-platform-surface" data-active-search-results data-active-search-result-total={state.total}>
      <div className="border-b border-platform-border px-3 py-2 text-[11px] text-platform-fg-muted" role="status" aria-live="polite">
        {loadingNextPage
          ? graphCopy(locale, 'search.searching')
          : formatSearchShownCount(locale, state.hits.length, state.total)}
      </div>
      {state.hits.map((hit) => (
        <button
          key={hit.id}
          type="button"
          onClick={() => onSelect(hit)}
          aria-label={`${graphCopy(locale, 'search.locate')}${hit.mathematics?.state === 'available' ? hit.mathematics.accessibleLabel : hit.label}`}
          data-active-authority-search-result={hit.id}
          className="flex w-full items-center justify-between gap-2 border-b border-platform-border px-3 py-2 text-left text-xs last:border-b-0 hover:bg-platform-action-subtle"
        >
          <span className="min-w-0 truncate text-platform-fg-primary" data-active-authority-search-result-label={hit.id}>
            {hit.mathematics && hit.mathematics.state !== 'missing' ? (
              <GovernedFormulaLabel projection={hit.mathematics} theme="dark" />
            ) : hit.label}
          </span>
          <span className="shrink-0 text-platform-fg-muted">
            {hit.typeLabel ?? presentActiveNodeType(hit.canonicalType).label}
          </span>
        </button>
      ))}
      {remainingCount > 0 ? (
        <button
          type="button"
          onClick={onLoadMore}
          aria-label={formatLoadMoreAria(locale, remainingCount)}
          data-active-authority-search-load-more
          className="w-full border-t border-platform-border px-3 py-2 text-left text-xs text-platform-action-primary hover:bg-platform-action-subtle"
        >
          {loadingNextPage
            ? graphCopy(locale, 'search.searching')
            : formatLoadMore(locale, remainingCount)}
        </button>
      ) : null}
    </div>
  );
}

export function ActiveAuthorityGraph({
  viewerRole: _viewerRole,
  dimension: dimensionProp,
  onActiveDomainChange,
  onShowLegacy,
  returnToRootRef,
  chromeHostRef,
  runtimeControlsRef,
}: ActiveAuthorityGraphProps) {
  const dimension = dimensionProp ?? '2d';
  const runtimeLayout = useKnowledgeGraphRuntimeLayout({ dimension });
  const [retry, setRetry] = useState(0);
  const [locale, setLocale] = useState<AdmittedLocale>('zh-CN');
  const [requestedLocale, setRequestedLocale] = useState<AdmittedLocale>('zh-CN');
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const {
    state,
    workspace,
    enterDomain,
    enableFamily,
    disableFamily,
    familyFailures,
    requestNeighborhood,
    neighborhoodFailures,
    localeRefreshFailure,
    resetDomain,
    applyShard,
    onIdentityFailure,
  } = useActiveAuthorityWorkspace(
  retry,
  requestedLocale,
  (previousLocale) => {
    setRequestedLocale(previousLocale);
    setLocale(previousLocale);
  },
  (nextLocale) => setLocale(nextLocale),
);
  const languageState = selectGraphLanguage(
    createGraphLanguageState(workspace.localeCapability),
    locale,
  );
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  // #2052 首帧门控：领域进入的分段 visibleKeys 并入（16→27→85）在后台
  // 完成；引擎沉降且最终范围就绪前用加载占位替代可见帧。
  const [settledDomainEntryNodeCount, setSettledDomainEntryNodeCount] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  // 独立可逆的节点类型筛选：集合保存被隐藏的注册类型身份（canonicalType），
  // 与 locale/维度无关，切换筛选不重建模型、坐标或相机（#1742）。
  const [hiddenNodeTypes, setHiddenNodeTypes] = useState<ReadonlySet<string>>(new Set());
  // 教学关系层默认可见、独立可逆，便于单独观察工程关系（#1742 review）。
  const [teachingRelationsVisible, setTeachingRelationsVisible] = useState(true);
  const [mobileGraphControlsExpanded, setMobileGraphControlsExpanded] = useState(false);
  const graphMainRef = useRef<HTMLElement | null>(null);
  const mobileToolsRef = useRef<HTMLDivElement | null>(null);
  const selectionIntentRef = useRef(0);
  const pendingCrossDomainSelectionRef = useRef<{ key: string; intent: number } | null>(null);
  const isCompactViewport = viewportWidth !== null
    && viewportWidth <= KNOWLEDGE_GRAPH_COMPACT_MAX_WIDTH;
  const graphControlsVisible = !isCompactViewport || mobileGraphControlsExpanded;
  const visibleNodeLimit = isCompactViewport ? ACTIVE_MOBILE_NODE_LIMIT : ACTIVE_GRAPH_NODE_LIMIT;

  useEffect(() => {
    onActiveDomainChange?.(workspace.activeDomainId);
  }, [onActiveDomainChange, workspace.activeDomainId]);

  useEffect(() => {
    const updateViewportWidth = () => setViewportWidth(window.innerWidth);
    updateViewportWidth();
    window.addEventListener('resize', updateViewportWidth);
    return () => window.removeEventListener('resize', updateViewportWidth);
  }, []);

  useEffect(() => {
    setMobileGraphControlsExpanded(false);
  }, [workspace.activeDomainId]);

  // Mobile 折叠抽屉（mobileTools）卸载后，焦点可能残留在已移除的筛选
  // 控件上而丢到 body；还原到折叠开关，键盘会话不中断（#1742）。
  useEffect(() => {
    if (graphControlsVisible) return;
    if (document.activeElement && document.activeElement !== document.body) return;
    document
      .querySelector<HTMLElement>('[data-active-authority-mobile-tools-toggle="true"]')
      ?.focus();
  }, [graphControlsVisible]);

  const model = useMemo(() => {
    if (state.status !== 'ready' || !workspace.activeDomainId) return null;
    const relations = visibleAuthorityShardRelations(workspace);
    const inActiveDomain = (canonicalId: string) => (
      workspace.objectsByCanonicalId[canonicalId]?.memberships
        .some((membership) => membership.domainId === workspace.activeDomainId) ?? false
    );
    const nodes = Object.values(workspace.objectsByCanonicalId)
      .filter((object) => inActiveDomain(object.id));
    const inDomainRelations = relations.filter((relation) => (
      inActiveDomain(relation.sourceId) && inActiveDomain(relation.targetId)
    ));
    return createActiveAuthorityGraphModel({
      nodes,
      relations: inDomainRelations.map((relation) => ({
        ...relation,
        relationFamily: relation.relationFamily ?? undefined,
      })),
    });
  }, [state.status, workspace]);
  const teachingCoverage = workspace.activeDomainId
    ? workspace.teachingCoverageByDomain[workspace.activeDomainId]
    : null;
  // 状态映射 i18n（而非匹配 note 字符串）：available 是正常态不打扰，其余
  // 状态在筛选面板教学行内显式提示（#1742 移除 legend 行后的空态出口）。
  const teachingCoverageNote = !teachingCoverage || teachingCoverage.status === 'available'
    ? null
    : graphCopy(
      locale,
      teachingCoverage.status === 'partial'
        ? 'legend.teachingPartial'
        : teachingCoverage.status === 'empty'
          ? 'legend.teachingEmpty'
          : 'legend.teachingUnavailable',
    );
  const latestCutoverReady = workspace.latestCutover?.ready === true
    && teachingCoverage?.note !== '教学关系暂不可用';
  // #2052 跨领域画布内聚类（cross-domain-canvas-cluster）：合成节点 id
  // （cross:<canonicalId>）经视图进入 2D 画布的虚线领域圆；模型、覆盖
  // 统计与检索语义不变；点击进入目标领域（followBoundary）。
  const crossDomainClusters = useMemo(() => {
    if (!workspace.activeDomainId || !workspace.root) return [];
    const root = workspace.root;
    const knownBoundaryIds = new Set(Object.keys(workspace.boundaryRefsByCanonicalId));
    const byDomain = new Map<string, {
      domainName: string;
      nodes: Map<string, { canonicalId: string; name: string; typeLabel: string; summary: string }>;
      links: Map<string, { sourceId: string; targetId: string; predicate: string; relationFamily: string | null }>;
    }>();
    for (const relation of visibleAuthorityShardRelations(workspace)) {
      const source = workspace.objectsByCanonicalId[relation.sourceId];
      const target = workspace.objectsByCanonicalId[relation.targetId];
      const sourceInDomain = source?.memberships.some((membership) => membership.domainId === workspace.activeDomainId) ?? false;
      const targetInDomain = target?.memberships.some((membership) => membership.domainId === workspace.activeDomainId) ?? false;
      if (sourceInDomain === targetInDomain) continue;
      const boundary = sourceInDomain ? target : source;
      if (!boundary || !knownBoundaryIds.has(boundary.id)) continue;
      const membership = selectActiveAuthorityMembership(boundary.memberships, workspace.activeDomainId);
      const domain = membership
        ? root.domains.find((entry) => entry.visualRole === membership.visualRole)
        : undefined;
      if (!domain) continue;
      let cluster = byDomain.get(domain.displayName);
      if (!cluster) {
        cluster = { domainName: domain.displayName, nodes: new Map(), links: new Map() };
        byDomain.set(domain.displayName, cluster);
      }
      cluster.nodes.set(crossDomainNodeId(boundary.id), {
        canonicalId: boundary.id,
        name: boundary.label?.trim() || boundary.accessibleName || graphCopy(locale, 'inspector.nameUnavailable'),
        typeLabel: boundary.typeLabel?.trim() || boundary.canonicalType,
        summary: boundary.description?.trim() || '',
      });
      // 只把外部端点替换为合成跨域节点，保留原始 source→target 方向
      //（#2054 review：有向跨域关系不得反转箭头语义）。
      cluster.links.set(`${relation.layer}:${relation.id}`, {
        sourceId: sourceInDomain ? relation.sourceId : crossDomainNodeId(boundary.id),
        targetId: targetInDomain ? relation.targetId : crossDomainNodeId(boundary.id),
        predicate: relation.predicate,
        relationFamily: relation.relationFamily ?? null,
      });
    }
    return [...byDomain.values()].map((cluster) => ({
      domainName: cluster.domainName,
      nodes: [...cluster.nodes.values()],
      links: [...cluster.links.values()],
    }));
  }, [workspace, locale]);

  const domainEpoch = `${workspace.envelope?.authorityCatalogVersion ?? ''}:${workspace.activeDomainId ?? ''}`;
  // locale 事务刷新会重建 domainOverviewIds 数组引用但内容不变；deps 用
  // 内容 key，过滤/选择/查询状态只在真正换域时重置（#1742）。
  const domainOverviewKey = workspace.domainOverviewIds.join('\u0000');
  const modelReady = Boolean(model);
  // This reset is intentionally tied to readiness rather than model identity:
  // filtering and selection rebuild the derived model without resetting view state.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!model) return;
    const pending = pendingCrossDomainSelectionRef.current;
    if (pending && pending.intent !== selectionIntentRef.current) {
      pendingCrossDomainSelectionRef.current = null;
    }
    // Desktop and mobile enter the same server-bounded DomainConcept
    // overview; the desktop all-model-nodes initialization path is gone.
    setSettledDomainEntryNodeCount(null);
    setVisibleKeys(isCompactViewport
      ? selectInitialPrimaryDomainScope(model, visibleNodeLimit)
      : selectAuthorityDomainOverviewScope(model, workspace.domainOverviewIds));
    setSelectedNodeKey(null);
    setQuery('');
    setHiddenNodeTypes(new Set());
    setTeachingRelationsVisible(true);
    // modelReady gates the first composed graph; later model identity changes
    // (family/neighborhood merges) must not reset selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainEpoch, modelReady, isCompactViewport, visibleNodeLimit, domainOverviewKey]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // A cross-domain selection waits until its owning domain response and, for
  // secondary objects, the one-hop disclosure have materialized the node.
  useEffect(() => {
    const pending = pendingCrossDomainSelectionRef.current;
    if (!model || !pending || pending.intent !== selectionIntentRef.current) return;
    if (!model.nodeByKey.has(pending.key)) return;
    pendingCrossDomainSelectionRef.current = null;
    setVisibleKeys(materializeActiveNodeScope(model, pending.key, visibleNodeLimit));
    setSelectedNodeKey(pending.key);
  }, [model, visibleNodeLimit]);

  useEffect(() => {
    if (!model) return;
    setVisibleKeys((current) => {
      if (isCompactViewport) {
        if (workspace.enabledFamilies.length === 0) return current;
        const disclosedRelation = model.relations[0];
        return disclosedRelation
          ? expandActiveAuthorityOneHop(model, current, disclosedRelation.sourceKey, visibleNodeLimit)
          : current;
      }
      const next = new Set(current);
      for (const relation of model.relations) {
        const source = model.nodeByKey.get(relation.sourceKey);
        const target = model.nodeByKey.get(relation.targetKey);
        const teachingRelation = relation.sourceRelation.layer === 'ACT_TEACHING';
        if (
          !teachingRelation
          && workspace.enabledFamilies.length === 0
          && (!source || !target || !isPrimaryDomainObject(source) || !isPrimaryDomainObject(target))
        ) {
          continue;
        }
        next.add(relation.sourceKey);
        next.add(relation.targetKey);
      }
      return next;
    });
  }, [isCompactViewport, model, visibleNodeLimit, workspace.enabledFamilies.length]);

  useEffect(() => {
    if (!model || !selectedNodeKey) return;
    setVisibleKeys((current) => {
      if (isCompactViewport) {
        return materializeActiveNodeScope(model, selectedNodeKey, visibleNodeLimit);
      }
      const next = new Set(current);
      if (model.nodeByKey.has(selectedNodeKey)) next.add(selectedNodeKey);
      for (const relation of model.adjacency.get(selectedNodeKey) ?? []) {
        next.add(relation.sourceKey);
        next.add(relation.targetKey);
      }
      return next;
    });
  }, [isCompactViewport, model, selectedNodeKey, visibleNodeLimit]);

  useEffect(() => {
    if (!selectedNodeKey) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const key = selectedNodeKey;
      leaveSelectedNeighborhood();
      window.setTimeout(() => restoreFocus(key), 0);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
    // Leave/restore semantics read the current model and overview ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodeKey, model, workspace.domainOverviewIds, isCompactViewport, visibleNodeLimit]);

  useEffect(() => {
    const main = graphMainRef.current;
    if (!main || !isCompactViewport || !selectedNodeKey) return;
    main.setAttribute('inert', '');
    return () => main.removeAttribute('inert');
  }, [isCompactViewport, selectedNodeKey]);

  const [domainSearch, setDomainSearch] = useState<DomainSearchState>(IDLE_DOMAIN_SEARCH);
  const trimmedQuery = query.trim();
  const searchQueryKey = `${workspace.activeDomainId ?? ''}\u0000${trimmedQuery}`;
  const domainSearchRef = useRef(domainSearch);
  domainSearchRef.current = domainSearch;

  // Bounded server search over the sealed per-domain index: secondary types
  // stay undisclosed on the canvas until their one-hop neighborhood loads.
  useEffect(() => {
    if (!workspace.activeVisualRole || !workspace.envelope || !trimmedQuery) {
      setDomainSearch(IDLE_DOMAIN_SEARCH);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const queryKey = `${workspace.activeDomainId ?? ''}\u0000${trimmedQuery}`;
      setDomainSearch((current) => (
        current.queryKey === queryKey
          ? { ...current, status: 'loading' }
          : { ...IDLE_DOMAIN_SEARCH, status: 'loading', queryKey, pageSize: SEARCH_RESULT_PAGE_SIZE }
      ));
      requestDomainSearch({ page: 0, append: false, signal: controller.signal });
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
    // Search keys track the active domain, query, type and locale only.
    /* eslint-disable react-hooks/exhaustive-deps */
  }, [searchQueryKey, locale, workspace.activeVisualRole]);
  /* eslint-enable react-hooks/exhaustive-deps */

  /** One bounded search request shared by the debounced query and load-more. */
  function requestDomainSearch(options: { page: number; append: boolean; signal?: AbortSignal }) {
    const visualRole = workspace.activeVisualRole;
    const workspaceEnvelope = workspace.envelope;
    if (!visualRole || !workspaceEnvelope || !trimmedQuery) return;
    const queryKey = `${workspace.activeDomainId ?? ''}\u0000${trimmedQuery}`;
    const params = new URLSearchParams({ q: trimmedQuery, limit: String(SEARCH_RESULT_PAGE_SIZE) });
    if (options.page > 0) params.set('page', String(options.page));
    fetch(
      shardUrl(
        `/api/knowledge/shards/active/domains/${encodeURIComponent(visualRole)}/search?${params.toString()}`,
        locale,
      ),
      { signal: options.signal, headers: { accept: 'application/json' } },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error(`search failed: ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload: unknown) => {
        if (options.signal?.aborted) return;
        if (!isAuthorityDomainSearchResponse(payload)) return;
        if (!searchResponseSharesEnvelope(workspaceEnvelope, payload)) return;
        setDomainSearch((current) => {
          if (current.queryKey !== queryKey) return current;
          if (!options.append) {
            return {
              status: 'ready',
              queryKey,
              pageSize: payload.pageSize,
              total: payload.total,
              hits: payload.hits,
            };
          }
          return { ...current, status: 'ready', hits: [...current.hits, ...payload.hits] };
        });
      })
      .catch(() => {
        if (options.signal?.aborted) return;
        setDomainSearch((current) => (
          current.queryKey === queryKey ? { ...current, status: 'error' } : current
        ));
      });
  }

  function loadMoreSearchResults() {
    const current = domainSearchRef.current;
    if (current.status !== 'ready' || current.hits.length >= current.total) return;
    setDomainSearch((state) => ({ ...state, status: 'loading' }));
    requestDomainSearch({
      page: Math.floor(current.hits.length / Math.max(1, current.pageSize)),
      append: true,
    });
  }

  const scopedGraph = useMemo(() => {
    if (!model) return null;
    const scoped = visibleActiveGraph(model, visibleKeys);
    if (hiddenNodeTypes.size === 0) return scoped;
    const filteredKeys = new Set(scoped.nodes.filter((node) => !hiddenNodeTypes.has(node.type.canonicalType)).map((node) => node.key));
    return visibleActiveGraph(model, filteredKeys);
  }, [model, hiddenNodeTypes, visibleKeys]);
  // #2052：桌面领域进入以「可见集覆盖完整 overview 范围」为分阶段并入
  // 完成里程碑；compact 视图本身有可见上限，以首次沉降为准。
  const domainEntryStageComplete = isCompactViewport
    ? true
    : workspace.domainOverviewIds
      // 只要求模型已接纳（fail-closed 省略不合格对象后）的 overview ID；
      // 原始 ID 集里的被省略对象永远不会进入 visibleKeys（#2054 review）。
      .filter((key) => model?.nodeByKey.has(key) ?? false)
      .every((key) => visibleKeys.has(key));
  const domainEntryNodeCount = scopedGraph?.nodes.length ?? 0;
  const domainEntrySettled = domainEntryStageComplete
    && settledDomainEntryNodeCount !== null
    && settledDomainEntryNodeCount === domainEntryNodeCount;
  const handleDomainEngineSettled = useCallback(() => {
    setSettledDomainEntryNodeCount(domainEntryNodeCount);
  }, [domainEntryNodeCount]);
  // 面板只列当前有界逻辑图中已物化的注册类型；隐藏类型保留控件可逆（#1742）。
  const materializedNodeTypes = useMemo(() => {
    if (!model) return [];
    const byType = new Map(model.nodes.map((node) => [node.type.canonicalType, node]));
    return knownActiveNodeTypes()
      .filter((type) => byType.has(type.canonicalType))
      .map((type) => {
        const materialized = byType.get(type.canonicalType)!;
        return {
          canonicalType: type.canonicalType,
          shape: materialized.type.shape,
          tone: materialized.type.tone,
          fallbackLabel: materialized.type.label,
        };
      });
  }, [model]);
  const authorityView = useMemo(() => {
    if (!scopedGraph) return null;
    const haloIds = Object.keys(workspace.boundaryRefsByCanonicalId);
    return createAuthorityGraphViewModel({
      nodes: scopedGraph.nodes.map((row) => row.sourceNode),
      relations: scopedGraph.relations.map((row) => row.sourceRelation),
      crossDomainCanonicalIds: haloIds,
      enabledRelationFamilies: [
        ...(teachingRelationsVisible ? defaultEnabledTeachingFamilies() : []),
        ...workspace.enabledFamilies,
      ],
    });
  }, [scopedGraph, teachingRelationsVisible, workspace.boundaryRefsByCanonicalId, workspace.enabledFamilies]);
  const overviewDirectoryEntries = useMemo(() => {
    if (!model) return undefined;
    const entries = workspace.domainOverviewIds
      .map((id) => model.nodeByKey.get(id))
      .filter((node): node is NonNullable<typeof node> => node !== undefined)
      // mobile 大域目录与画布共用同一类型可见性（#1742 review）。
      .filter((node) => !hiddenNodeTypes.has(node.type.canonicalType))
      .map((node) => ({ id: node.key, label: node.label, mathematics: node.mathematics }));
    return entries.length > 0 ? entries : undefined;
  }, [model, hiddenNodeTypes, workspace.domainOverviewIds]);
  const selectedNode = selectedNodeKey && model ? model.nodeByKey.get(selectedNodeKey) : undefined;
  // #2052：跨领域合成节点的有界预览（名称/类型/摘要），复用既有浮层。
  const crossHoveredNodeId = hoveredNodeId?.startsWith('cross:') ? hoveredNodeId : null;
  const crossHoverPreview = crossHoveredNodeId
    ? crossDomainClusters.flatMap((cluster) => cluster.nodes)
      .find((candidate) => crossDomainNodeId(candidate.canonicalId) === crossHoveredNodeId) ?? null
    : null;
  const hoverPreview = crossHoverPreview
    ? {
      name: crossHoverPreview.name,
      typeLabel: crossHoverPreview.typeLabel,
      summary: crossHoverPreview.summary,
    }
    : hoveredNodeId && model?.nodeByKey.get(hoveredNodeId)
    ? {
      name: model.nodeByKey.get(hoveredNodeId)!.label,
      typeLabel: model.nodeByKey.get(hoveredNodeId)!.type.label,
      summary: model.nodeByKey.get(hoveredNodeId)!.description ?? graphCopy(locale, 'empty.domain'),
      richTitle: model.nodeByKey.get(hoveredNodeId)!.richTitle,
      richDescription: model.nodeByKey.get(hoveredNodeId)!.richDescription,
      mathematics: model.nodeByKey.get(hoveredNodeId)!.mathematics,
    }
    : null;

  function resolveNodeSelection(
    key: string,
    mode: 'canvas' | 'search',
    knownMemberships?: readonly AuthorityShardMembership[],
  ): void {
    if (!model && !workspace.objectsByCanonicalId[key] && !knownMemberships) return;
    const intent = selectionIntentRef.current + 1;
    selectionIntentRef.current = intent;
    if (mode === 'search') {
      // The result button is removed when the query is cleared; restore focus
      // to the newly materialized semantic node or the canvas instead.
      setQuery('');
      setHiddenNodeTypes(new Set());
      setTeachingRelationsVisible(true);
    }

    const object = workspace.objectsByCanonicalId[key];
    const memberships = (object?.memberships ?? knownMemberships ?? []).filter((membership) => (
      workspace.root?.domains.some((domain) => domain.visualRole === membership.visualRole) ?? false
    ));
    const membership = selectActiveAuthorityMembership(memberships, workspace.activeDomainId);
    const owningDomain = membership
      ? workspace.root?.domains.find((domain) => domain.visualRole === membership.visualRole)
      : undefined;
    if (!membership || !owningDomain || (
      workspace.activeDomainId === membership.domainId
      && workspace.activeVisualRole === owningDomain.visualRole
    )) {
      if (!model) return;
      pendingCrossDomainSelectionRef.current = null;
      setVisibleKeys((current) => {
        // An undisclosed same-domain hit keeps the current scope until its
        // bounded one-hop neighborhood materializes the node.
        if (!model.nodeByKey.has(key)) return current;
        return mode === 'search'
          ? materializeActiveNodeScope(model, key, visibleNodeLimit)
          : expandActiveAuthorityOneHop(model, current, key, visibleNodeLimit);
      });
      setSelectedNodeKey(key);
      requestNeighborhood(key);
      return;
    }

    // A boundary object is present in the current domain only as an endpoint.
    // Load its owning domain first; the domain response then establishes the
    // active revision before selection and neighborhood loading begin.
    pendingCrossDomainSelectionRef.current = { key, intent };
    void enterDomain(owningDomain.visualRole).then((loaded) => {
      if (!loaded || selectionIntentRef.current !== intent) return;
      const pending = pendingCrossDomainSelectionRef.current;
      if (!pending || pending.key !== key || pending.intent !== intent) return;
      requestNeighborhood(key);
    });
  }

  function toggleTeachingRelations() {
    setTeachingRelationsVisible((visible) => !visible);
  }

  function toggleNodeTypeFilter(canonicalType: string) {
    setHiddenNodeTypes((current) => {
      const next = new Set(current);
      if (next.has(canonicalType)) next.delete(canonicalType);
      else next.add(canonicalType);
      return next;
    });
  }

  function resetOverview() {
    selectionIntentRef.current += 1;
    pendingCrossDomainSelectionRef.current = null;
    resetDomain();
    setSelectedNodeKey(null);
    setQuery('');
    setHiddenNodeTypes(new Set());
    setTeachingRelationsVisible(true);
  }
  if (returnToRootRef) returnToRootRef.current = resetOverview;
  if (runtimeControlsRef) {
    runtimeControlsRef.current = {
      requestFitView: runtimeLayout.requestFitView,
      requestRelayout: runtimeLayout.requestRelayout,
      requestUnpin: runtimeLayout.unpinNode,
    };
  }

  function focusSearchResult(hit: AuthorityDomainSearchHit) {
    resolveNodeSelection(hit.id, 'search', hit.memberships);
  }

  function followBoundary(nodeId: string) {
    resolveNodeSelection(nodeId, 'canvas');
  }

  /**
   * Leaving a selected neighborhood deterministically restores the same
   * domain's level-two overview; filters and viewport state are preserved
   * and disclosed secondary nodes are not left flattened into the overview.
   */
  function leaveSelectedNeighborhood() {
    setSelectedNodeKey(null);
    if (!model) return;
    setVisibleKeys(isCompactViewport
      ? selectInitialPrimaryDomainScope(model, visibleNodeLimit)
      : selectAuthorityDomainOverviewScope(model, workspace.domainOverviewIds));
  }

  function closeDetail() {
    const key = selectedNodeKey;
    leaveSelectedNeighborhood();
    window.setTimeout(() => restoreFocus(key), 0);
  }

  function restoreFocus(nodeKey: string | null) {
    if (nodeKey) {
      for (const node of document.querySelectorAll<HTMLElement>('[data-active-authority-node]')) {
        if (node.dataset.activeAuthorityNode === nodeKey) {
          node.focus();
          return;
        }
      }
    }
    document.querySelector<HTMLElement>('[data-knowledge-runtime-canvas]')?.focus();
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-platform-page text-platform-fg-primary" data-active-authority-graph="true" data-active-authority-consumer="engineering-graph" data-latest-cutover-ready={latestCutoverReady ? 'true' : 'false'} data-graph-locale={locale} data-workspace-locale={workspace.selectedLocale}>
      <div
        className="pointer-events-none absolute left-3 top-3 z-40 max-[639px]:top-14"
        data-active-authority-header="true"
      >
        <div className="flex flex-col items-start gap-1">
          <span className="sr-only" data-active-authority-title="true">{graphCopy(locale, 'title.graph')}</span>
          <div
            role="group"
            aria-label={graphCopy(locale, 'language.group')}
            data-graph-language-switch="true"
            className="pointer-events-auto flex rounded-md border border-platform-border bg-platform-surface/95 p-0.5 shadow-lg backdrop-blur"
          >
            <button
              type="button"
              data-graph-language="zh-CN"
              aria-pressed={locale === 'zh-CN'}
              onClick={() => setRequestedLocale(selectGraphLanguage(languageState, 'zh-CN').selectedLocale)}
              className={`rounded px-2 py-1 text-xs ${locale === 'zh-CN' ? 'bg-platform-action-primary text-platform-fg-inverse' : 'text-platform-fg-secondary'}`}
            >
              {graphCopy(locale, 'language.zh')}
            </button>
            <button
              type="button"
              data-graph-language="en"
              aria-pressed={locale === 'en'}
              aria-disabled={!languageState.englishAvailable}
              disabled={!languageState.englishAvailable}
              title={languageState.englishUnavailableReason ?? undefined}
              onClick={() => setRequestedLocale(selectGraphLanguage(languageState, 'en').selectedLocale)}
              className={`rounded px-2 py-1 text-xs ${locale === 'en' ? 'bg-platform-action-primary text-platform-fg-inverse' : 'text-platform-fg-secondary'} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {graphCopy(locale, 'language.en')}
            </button>
          </div>
          {languageState.englishAvailable ? null : (
            <p data-graph-language-unavailable="en" className="max-w-56 text-[11px] text-platform-fg-muted max-[639px]:sr-only">
              {languageState.englishUnavailableReason}
            </p>
          )}
          {localeRefreshFailure ? (
            <p
              role="alert"
              data-locale-refresh-failed="true"
              className="max-w-56 text-[11px] text-red-100"
            >
              {localeRefreshFailure}
            </p>
          ) : null}
        </div>
      </div>

      {state.status === 'loading' ? (
        <div className="flex flex-1 items-center justify-center" role="status">
          <div className="text-center text-sm text-platform-fg-secondary"><Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin text-platform-action-primary" aria-hidden="true" />{graphCopy(locale, 'loading.graph')}</div>
        </div>
      ) : state.status === 'error' && state.unauthenticated ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-md rounded-xl border border-platform-border bg-platform-canvas-muted p-5 text-center" role="alert" data-graph-login-wall="true">
            <p className="text-sm text-platform-fg-primary">{state.message}</p>
            <a
              href={`/login?callbackUrl=${encodeURIComponent(typeof window === 'undefined' ? '/knowledge' : `${window.location.pathname}${window.location.search}`)}`}
              className="mt-4 inline-flex items-center justify-center rounded-md bg-platform-action-primary px-4 py-2 text-sm text-platform-fg-inverse hover:opacity-90"
            >
              {graphCopy(locale, 'error.loginCta')}
            </a>
          </div>
        </div>
      ) : state.status === 'error' ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-md rounded-xl border border-red-400/35 bg-red-400/10 p-5 text-center" role="alert">
            <AlertTriangle className="mx-auto h-6 w-6 text-red-200" aria-hidden="true" />
            <p className="mt-3 text-sm text-red-50">{state.message}</p>
            {state.contentNotReady ? (
              onShowLegacy ? (
                <button type="button" onClick={onShowLegacy} data-error-action="legacy" className="mt-4 inline-flex items-center gap-2 rounded-md border border-red-200/40 px-3 py-2 text-sm text-red-50 hover:bg-red-100/10">{graphCopy(locale, 'error.viewLegacy')}</button>
              ) : null
            ) : (
              <>
                <p className="mt-2 text-xs text-red-100/75">{graphCopy(locale, 'error.noOtherGraph')}</p>
                <button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-4 inline-flex items-center gap-2 rounded-md border border-red-200/40 px-3 py-2 text-sm text-red-50 hover:bg-red-100/10"><RotateCcw className="h-4 w-4" aria-hidden="true" />{graphCopy(locale, 'error.retryGraph')}</button>
              </>
            )}
          </div>
        </div>
      ) : state.status === 'ready' && workspace.root && !workspace.activeDomainId ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <p className="sr-only">{graphCopy(locale, 'root.chooseDomain')}</p>
          <ActiveAuthorityRuntimeView
            kind="root"
            catalog={workspace.root}
            dimension={dimension}
            selectedNodeId={null}
            onSelectNode={() => undefined}
            onHoverNode={() => undefined}
            onEnterDomain={(visualRole) => {
              void enterDomain(visualRole);
            }}
            canvasAriaLabel={graphCopy(locale, 'a11y.canvas')}
            layout={runtimeLayout}
            sessionKey="active-root"
          />
        </div>
      ) : !model || !scopedGraph ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <div><Network className="mx-auto h-7 w-7 text-platform-fg-muted" aria-hidden="true" /><p className="mt-3 text-sm text-platform-fg-secondary">{graphCopy(locale, 'empty.domain')}</p><p className="mt-1 text-xs text-platform-fg-muted">{graphCopy(locale, 'empty.noLegacyFallback')}</p></div>
        </div>
      ) : (
        <div className="relative min-h-0 flex-1">
          <main ref={graphMainRef} className="relative flex min-h-0 h-full flex-col overflow-hidden max-[639px]:p-2" aria-label={graphCopy(locale, 'a11y.graph')} data-active-authority-main="true">
            <KnowledgeWorkspaceChromePortal hostRef={chromeHostRef}>
            <div className="mb-3 max-[639px]:mb-1 max-[639px]:flex-nowrap max-[639px]:overflow-x-auto" data-active-authority-toolbar="true">
              <button
                type="button"
                data-active-authority-mobile-tools-toggle="true"
                aria-expanded={mobileGraphControlsExpanded}
                aria-controls="active-authority-mobile-tools"
                onClick={() => setMobileGraphControlsExpanded((expanded) => !expanded)}
                className="hidden w-full items-center justify-between rounded-md border border-platform-border bg-platform-canvas-muted px-3 py-2 text-sm text-platform-fg-primary max-[639px]:inline-flex"
              >
                <span className="inline-flex items-center gap-2"><Search className="h-4 w-4" aria-hidden="true" />{graphCopy(locale, 'search.label')}</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${mobileGraphControlsExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
              {graphControlsVisible ? (
              <div
                id="active-authority-mobile-tools"
                ref={mobileToolsRef}
                data-active-authority-mobile-drawer={isCompactViewport ? 'true' : undefined}
                onKeyDown={(event) => {
                  if (!isCompactViewport) return;
                  // compact 折叠抽屉：Escape 关闭并把焦点还给折叠开关；Tab
                  // 在抽屉内循环。桌面常驻面板保持自然 Tab 序（#1742）。
                  if (event.key === 'Escape') {
                    // 抽屉内 Escape 只关抽屉，不再冒泡触发全局的退出邻域。
                    event.stopPropagation();
                    setMobileGraphControlsExpanded(false);
                    document
                      .querySelector<HTMLElement>('[data-active-authority-mobile-tools-toggle="true"]')
                      ?.focus();
                    return;
                  }
                  trapInspectorFocus(event, mobileToolsRef.current);
                }}
                className="mt-2 flex flex-wrap items-end justify-between gap-3"
              >
              <div className="min-w-[15rem] flex-1">
                <label className="sr-only" htmlFor="active-authority-search">{graphCopy(locale, 'search.label')}</label>
                <div className="relative max-[639px]:shrink-0">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-platform-fg-muted" aria-hidden="true" />
                  <input id="active-authority-search" value={query} onChange={(event) => setQuery(event.target.value)} onInput={(event) => setQuery(event.currentTarget.value)} placeholder={graphCopy(locale, 'search.placeholder')} className="w-full rounded-md border border-platform-border bg-platform-canvas-muted py-2 pl-9 pr-3 text-sm text-platform-fg-primary outline-none focus:ring-2 focus:ring-platform-action-primary" />
                </div>
                {query ? <SearchResults key={searchQueryKey} state={domainSearch} onSelect={focusSearchResult} onLoadMore={loadMoreSearchResults} locale={locale} /> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 max-[639px]:w-full max-[639px]:flex-nowrap max-[639px]:overflow-x-auto max-[639px]:pb-1">
                {workspace.activeDomainId && runtimeLayout.pinnedNodeIds.size > 0 ? (
                  <button
                    type="button"
                    onClick={() => runtimeLayout.unpinNode()}
                    data-active-authority-unpin-all="true"
                    aria-label={formatUnpinAllAria(locale, runtimeLayout.pinnedNodeIds.size)}
                    className="shrink-0 whitespace-nowrap rounded-md border border-platform-border px-2.5 py-2 text-xs text-platform-fg-secondary hover:bg-platform-action-subtle max-[639px]:shrink-0"
                  >
                    {graphCopy(locale, 'controls.unpinAll')}（{runtimeLayout.pinnedNodeIds.size}）
                  </button>
                ) : null}
              </div>
              </div>
              ) : null}
            </div>
            </KnowledgeWorkspaceChromePortal>
            <div className="pointer-events-none absolute bottom-2 left-3 right-3 z-10 mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-platform-fg-muted max-[639px]:hidden">
              <span>{visibleCoverageCopy(locale, scopedGraph.nodes.length, scopedGraph.relations.length)}</span>
              <span>{totalCoverageCopy(locale, model.totalNodeCount, model.totalRelationCount)}</span>
            </div>
            {selectedNodeKey && neighborhoodFailures[selectedNodeKey] ? (
              <div role="alert" aria-live="polite" data-authority-neighborhood-failure={selectedNodeKey} className="absolute left-3 right-3 top-14 z-20 mb-2 flex items-center justify-between gap-2 rounded-md border border-red-400/35 bg-red-400/10 px-3 py-2 text-xs text-red-100">
                <span>{neighborhoodFailures[selectedNodeKey].message}</span>
                {neighborhoodFailures[selectedNodeKey].retryable ? (
                  <button
                    type="button"
                    onClick={() => requestNeighborhood(selectedNodeKey)}
                    data-authority-neighborhood-retry={selectedNodeKey}
                    className="shrink-0 underline underline-offset-2"
                  >{graphCopy(locale, 'error.retryNeighborhood')}</button>
                ) : null}
              </div>
            ) : null}
            {authorityView ? (
              <div className="relative min-h-0 flex-1" data-active-authority-viewport={isCompactViewport ? 'compact' : 'default'} data-active-authority-node-limit={visibleNodeLimit}>
                <ActiveAuthorityRuntimeView
                  kind="domain"
                  view={authorityView}
                  dimension={dimension}
                  selectedNodeId={selectedNodeKey}
                  onSelectNode={(key) => resolveNodeSelection(key, 'canvas')}
                  onHoverNode={setHoveredNodeId}
                  onEnterDomain={(visualRole) => {
                    void enterDomain(visualRole);
                  }}
                  hoverPreview={hoverPreview}
                  canvasAriaLabel={graphCopy(locale, 'a11y.canvas')}
                  overviewCount={workspace.domainOverviewIds.length}
                  overviewEntries={overviewDirectoryEntries}
                  layout={runtimeLayout}
                  sessionKey={`active-domain:${workspace.activeDomainId ?? 'none'}`}
                  entryGateActive={!domainEntrySettled}
                  onEngineSettled={handleDomainEngineSettled}
                  crossDomainClusters={crossDomainClusters}
                  onCrossDomainNodeClick={followBoundary}
                />
                {materializedNodeTypes.length > 0 ? (
                  <ActiveAuthorityFilterPanel
                    locale={locale}
                    materializedTypes={materializedNodeTypes}
                    hiddenNodeTypes={hiddenNodeTypes}
                    onToggleNodeType={toggleNodeTypeFilter}
                    enabledFamilies={workspace.enabledFamilies}
                    onToggleFamily={(family) => (workspace.enabledFamilies.includes(family) ? disableFamily(family) : enableFamily(family))}
                    familyFailures={familyFailures}
                    onRetryFamily={enableFamily}
                    teachingCoverageNote={teachingCoverageNote}
                    teachingRelationsVisible={teachingRelationsVisible}
                    onToggleTeachingRelations={toggleTeachingRelations}
                  />
                ) : null}
              </div>
            ) : null}
            {scopedGraph.nodes.length === 1 && scopedGraph.relations.length === 0 ? <div className="pointer-events-none mt-2 text-center text-xs text-platform-fg-muted">{graphCopy(locale, 'empty.noPublishedRelation')}</div> : null}
            {model.omittedNodeCount > 0 || model.omittedRelationCount > 0 ? <p className="mt-2 text-xs text-platform-fg-muted">{graphCopy(locale, 'a11y.hiddenUnsafe')}</p> : null}
            {query && (domainSearch.status === 'ready' && domainSearch.hits.length === 0
              || domainSearch.status === 'error') ? <p className="mt-3 flex items-center gap-1 text-xs text-platform-fg-muted"><CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />{graphCopy(locale, domainSearch.status === 'error' ? 'search.failed' : 'search.empty')}</p> : null}
          </main>
          {selectedNodeKey ? <ActiveNodeDetail nodeKey={selectedNodeKey} fallbackNode={selectedNode} model={model} envelope={workspace.envelope} onShard={applyShard} onIdentityFailure={onIdentityFailure} onClose={closeDetail} compact={isCompactViewport} onActivateNeighbor={(key) => resolveNodeSelection(key, 'canvas')} locale={locale} pinned={runtimeLayout.pinnedNodeIds.has(selectedNodeKey)} onUnpin={() => runtimeLayout.unpinNode(selectedNodeKey)} /> : null}
        </div>
      )}
      <UniversalResourceViewerHost />
    </div>
  );
}
