'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MutableRefObject } from 'react';
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
  mergeAuthorityShard,
  completeAuthorityLocaleRefresh,
  resetAuthorityShardDomain,
  shardIdentityDrift,
  visibleAuthorityShardRelations,
  type AuthorityShardWorkspaceState,
  type IncomingAuthorityShard,
} from './active-authority-shard-store';
import { ActiveAuthorityRuntimeView } from './active-authority-runtime-view';
import { GovernedFormulaLabel } from './graph/semantic-label-layer';
import { KnowledgeWorkspaceChromePortal } from './graph/knowledge-workspace-chrome';
import { useKnowledgeGraphRuntimeLayout } from './graph/use-knowledge-graph-runtime-layout';
import { KNOWLEDGE_GRAPH_COMPACT_MAX_WIDTH } from './graph/viewport-fit';
import {
  createAuthorityGraphViewModel,
  defaultEnabledTeachingFamilies,
} from './authority-graph-view-model';
import type { GraphDimension } from './graph-runtime-session';
import {
  AUTHORITY_DOMAIN_SEARCH_CONTRACT,
  type AuthorityShardPublicEnvelope,
  type AuthorityShardMembership,
  type AuthorityDomainSearchHit,
  type EngineeringRelationFamily,
} from '@/lib/authority-domain-shards/contracts';
import { REGISTERED_PEER_DOMAIN_IDS } from '@/lib/authority-domain-catalog/contracts';
import { ENGINEERING_RELATION_FAMILIES } from '@/lib/authority-domain-shards/contracts';
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
  boundaryEnterCopy,
  familyLabel,
  formatLoadMore,
  formatLoadMoreAria,
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
  | { status: 'error'; message: string };

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

  constructor(status: number) {
    super(errorMessage(status));
    this.name = 'AuthorityShardFetchError';
    this.status = status;
  }
}

function isIdentityFailure(error: unknown): boolean {
  return error instanceof AuthorityShardFetchError && error.status === 409;
}

function isShardClass<T extends IncomingAuthorityShard['shardClass']>(
  value: unknown,
  shardClass: T,
): value is Extract<IncomingAuthorityShard, { shardClass: T }> {
  return isPublicAuthorityLearnerShard(value) && value.shardClass === shardClass;
}

async function fetchAuthorityShard(
  url: string,
  shardClass: IncomingAuthorityShard['shardClass'],
  signal: AbortSignal,
): Promise<IncomingAuthorityShard> {
  const response = await fetch(url, { signal, headers: { accept: 'application/json' } });
  if (!response.ok) throw new AuthorityShardFetchError(response.status);
  const payload: unknown = await response.json();
  if (!isShardClass(payload, shardClass)) {
    throw new Error('当前知识图谱响应身份校验失败，已停止显示。');
  }
  return payload as IncomingAuthorityShard;
}

function useActiveAuthorityWorkspace(retry: number, locale: AdmittedLocale): {
  state: WorkspaceLoadState;
  workspace: AuthorityShardWorkspaceState;
  enterDomain: (visualRole: string) => Promise<boolean>;
  enableFamily: (family: EngineeringRelationFamily) => void;
  disableFamily: (family: EngineeringRelationFamily) => void;
  familyFailures: Partial<Record<EngineeringRelationFamily, string>>;
  requestNeighborhood: (nodeId: string) => void;
  neighborhoodFailures: Record<string, string>;
  resetDomain: () => void;
  applyShard: (shard: IncomingAuthorityShard, generation?: number, domainRevision?: number) => boolean;
  onIdentityFailure: () => void;
} {
  const [state, setState] = useState<WorkspaceLoadState>({ status: 'loading' });
  const [workspace, setWorkspace] = useState<AuthorityShardWorkspaceState>(createEmptyAuthorityShardWorkspace);
  const [familyFailures, setFamilyFailures] = useState<Partial<Record<EngineeringRelationFamily, string>>>({});
  const [neighborhoodFailures, setNeighborhoodFailures] = useState<Record<string, string>>({});
  const workspaceRef = useRef(workspace);
  const requestGenerationRef = useRef(0);
  const requestControllersRef = useRef(new Set<AbortController>());
  const failClosedRef = useRef(false);
  const localeRef = useRef(locale);
  localeRef.current = locale;
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
    setState({ status: 'error', message: errorMessage(409, locale) });
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
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : graphCopy(locale, 'error.domainShard'),
        });
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
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : graphCopy(locale, 'error.generic'),
        });
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
    if (current.selectedLocale === locale) return;
    const visualRole = current.activeVisualRole;
    const families = [...current.enabledFamilies];
    const selectedId = current.selectedCanonicalId;
    const loadedNodeIds = [...new Set([
      ...current.loadedShardKeys
        .filter((key) => key.startsWith('node-neighborhood:') || key.startsWith('node-detail:'))
        .map((key) => key.slice(key.indexOf(':') + 1)),
      ...selectedId ? [selectedId] : [],
    ])];
    updateWorkspace((workspace) => ({ ...workspace, selectedLocale: locale }));
    const generation = nextRequestGeneration();
    const domainRevision = current.domainRevision;
    const controller = new AbortController();
    const requestControllers = requestControllersRef.current;
    requestControllers.add(controller);
    fetchAuthorityShard(shardUrl('/api/knowledge/shards/active', locale), 'root', controller.signal)
      .then(async (shard) => {
        const applyRequired = (next: IncomingAuthorityShard): boolean => (
          applyShard(next, generation, domainRevision) && !controller.signal.aborted
        );
        if (!applyRequired(shard)) return;
        if (visualRole) {
          const domainOk = await fetchDomainDefault(visualRole, generation, domainRevision);
          if (!domainOk || controller.signal.aborted) return;
        }
        for (const family of families) {
          if (!visualRole) break;
          const familyShard = await fetchAuthorityShard(
            shardUrl(`/api/knowledge/shards/active/domains/${encodeURIComponent(visualRole)}/families/${encodeURIComponent(family)}`, locale),
            'relation-family',
            controller.signal,
          );
          if (!applyRequired(familyShard)) return;
        }
        for (const nodeId of loadedNodeIds) {
          const neighborhood = await fetchAuthorityShard(
            shardUrl(`/api/knowledge/shards/active/neighborhoods/${encodeURIComponent(nodeId)}`, locale),
            'node-neighborhood',
            controller.signal,
          );
          if (!applyRequired(neighborhood)) return;
          const detail = await fetchAuthorityShard(
            shardUrl(`/api/knowledge/shards/active/nodes/${encodeURIComponent(nodeId)}`, locale),
            'node-detail',
            controller.signal,
          );
          if (!applyRequired(detail)) return;
        }
        if (generation === requestGenerationRef.current) {
          updateWorkspace(completeAuthorityLocaleRefresh);
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isIdentityFailure(error)) return;
      })
      .finally(() => requestControllers.delete(controller));
    return () => {
      controller.abort();
      requestControllers.delete(controller);
    };
    // Locale changes refresh display only; retry remains the identity reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, state.status]);

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
          [family]: error instanceof Error ? error.message : graphCopy(localeRef.current, 'error.familyShard'),
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
          [nodeId]: error instanceof Error ? error.message : graphCopy(localeRef.current, 'error.neighborhoodShard'),
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
          throw new AuthorityShardFetchError(response.status);
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
          setFailure(error instanceof Error ? error.message : '节点详情暂时无法加载。');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [nodeId, expectedEnvelope, locale]);

  return { detail, failure, loading };
}

function nodeFill(node: ActiveNodePresentation, selected: boolean): string {
  const colors: Record<string, string> = {
    cyan: selected ? '#155e75' : '#083344',
    violet: selected ? '#6d28d9' : '#312e81',
    amber: selected ? '#92400e' : '#451a03',
    emerald: selected ? '#047857' : '#064e3b',
    blue: selected ? '#1d4ed8' : '#172554',
    muted: '#334155',
  };
  return colors[node.type.tone] ?? colors.muted;
}

function nodeStroke(node: ActiveNodePresentation, selected: boolean): string {
  if (selected) return '#f8fafc';
  const colors: Record<string, string> = {
    cyan: '#22d3ee',
    violet: '#a78bfa',
    amber: '#fbbf24',
    emerald: '#34d399',
    blue: '#60a5fa',
    muted: '#94a3b8',
  };
  return colors[node.type.tone] ?? colors.muted;
}

interface Point {
  x: number;
  y: number;
}

type ActiveNodeShape = ActiveNodePresentation['type']['shape'];

const ACTIVE_NODE_CIRCLE_RADIUS = 18;
const ACTIVE_NODE_RECT_HALF_WIDTH = 26;
const ACTIVE_NODE_RECT_HALF_HEIGHT = 16;
const ACTIVE_NODE_DIAMOND_HALF_WIDTH = 24;
const ACTIVE_NODE_DIAMOND_HALF_HEIGHT = 16;
const ACTIVE_NODE_HEXAGON_HALF_WIDTH = 24;
const ACTIVE_NODE_HEXAGON_SLOPE_X = 12;
const ACTIVE_NODE_HEXAGON_SLOPE_Y = 12;
const ACTIVE_NODE_HEXAGON_HALF_HEIGHT = 18;
const ACTIVE_NODE_ROUNDED_RADIUS = 12;
const ACTIVE_NODE_SQUARE_RADIUS = 5;

function polygonBoundaryPoint(center: Point, direction: Point, vertices: readonly Point[]): Point {
  const epsilon = 1e-9;
  let closestScale = Number.POSITIVE_INFINITY;
  let closest: Point | null = null;
  for (let index = 0; index < vertices.length; index += 1) {
    const start = vertices[index];
    const end = vertices[(index + 1) % vertices.length];
    const edge = { x: end.x - start.x, y: end.y - start.y };
    const offset = { x: start.x - center.x, y: start.y - center.y };
    const denominator = direction.x * edge.y - direction.y * edge.x;
    if (Math.abs(denominator) <= epsilon) continue;
    const scale = (offset.x * edge.y - offset.y * edge.x) / denominator;
    const edgePosition = (offset.x * direction.y - offset.y * direction.x) / denominator;
    if (scale <= epsilon || edgePosition < -epsilon || edgePosition > 1 + epsilon || scale >= closestScale) continue;
    closestScale = scale;
    closest = {
      x: center.x + direction.x * scale,
      y: center.y + direction.y * scale,
    };
  }
  return closest ?? center;
}

function roundedRectBoundaryPoint(
  center: Point,
  direction: Point,
  halfWidth: number,
  halfHeight: number,
  radius: number,
): Point {
  const dx = direction.x;
  const dy = direction.y;
  const absoluteX = Math.abs(dx);
  const absoluteY = Math.abs(dy);
  if (absoluteX === 0 && absoluteY === 0) return center;
  if (radius <= 0) {
    const scale = Math.min(
      absoluteX === 0 ? Number.POSITIVE_INFINITY : halfWidth / absoluteX,
      absoluteY === 0 ? Number.POSITIVE_INFINITY : halfHeight / absoluteY,
    );
    return { x: center.x + dx * scale, y: center.y + dy * scale };
  }

  const horizontalCornerCenter = halfWidth - radius;
  const verticalCornerCenter = halfHeight - radius;
  const candidates: number[] = [];
  if (absoluteX > 0) {
    const scale = halfWidth / absoluteX;
    if (absoluteY * scale <= verticalCornerCenter + 1e-9) candidates.push(scale);
  }
  if (absoluteY > 0) {
    const scale = halfHeight / absoluteY;
    if (absoluteX * scale <= horizontalCornerCenter + 1e-9) candidates.push(scale);
  }

  const signX = dx < 0 ? -1 : 1;
  const signY = dy < 0 ? -1 : 1;
  const cornerCenter = {
    x: signX * horizontalCornerCenter,
    y: signY * verticalCornerCenter,
  };
  const radiusSquared = radius * radius;
  const quadraticA = (dx * dx + dy * dy) / radiusSquared;
  const quadraticB = -2 * (dx * cornerCenter.x + dy * cornerCenter.y) / radiusSquared;
  const quadraticC = (cornerCenter.x * cornerCenter.x + cornerCenter.y * cornerCenter.y) / radiusSquared - 1;
  const discriminant = quadraticB * quadraticB - 4 * quadraticA * quadraticC;
  if (discriminant >= 0) {
    const root = Math.sqrt(discriminant);
    for (const scale of [
      (-quadraticB - root) / (2 * quadraticA),
      (-quadraticB + root) / (2 * quadraticA),
    ]) {
      const x = dx * scale;
      const y = dy * scale;
      if (scale > 0 && signX * x >= horizontalCornerCenter - 1e-9 && signY * y >= verticalCornerCenter - 1e-9) {
        candidates.push(scale);
      }
    }
  }

  const scale = Math.min(...candidates.filter((candidate) => candidate > 0));
  if (!Number.isFinite(scale)) {
    const fallback = Math.min(
      absoluteX === 0 ? Number.POSITIVE_INFINITY : halfWidth / absoluteX,
      absoluteY === 0 ? Number.POSITIVE_INFINITY : halfHeight / absoluteY,
    );
    return { x: center.x + dx * fallback, y: center.y + dy * fallback };
  }
  return { x: center.x + dx * scale, y: center.y + dy * scale };
}

/** Return the boundary point reached from a node center toward another point. */
export function activeAuthorityNodeBoundaryPoint(
  shape: ActiveNodeShape,
  center: Point,
  toward: Point,
): Point {
  const direction = { x: toward.x - center.x, y: toward.y - center.y };
  if (shape === 'circle') {
    const length = Math.hypot(direction.x, direction.y);
    if (length === 0) return center;
    const scale = ACTIVE_NODE_CIRCLE_RADIUS / length;
    return { x: center.x + direction.x * scale, y: center.y + direction.y * scale };
  }
  if (shape === 'diamond') {
    return polygonBoundaryPoint(center, direction, [
      { x: center.x, y: center.y - ACTIVE_NODE_DIAMOND_HALF_HEIGHT },
      { x: center.x + ACTIVE_NODE_DIAMOND_HALF_WIDTH, y: center.y },
      { x: center.x, y: center.y + ACTIVE_NODE_DIAMOND_HALF_HEIGHT },
      { x: center.x - ACTIVE_NODE_DIAMOND_HALF_WIDTH, y: center.y },
    ]);
  }
  if (shape === 'hexagon') {
    return polygonBoundaryPoint(center, direction, [
      { x: center.x - ACTIVE_NODE_HEXAGON_HALF_WIDTH, y: center.y - ACTIVE_NODE_HEXAGON_SLOPE_Y },
      { x: center.x - ACTIVE_NODE_HEXAGON_SLOPE_X, y: center.y - ACTIVE_NODE_HEXAGON_HALF_HEIGHT },
      { x: center.x + ACTIVE_NODE_HEXAGON_SLOPE_X, y: center.y - ACTIVE_NODE_HEXAGON_HALF_HEIGHT },
      { x: center.x + ACTIVE_NODE_HEXAGON_HALF_WIDTH, y: center.y - ACTIVE_NODE_HEXAGON_SLOPE_Y },
      { x: center.x + ACTIVE_NODE_HEXAGON_HALF_WIDTH, y: center.y + ACTIVE_NODE_HEXAGON_SLOPE_Y },
      { x: center.x + ACTIVE_NODE_HEXAGON_SLOPE_X, y: center.y + ACTIVE_NODE_HEXAGON_HALF_HEIGHT },
      { x: center.x - ACTIVE_NODE_HEXAGON_SLOPE_X, y: center.y + ACTIVE_NODE_HEXAGON_HALF_HEIGHT },
      { x: center.x - ACTIVE_NODE_HEXAGON_HALF_WIDTH, y: center.y + ACTIVE_NODE_HEXAGON_SLOPE_Y },
    ]);
  }
  return roundedRectBoundaryPoint(
    center,
    direction,
    ACTIVE_NODE_RECT_HALF_WIDTH,
    ACTIVE_NODE_RECT_HALF_HEIGHT,
    shape === 'rounded' ? ACTIVE_NODE_ROUNDED_RADIUS : ACTIVE_NODE_SQUARE_RADIUS,
  );
}

export function activeAuthorityEdgeEndpoints(
  sourceShape: ActiveNodeShape,
  targetShape: ActiveNodeShape,
  source: Point,
  target: Point,
): { source: Point; target: Point } {
  const samePoint = source.x === target.x && source.y === target.y;
  return {
    source: activeAuthorityNodeBoundaryPoint(
      sourceShape,
      source,
      samePoint ? { x: source.x, y: source.y - 1 } : target,
    ),
    target: activeAuthorityNodeBoundaryPoint(
      targetShape,
      target,
      samePoint ? { x: target.x + 1, y: target.y + 1 } : source,
    ),
  };
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
              aria-label="解除固定，交还力学布局"
              className="rounded-md border border-platform-border px-2 py-2 text-xs text-platform-fg-secondary hover:bg-platform-action-subtle"
            >
              解除固定
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
                          item.availability === 'available' && item.launch.href ? (
                            <a
                              key={`${role}-${item.title}`}
                              href={item.launch.href}
                              data-active-resource-launch={item.launch.kind}
                              className="block rounded-md border border-platform-border bg-platform-canvas-muted px-2 py-1.5 text-xs text-platform-fg-primary hover:bg-platform-action-subtle"
                            >
                              {item.title}
                              <span className="ml-2 text-platform-fg-muted">{item.resourceKind}</span>
                            </a>
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
            <p className="mt-2 text-xs text-platform-fg-secondary">{presentSourceCitation(node?.sources)}</p>
          </section>
          {node?.governance ? (
            <section className="rounded-lg border border-platform-border bg-platform-canvas-muted p-3 text-xs text-platform-fg-secondary">
              <h3 className="font-semibold text-platform-fg-primary">{graphCopy(locale, 'inspector.governance')}</h3>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt>{graphCopy(locale, 'inspector.review')}</dt><dd>{presentGovernanceLabel(node.governance.reviewStatus)}</dd>
                <dt>{graphCopy(locale, 'inspector.publication')}</dt><dd>{presentGovernanceLabel(node.governance.publicationStatus)}</dd>
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
          aria-label={`定位${hit.mathematics?.state === 'available' ? hit.mathematics.accessibleLabel : hit.label}`}
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
  returnToRootRef,
  chromeHostRef,
  runtimeControlsRef,
}: ActiveAuthorityGraphProps) {
  const dimension = dimensionProp ?? '2d';
  const runtimeLayout = useKnowledgeGraphRuntimeLayout({ dimension });
  const [retry, setRetry] = useState(0);
  const [locale, setLocale] = useState<AdmittedLocale>('zh-CN');
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
    resetDomain,
    applyShard,
    onIdentityFailure,
  } = useActiveAuthorityWorkspace(retry, locale);
  const languageState = selectGraphLanguage(
    createGraphLanguageState(workspace.localeCapability),
    locale,
  );
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [boundaryDirectoryExpanded, setBoundaryDirectoryExpanded] = useState(false);
  const [mobileGraphControlsExpanded, setMobileGraphControlsExpanded] = useState(false);
  const graphMainRef = useRef<HTMLElement | null>(null);
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
    setBoundaryDirectoryExpanded(false);
    setMobileGraphControlsExpanded(false);
  }, [workspace.activeDomainId]);

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
  const latestCutoverReady = workspace.latestCutover?.ready === true
    && teachingCoverage?.note !== '教学关系暂不可用';
  const boundaryCues = useMemo(() => {
    if (!workspace.activeDomainId || !workspace.root) return [];
    const root = workspace.root;
    const knownBoundaryIds = new Set(Object.keys(workspace.boundaryRefsByCanonicalId));
    return visibleAuthorityShardRelations(workspace)
      .flatMap((relation) => {
        const source = workspace.objectsByCanonicalId[relation.sourceId];
        const target = workspace.objectsByCanonicalId[relation.targetId];
        const sourceInDomain = source?.memberships.some((membership) => membership.domainId === workspace.activeDomainId) ?? false;
        const targetInDomain = target?.memberships.some((membership) => membership.domainId === workspace.activeDomainId) ?? false;
        if (sourceInDomain === targetInDomain) return [];
        const boundary = sourceInDomain ? target : source;
        if (!boundary || !knownBoundaryIds.has(boundary.id)) return [];
        const membership = selectActiveAuthorityMembership(boundary.memberships, workspace.activeDomainId);
        const domain = membership
          ? root.domains.find((entry) => entry.visualRole === membership.visualRole)
          : undefined;
        if (!domain) return [];
        return [{
          key: `${relation.layer}:${relation.id}:${boundary.id}`,
          nodeId: boundary.id,
          domainName: domain.displayName,
          relationLabel: presentActiveRelation(relation.predicate, relation.direction, {
            label: relation.predicateLabel,
            directionLabel: relation.directionLabel,
          }).label,
          objectLabel: presentActiveHumanText(boundary.label, graphCopy(locale, 'inspector.nameUnavailable')),
        }];
      })
      .sort((left, right) => left.domainName.localeCompare(right.domainName) || left.objectLabel.localeCompare(right.objectLabel) || left.key.localeCompare(right.key));
  }, [workspace, locale]);

  const domainEpoch = `${workspace.envelope?.authorityCatalogVersion ?? ''}:${workspace.activeDomainId ?? ''}`;
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
    setVisibleKeys(isCompactViewport
      ? selectInitialPrimaryDomainScope(model, visibleNodeLimit)
      : selectAuthorityDomainOverviewScope(model, workspace.domainOverviewIds));
    setSelectedNodeKey(null);
    setQuery('');
    setTypeFilter('');
    // modelReady gates the first composed graph; later model identity changes
    // (family/neighborhood merges) must not reset selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainEpoch, modelReady, isCompactViewport, visibleNodeLimit, workspace.domainOverviewIds]);
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
  const searchQueryKey = `${workspace.activeDomainId ?? ''}\u0000${trimmedQuery}\u0000${typeFilter}`;
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
      const queryKey = `${workspace.activeDomainId ?? ''}\u0000${trimmedQuery}\u0000${typeFilter}`;
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
    const queryKey = `${workspace.activeDomainId ?? ''}\u0000${trimmedQuery}\u0000${typeFilter}`;
    const params = new URLSearchParams({ q: trimmedQuery, limit: String(SEARCH_RESULT_PAGE_SIZE) });
    if (typeFilter) params.set('type', typeFilter);
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
    if (!typeFilter) return scoped;
    const filteredKeys = new Set(scoped.nodes.filter((node) => node.type.canonicalType === typeFilter).map((node) => node.key));
    return visibleActiveGraph(model, filteredKeys);
  }, [model, typeFilter, visibleKeys]);
  const authorityView = useMemo(() => {
    if (!scopedGraph) return null;
    const haloIds = Object.keys(workspace.boundaryRefsByCanonicalId);
    return createAuthorityGraphViewModel({
      nodes: scopedGraph.nodes.map((row) => row.sourceNode),
      relations: scopedGraph.relations.map((row) => row.sourceRelation),
      crossDomainCanonicalIds: haloIds,
      enabledRelationFamilies: [
        ...defaultEnabledTeachingFamilies(),
        ...workspace.enabledFamilies,
      ],
    });
  }, [scopedGraph, workspace.boundaryRefsByCanonicalId, workspace.enabledFamilies]);
  const overviewDirectoryEntries = useMemo(() => {
    if (!model) return undefined;
    const entries = workspace.domainOverviewIds
      .map((id) => model.nodeByKey.get(id))
      .filter((node): node is NonNullable<typeof node> => node !== undefined)
      .map((node) => ({ id: node.key, label: node.label }));
    return entries.length > 0 ? entries : undefined;
  }, [model, workspace.domainOverviewIds]);
  const selectedNode = selectedNodeKey && model ? model.nodeByKey.get(selectedNodeKey) : undefined;
  const hoverPreview = hoveredNodeId && model?.nodeByKey.get(hoveredNodeId)
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
      setTypeFilter('');
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

  function resetOverview() {
    selectionIntentRef.current += 1;
    pendingCrossDomainSelectionRef.current = null;
    resetDomain();
    setSelectedNodeKey(null);
    setQuery('');
    setTypeFilter('');
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
    <div className="flex h-full min-h-0 flex-col bg-platform-page text-platform-fg-primary" data-active-authority-graph="true" data-active-authority-consumer="engineering-graph" data-latest-cutover-ready={latestCutoverReady ? 'true' : 'false'} data-graph-locale={locale}>
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
              onClick={() => setLocale(selectGraphLanguage(languageState, 'zh-CN').selectedLocale)}
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
              onClick={() => setLocale(selectGraphLanguage(languageState, 'en').selectedLocale)}
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
        </div>
      </div>

      {state.status === 'loading' ? (
        <div className="flex flex-1 items-center justify-center" role="status">
          <div className="text-center text-sm text-platform-fg-secondary"><Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin text-platform-action-primary" aria-hidden="true" />{graphCopy(locale, 'loading.graph')}</div>
        </div>
      ) : state.status === 'error' ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-md rounded-xl border border-red-400/35 bg-red-400/10 p-5 text-center" role="alert">
            <AlertTriangle className="mx-auto h-6 w-6 text-red-200" aria-hidden="true" />
            <p className="mt-3 text-sm text-red-50">{state.message}</p>
            <p className="mt-2 text-xs text-red-100/75">{graphCopy(locale, 'error.noOtherGraph')}</p>
            <button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-4 inline-flex items-center gap-2 rounded-md border border-red-200/40 px-3 py-2 text-sm text-red-50 hover:bg-red-100/10"><RotateCcw className="h-4 w-4" aria-hidden="true" />{graphCopy(locale, 'error.retryGraph')}</button>
          </div>
        </div>
      ) : state.status === 'ready' && workspace.root && !workspace.activeDomainId ? (
        <div className="flex min-h-0 flex-1 flex-col pt-12 max-[639px]:pt-14">
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
          <main ref={graphMainRef} className="relative flex min-h-0 h-full flex-col overflow-hidden pt-12 max-[639px]:p-2 max-[639px]:pt-14" aria-label={graphCopy(locale, 'a11y.graph')} data-active-authority-main="true">
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
              <div id="active-authority-mobile-tools" className="mt-2 flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-[15rem] flex-1">
                <label className="sr-only" htmlFor="active-authority-search">{graphCopy(locale, 'search.label')}</label>
                <div className="relative max-[639px]:shrink-0">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-platform-fg-muted" aria-hidden="true" />
                  <input id="active-authority-search" value={query} onChange={(event) => setQuery(event.target.value)} onInput={(event) => setQuery(event.currentTarget.value)} placeholder={graphCopy(locale, 'search.placeholder')} className="w-full rounded-md border border-platform-border bg-platform-canvas-muted py-2 pl-9 pr-3 text-sm text-platform-fg-primary outline-none focus:ring-2 focus:ring-platform-action-primary" />
                </div>
                {query || typeFilter ? <SearchResults key={searchQueryKey} state={domainSearch} onSelect={focusSearchResult} onLoadMore={loadMoreSearchResults} locale={locale} /> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 max-[639px]:w-full max-[639px]:flex-nowrap max-[639px]:overflow-x-auto max-[639px]:pb-1">
                {workspace.activeDomainId && runtimeLayout.pinnedNodeIds.size > 0 ? (
                  <button
                    type="button"
                    onClick={() => runtimeLayout.unpinNode()}
                    data-active-authority-unpin-all="true"
                    aria-label={`解除全部固定（${runtimeLayout.pinnedNodeIds.size} 个节点）`}
                    className="shrink-0 whitespace-nowrap rounded-md border border-platform-border px-2.5 py-2 text-xs text-platform-fg-secondary hover:bg-platform-action-subtle max-[639px]:shrink-0"
                  >
                    解除全部固定（{runtimeLayout.pinnedNodeIds.size}）
                  </button>
                ) : null}
                <label className="sr-only" htmlFor="active-authority-type-filter">{graphCopy(locale, 'filter.type')}</label>
                <div className="relative">
                  <select
                    id="active-authority-type-filter"
                    aria-label={graphCopy(locale, 'filter.type')}
                    value={typeFilter}
                    onChange={(event) => {
                      setTypeFilter(event.target.value);
                    }}
                    className="appearance-none rounded-md border border-platform-border bg-platform-canvas-muted py-2 pl-3 pr-8 text-xs text-platform-fg-secondary"
                  >
                    <option value="">{graphCopy(locale, 'filter.allTypes')}</option>
                    {knownActiveNodeTypes().map((type) => <option key={type.canonicalType} value={type.canonicalType}>{type.label}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-3.5 w-3.5 text-platform-fg-muted" aria-hidden="true" />
                </div>
                <span
                  data-authority-relation-family="teaching-order"
                  className="rounded-md border border-sky-300/50 bg-sky-400/10 px-2.5 py-2 text-xs text-sky-100 max-[639px]:shrink-0"
                >
                  {graphCopy(locale, 'filter.teachingOrder')}
                </span>
                {ENGINEERING_RELATION_FAMILIES.map((family) => {
                  const enabled = workspace.enabledFamilies.includes(family);
                  const failure = familyFailures[family];
                  return (
                    <div key={family} className="flex items-center gap-1 max-[639px]:shrink-0">
                    <button
                      type="button"
                      data-authority-relation-family={family}
                      data-authority-family-enabled={enabled ? 'true' : 'false'}
                      aria-pressed={enabled}
                      aria-label={failure ? `${familyLabel(locale, family)}${graphCopy(locale, 'filter.family.loadFailed')}` : undefined}
                      onClick={() => (enabled ? disableFamily(family) : enableFamily(family))}
                      className={`rounded-md border px-2.5 py-2 text-xs ${enabled ? 'border-platform-action-primary bg-platform-action-subtle text-platform-fg-primary' : 'border-platform-border text-platform-fg-secondary hover:bg-platform-action-subtle'}`}
                    >
                      {familyLabel(locale, family)}
                    </button>
                    {failure ? (
                      <span
                        role="alert"
                        aria-live="polite"
                        data-authority-family-failure={family}
                        className="max-w-44 text-[11px] text-red-200"
                      >
                        {failure}
                        <button
                          type="button"
                          onClick={() => enableFamily(family)}
                          aria-label={`${graphCopy(locale, 'filter.family.retry')}${familyLabel(locale, family)}`}
                          data-authority-family-retry={family}
                          className="ml-1 underline underline-offset-2"
                        >{graphCopy(locale, 'filter.family.retry')}</button>
                      </span>
                    ) : null}
                    </div>
                  );
                })}
              </div>
              </div>
              ) : null}
            </div>

            {graphControlsVisible ? (
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-platform-fg-secondary max-[639px]:flex-nowrap max-[639px]:overflow-x-auto max-[639px]:pb-1" data-authority-relation-legend="true">
              <span className="inline-flex items-center gap-1"><span aria-hidden="true" className="h-px w-6 bg-sky-300" />{graphCopy(locale, 'legend.teachingOrder')}</span>
              <span className="inline-flex items-center gap-1"><span aria-hidden="true" className="h-px w-6 border-t border-dashed border-slate-400" />{graphCopy(locale, 'legend.engineering')}</span>
              <span data-authority-teaching-coverage="true">{latestCutoverReady && teachingCoverage?.note === '教学关系暂不可用' ? null : (teachingCoverage?.note ?? graphCopy(locale, 'legend.teachingUnavailable'))}</span>
            </div>
            ) : null}
            </KnowledgeWorkspaceChromePortal>
            {boundaryCues.length > 0 ? (
              <section className="pointer-events-auto absolute left-3 right-3 top-14 z-20 rounded-lg border border-platform-border bg-platform-canvas-muted/95 p-3 max-[639px]:top-16 max-[639px]:p-2" aria-labelledby="active-authority-boundaries">
                <div className="flex items-center justify-between gap-2">
                  <h3 id="active-authority-boundaries" className="text-xs font-semibold text-platform-fg-primary max-[639px]:sr-only">{graphCopy(locale, 'boundary.title')}</h3>
                  <button
                    type="button"
                    data-active-authority-boundary-toggle="true"
                    aria-expanded={boundaryDirectoryExpanded}
                    aria-controls="active-authority-boundary-directory"
                    onClick={() => setBoundaryDirectoryExpanded((expanded) => !expanded)}
                    className="hidden items-center gap-1 text-xs font-semibold text-platform-fg-primary max-[639px]:inline-flex"
                  >
                    {graphCopy(locale, 'boundary.title')} ({boundaryCues.length})
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${boundaryDirectoryExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>
                </div>
                {(!isCompactViewport || boundaryDirectoryExpanded) ? (
                <div id="active-authority-boundary-directory" className="mt-2 flex flex-wrap gap-2 max-[639px]:flex-nowrap max-[639px]:overflow-x-auto max-[639px]:pb-1">
                  {boundaryCues.map((cue) => (
                    <button
                      key={cue.key}
                      type="button"
                      data-authority-boundary-node={cue.nodeId}
                      onClick={() => followBoundary(cue.nodeId)}
                      className="rounded-md border border-platform-border px-2.5 py-1.5 text-left text-xs text-platform-fg-secondary hover:bg-platform-action-subtle max-[639px]:max-w-64 max-[639px]:shrink-0 max-[639px]:truncate max-[639px]:whitespace-nowrap"
                    >
                      {boundaryEnterCopy(locale, cue.domainName, cue.objectLabel, cue.relationLabel)}
                    </button>
                  ))}
                </div>
                ) : null}
              </section>
            ) : null}

            <div className="pointer-events-none absolute bottom-2 left-3 right-3 z-10 mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-platform-fg-muted max-[639px]:hidden">
              <span>{visibleCoverageCopy(locale, scopedGraph.nodes.length, scopedGraph.relations.length)}</span>
              <span>{totalCoverageCopy(locale, model.totalNodeCount, model.totalRelationCount)}</span>
            </div>
            {selectedNodeKey && neighborhoodFailures[selectedNodeKey] ? (
              <div role="alert" aria-live="polite" data-authority-neighborhood-failure={selectedNodeKey} className="absolute left-3 right-3 top-14 z-20 mb-2 flex items-center justify-between gap-2 rounded-md border border-red-400/35 bg-red-400/10 px-3 py-2 text-xs text-red-100">
                <span>{neighborhoodFailures[selectedNodeKey]}</span>
                <button
                  type="button"
                  onClick={() => requestNeighborhood(selectedNodeKey)}
                  data-authority-neighborhood-retry={selectedNodeKey}
                  className="shrink-0 underline underline-offset-2"
                >{graphCopy(locale, 'error.retryNeighborhood')}</button>
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
                  showUnavailableTeachingDirectory={!latestCutoverReady && teachingCoverage?.note === '教学关系暂不可用'}
                  overviewCount={workspace.domainOverviewIds.length}
                  overviewEntries={overviewDirectoryEntries}
                  layout={runtimeLayout}
                  sessionKey={`active-domain:${workspace.activeDomainId ?? 'none'}`}
                />
              </div>
            ) : null}
            {scopedGraph.nodes.length === 1 && scopedGraph.relations.length === 0 ? <div className="pointer-events-none mt-2 text-center text-xs text-platform-fg-muted">{graphCopy(locale, 'empty.noPublishedRelation')}</div> : null}
            {model.omittedNodeCount > 0 || model.omittedRelationCount > 0 ? <p className="mt-2 text-xs text-platform-fg-muted">{graphCopy(locale, 'a11y.hiddenUnsafe')}</p> : null}
            {(query || typeFilter) && (domainSearch.status === 'ready' && domainSearch.hits.length === 0
              || domainSearch.status === 'error') ? <p className="mt-3 flex items-center gap-1 text-xs text-platform-fg-muted"><CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />{graphCopy(locale, domainSearch.status === 'error' ? 'search.failed' : 'search.empty')}</p> : null}
          </main>
          {selectedNodeKey ? <ActiveNodeDetail nodeKey={selectedNodeKey} fallbackNode={selectedNode} model={model} envelope={workspace.envelope} onShard={applyShard} onIdentityFailure={onIdentityFailure} onClose={closeDetail} compact={isCompactViewport} onActivateNeighbor={(key) => resolveNodeSelection(key, 'canvas')} locale={locale} pinned={runtimeLayout.pinnedNodeIds.has(selectedNodeKey)} onUnpin={() => runtimeLayout.unpinNode(selectedNodeKey)} /> : null}
        </div>
      )}
    </div>
  );
}
