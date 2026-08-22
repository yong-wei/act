'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import Image from 'next/image';
import {
  AlertTriangle,
  ChevronDown,
  CircleHelp,
  Crosshair,
  Loader2,
  Minus,
  Network,
  Plus,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';

import {
  ACTIVE_RESOURCE_BINDING_ROLES,
  type ActiveNodeDetailResponse,
} from './active-authority-graph-contracts';
import { BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import {
  activeModelRelationSummaries,
  activeNodeRelationSummaries,
  activeNodeSearch,
  createActiveAuthorityGraphModel,
  expandActiveAuthorityOneHop,
  materializeActiveNodeScope,
  presentActiveNodeType,
  presentActiveRelation,
  presentActiveHumanText,
  presentGovernanceLabel,
  presentSourceCitation,
  isPrimaryDomainObject,
  selectInitialPrimaryDomainScope,
  visibleActiveGraph,
  ACTIVE_GRAPH_NODE_LIMIT,
  type ActiveAuthorityGraphModel,
  type ActiveNodePresentation,
} from './active-authority-presentation';
import {
  createEmptyAuthorityShardWorkspace,
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
import type {
  AuthorityShardPublicEnvelope,
  AuthorityShardMembership,
  EngineeringRelationFamily,
} from '@/lib/authority-domain-shards/contracts';
import { REGISTERED_PEER_DOMAIN_IDS } from '@/lib/authority-domain-catalog/contracts';
import { ENGINEERING_RELATION_FAMILIES } from '@/lib/authority-domain-shards/contracts';
import {
  isPublicAuthorityLearnerShard,
  publicEnvelopesShareAuthorityAndCatalog,
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
  reviewedDomainHeaderCopy,
  shardUrl,
  totalCoverageCopy,
  visibleCoverageCopy,
} from './active-authority-graph-i18n';
import { ActiveAuthorityRootCanvas } from './active-authority-root-canvas';
import {
  KNOWLEDGE_NODE_LABEL_POLICY,
  layoutKnowledgeNodeLabel,
} from './graph/graph-presentation-contract';

interface ActiveAuthorityGraphProps {
  viewerRole: 'student' | 'teacher' | 'admin' | 'audit';
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
        if (selectedId) {
          const neighborhood = await fetchAuthorityShard(
            shardUrl(`/api/knowledge/shards/active/neighborhoods/${encodeURIComponent(selectedId)}`, locale),
            'node-neighborhood',
            controller.signal,
          );
          if (!applyRequired(neighborhood)) return;
          const detail = await fetchAuthorityShard(
            shardUrl(`/api/knowledge/shards/active/nodes/${encodeURIComponent(selectedId)}`, locale),
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
const ACTIVE_MOBILE_VIEWBOX = '0 0 320 520';
const ACTIVE_DESKTOP_VIEWBOX = '0 0 960 520';

export function layoutActiveAuthorityNodes(
  nodes: readonly Pick<ActiveNodePresentation, 'key'>[],
  compact = false,
): ReadonlyMap<string, Point> {
  const columns = compact
    ? Math.max(1, Math.min(2, nodes.length))
    : Math.max(1, Math.min(6, Math.max(Math.ceil(Math.sqrt(nodes.length)), Math.ceil(nodes.length / 4))));
  const columnGap = compact
    ? 164
    : columns === 6 ? 156 : columns === 5 ? 180 : 220;
  const rowGap = compact ? 112 : 120;
  const startX = compact
    ? (columns === 1 ? 160 : 78)
    : columns === 6 ? 88 : columns === 5 ? 120 : 130;
  const startY = compact ? 72 : 84;
  return new Map(nodes.map((node, index) => [node.key, {
    x: startX + (index % columns) * columnGap,
    y: startY + Math.floor(index / columns) * rowGap,
  }]));
}

function nodePolygon(shape: ActiveNodePresentation['type']['shape'], x: number, y: number): string | null {
  if (shape === 'diamond') return `${x},${y - ACTIVE_NODE_DIAMOND_HALF_HEIGHT} ${x + ACTIVE_NODE_DIAMOND_HALF_WIDTH},${y} ${x},${y + ACTIVE_NODE_DIAMOND_HALF_HEIGHT} ${x - ACTIVE_NODE_DIAMOND_HALF_WIDTH},${y}`;
  if (shape === 'hexagon') return `${x - ACTIVE_NODE_HEXAGON_HALF_WIDTH},${y - ACTIVE_NODE_HEXAGON_SLOPE_Y} ${x - ACTIVE_NODE_HEXAGON_SLOPE_X},${y - ACTIVE_NODE_HEXAGON_HALF_HEIGHT} ${x + ACTIVE_NODE_HEXAGON_SLOPE_X},${y - ACTIVE_NODE_HEXAGON_HALF_HEIGHT} ${x + ACTIVE_NODE_HEXAGON_HALF_WIDTH},${y - ACTIVE_NODE_HEXAGON_SLOPE_Y} ${x + ACTIVE_NODE_HEXAGON_HALF_WIDTH},${y + ACTIVE_NODE_HEXAGON_SLOPE_Y} ${x + ACTIVE_NODE_HEXAGON_SLOPE_X},${y + ACTIVE_NODE_HEXAGON_HALF_HEIGHT} ${x - ACTIVE_NODE_HEXAGON_SLOPE_X},${y + ACTIVE_NODE_HEXAGON_HALF_HEIGHT} ${x - ACTIVE_NODE_HEXAGON_HALF_WIDTH},${y + ACTIVE_NODE_HEXAGON_SLOPE_Y}`;
  return null;
}

function glyphHalfHeight(shape: ActiveNodeShape): number {
  if (shape === 'circle') return ACTIVE_NODE_CIRCLE_RADIUS;
  if (shape === 'diamond') return ACTIVE_NODE_DIAMOND_HALF_HEIGHT;
  if (shape === 'hexagon') return ACTIVE_NODE_HEXAGON_HALF_HEIGHT;
  return ACTIVE_NODE_RECT_HALF_HEIGHT;
}

function GraphNode({
  node,
  point,
  selected,
  onSelect,
  compact,
}: {
  node: ActiveNodePresentation;
  point: Point;
  selected: boolean;
  onSelect: (key: string, target: SVGGElement) => void;
  compact: boolean;
}) {
  const polygon = nodePolygon(node.type.shape, point.x, point.y);
  const accessibleName = `${node.label}，${node.type.label}`;
  const labelLayout = layoutKnowledgeNodeLabel(node.label);
  const labelY = point.y + glyphHalfHeight(node.type.shape) + 14;
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={accessibleName}
      aria-pressed={selected}
      data-active-authority-node={node.key}
      data-active-authority-node-shape={node.type.shape}
      onClick={(event) => onSelect(node.key, event.currentTarget)}
      onKeyDown={(event: KeyboardEvent<SVGGElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(node.key, event.currentTarget);
        }
      }}
      className="cursor-pointer outline-none focus-visible:ring-2"
    >
      <title>{accessibleName}</title>
      {polygon ? (
        <polygon points={polygon} fill={nodeFill(node, selected)} stroke={nodeStroke(node, selected)} strokeWidth={selected ? 3 : 2} />
      ) : node.type.shape === 'circle' ? (
        <circle cx={point.x} cy={point.y} r={ACTIVE_NODE_CIRCLE_RADIUS} fill={nodeFill(node, selected)} stroke={nodeStroke(node, selected)} strokeWidth={selected ? 3 : 2} />
      ) : (
        <rect x={point.x - ACTIVE_NODE_RECT_HALF_WIDTH} y={point.y - ACTIVE_NODE_RECT_HALF_HEIGHT} width={ACTIVE_NODE_RECT_HALF_WIDTH * 2} height={ACTIVE_NODE_RECT_HALF_HEIGHT * 2} rx={node.type.shape === 'rounded' ? ACTIVE_NODE_ROUNDED_RADIUS : ACTIVE_NODE_SQUARE_RADIUS} fill={nodeFill(node, selected)} stroke={nodeStroke(node, selected)} strokeWidth={selected ? 3 : 2} />
      )}
      <text
        data-active-authority-node-label="true"
        data-active-authority-node-label-placement="below"
        x={point.x}
        y={labelY}
        textAnchor="middle"
        fill="#e2e8f0"
        fontSize={compact ? 13 : 13}
        fontWeight="600"
      >
        {labelLayout.lines.map((line, index) => (
          <tspan
            key={`${line.text}-${index}`}
            x={point.x}
            dy={index === 0 ? 0 : KNOWLEDGE_NODE_LABEL_POLICY.lineHeight}
          >
            {line.text}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function GraphEdge({
  relation,
  source,
  target,
  sourceShape,
  targetShape,
  sourceLabel,
  targetLabel,
  compact,
  selected,
}: {
  relation: ActiveAuthorityGraphModel['relations'][number];
  source: Point;
  target: Point;
  sourceShape: ActiveNodeShape;
  targetShape: ActiveNodeShape;
  sourceLabel: string;
  targetLabel: string;
  compact: boolean;
  selected: boolean;
}) {
  const label = `${sourceLabel}，${relation.semantic.label}，${targetLabel}，${relation.semantic.directionLabel}`;
  const endpoints = activeAuthorityEdgeEndpoints(sourceShape, targetShape, source, target);
  const teachingRelation = relation.sourceRelation.layer === 'ACT_TEACHING';
  const edgeStroke = selected ? '#e2e8f0' : teachingRelation ? '#38bdf8' : '#64748b';
  return (
    <g
      data-active-authority-relation={relation.key}
      data-active-authority-relation-source={relation.sourceKey}
      data-active-authority-relation-target={relation.targetKey}
      data-active-authority-relation-selected={selected ? 'true' : 'false'}
      aria-label={label}
    >
      <title>{label}</title>
      {source.x === target.x && source.y === target.y ? (
        <path
          d={`M ${endpoints.source.x} ${endpoints.source.y} C ${source.x + 50} ${source.y - 72}, ${source.x + 72} ${source.y + 24}, ${endpoints.target.x} ${endpoints.target.y}`}
          fill="none"
          stroke={edgeStroke}
          strokeWidth={selected ? 3 : 2}
          strokeLinecap="round"
          strokeDasharray={teachingRelation ? undefined : '5 3'}
          markerEnd={relation.semantic.kind === 'directed' ? 'url(#active-authority-arrow)' : undefined}
        />
      ) : (
        <line
          x1={endpoints.source.x}
          y1={endpoints.source.y}
          x2={endpoints.target.x}
          y2={endpoints.target.y}
          stroke={edgeStroke}
          strokeWidth={selected ? 3 : 2}
          strokeLinecap="round"
          strokeDasharray={teachingRelation ? undefined : '5 3'}
          markerEnd={relation.semantic.kind === 'directed' ? 'url(#active-authority-arrow)' : undefined}
        />
      )}
      <text
        data-active-authority-relation-label="true"
        x={(source.x + target.x) / 2}
        y={(source.y + target.y) / 2 - 6}
        textAnchor="middle"
        fill="#94a3b8"
        fontSize={compact ? 11 : 10}
      >
        {relation.semantic.label}
      </text>
    </g>
  );
}

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
        <button
          type="button"
          onClick={onClose}
          aria-label={graphCopy(locale, 'inspector.close')}
          className="rounded-md border border-platform-border p-2 text-platform-fg-secondary hover:bg-platform-action-subtle"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
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
            <div className="text-lg font-semibold text-platform-fg-primary">{detailLabel}</div>
            <div className="mt-1 text-xs text-platform-fg-muted">{type.label}</div>
            <p className="mt-3 text-sm leading-6 text-platform-fg-secondary">
              {presentActiveHumanText(node?.description ?? fallbackNode?.description, graphCopy(locale, 'inspector.noDescription'))}
            </p>
            {node?.aliases && node.aliases.length > 0 ? (
              <p className="mt-2 text-xs text-platform-fg-muted">{graphCopy(locale, 'inspector.aliases')}{node.aliases.join('、')}</p>
            ) : null}
            {node?.mathematics?.state === 'available' ? (
              <div className="mt-3 overflow-x-auto text-platform-fg-primary" data-active-inspector-math="true">
                <BlockMath
                  math={node.mathematics.expression}
                  renderError={() => (
                    <p className="text-sm text-platform-fg-muted">{graphCopy(locale, 'inspector.mathUnavailable')}</p>
                  )}
                />
              </div>
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

function SearchResults({
  results,
  onSelect,
  locale,
}: {
  results: readonly ActiveNodePresentation[];
  onSelect: (key: string) => void;
  locale: AdmittedLocale;
}) {
  const [visibleCount, setVisibleCount] = useState(SEARCH_RESULT_PAGE_SIZE);
  if (results.length === 0) return null;
  const visibleResults = results.slice(0, Math.min(visibleCount, results.length));
  const remainingCount = results.length - visibleResults.length;
  return (
    <div className="mt-2 max-h-44 overflow-y-auto rounded-md border border-platform-border bg-platform-surface" data-active-search-results data-active-search-result-total={results.length}>
      <div className="border-b border-platform-border px-3 py-2 text-[11px] text-platform-fg-muted" role="status" aria-live="polite">
        {formatSearchShownCount(locale, visibleResults.length, results.length)}
      </div>
      {visibleResults.map((node) => (
        <button
          key={node.key}
          type="button"
          onClick={() => onSelect(node.key)}
          aria-label={`定位${node.label}`}
          data-active-authority-search-result={node.key}
          className="flex w-full items-center justify-between gap-2 border-b border-platform-border px-3 py-2 text-left text-xs last:border-b-0 hover:bg-platform-action-subtle"
        >
          <span className="truncate text-platform-fg-primary">{node.label}</span>
          <span className="shrink-0 text-platform-fg-muted">{node.type.label}</span>
        </button>
      ))}
      {remainingCount > 0 ? (
        <button
          type="button"
          onClick={() => setVisibleCount((current) => Math.min(results.length, current + SEARCH_RESULT_PAGE_SIZE))}
          aria-label={formatLoadMoreAria(locale, remainingCount)}
          data-active-authority-search-load-more
          className="w-full border-t border-platform-border px-3 py-2 text-left text-xs text-platform-action-primary hover:bg-platform-action-subtle"
        >
          {formatLoadMore(locale, remainingCount)}
        </button>
      ) : null}
    </div>
  );
}

export function ActiveAuthorityGraph({ viewerRole: _viewerRole }: ActiveAuthorityGraphProps) {
  const [retry, setRetry] = useState(0);
  const [locale, setLocale] = useState<AdmittedLocale>('zh-CN');
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);
  const {
    state,
    workspace,
    enterDomain,
    enableFamily,
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
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<SVGGElement | null>(null);
  const graphMainRef = useRef<HTMLElement | null>(null);
  const selectionIntentRef = useRef(0);
  const pendingCrossDomainSelectionRef = useRef<{ key: string; intent: number } | null>(null);
  const draggingRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const isCompactViewport = viewportWidth !== null && viewportWidth < 640;
  const visibleNodeLimit = isCompactViewport ? ACTIVE_MOBILE_NODE_LIMIT : ACTIVE_GRAPH_NODE_LIMIT;

  useEffect(() => {
    const updateViewportWidth = () => setViewportWidth(window.innerWidth);
    updateViewportWidth();
    window.addEventListener('resize', updateViewportWidth);
    return () => window.removeEventListener('resize', updateViewportWidth);
  }, []);

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
    if (pending && pending.intent === selectionIntentRef.current && model.nodeByKey.has(pending.key)) {
      setVisibleKeys(materializeActiveNodeScope(model, pending.key, visibleNodeLimit));
      setSelectedNodeKey(pending.key);
      pendingCrossDomainSelectionRef.current = null;
    } else {
      pendingCrossDomainSelectionRef.current = null;
      setVisibleKeys(selectInitialPrimaryDomainScope(model, visibleNodeLimit));
      setSelectedNodeKey(null);
    }
    setQuery('');
    setTypeFilter('');
    setZoom(1);
    setPan({ x: 0, y: 0 });
    // modelReady gates the first composed graph; later model identity changes
    // (family/neighborhood merges) must not reset selection, pan, or zoom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainEpoch, modelReady, visibleNodeLimit]);
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    if (!model) return;
    setVisibleKeys((current) => {
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
  }, [model, workspace.enabledFamilies.length]);

  useEffect(() => {
    if (!model || !selectedNodeKey) return;
    setVisibleKeys((current) => {
      const next = new Set(current);
      if (model.nodeByKey.has(selectedNodeKey)) next.add(selectedNodeKey);
      for (const relation of model.adjacency.get(selectedNodeKey) ?? []) {
        next.add(relation.sourceKey);
        next.add(relation.targetKey);
      }
      return next;
    });
  }, [model, selectedNodeKey]);

  useEffect(() => {
    if (!selectedNodeKey) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const key = selectedNodeKey;
      setSelectedNodeKey(null);
      window.setTimeout(() => restoreFocus(key), 0);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedNodeKey]);

  useEffect(() => {
    const main = graphMainRef.current;
    if (!main || !isCompactViewport || !selectedNodeKey) return;
    main.setAttribute('inert', '');
    return () => main.removeAttribute('inert');
  }, [isCompactViewport, selectedNodeKey]);

  const searchResults = useMemo(
    () => model ? activeNodeSearch(model, query, typeFilter || undefined) : [],
    [model, query, typeFilter],
  );
  const scopedGraph = useMemo(() => {
    if (!model) return null;
    const scoped = visibleActiveGraph(model, visibleKeys);
    if (!typeFilter) return scoped;
    const filteredKeys = new Set(scoped.nodes.filter((node) => node.type.canonicalType === typeFilter).map((node) => node.key));
    return visibleActiveGraph(model, filteredKeys);
  }, [model, typeFilter, visibleKeys]);
  const layout = useMemo(
    () => layoutActiveAuthorityNodes(scopedGraph?.nodes ?? [], isCompactViewport),
    [isCompactViewport, scopedGraph],
  );
  const selectedNode = selectedNodeKey && model ? model.nodeByKey.get(selectedNodeKey) : undefined;

  function resolveNodeSelection(key: string, mode: 'canvas' | 'search'): void {
    if (!model && !workspace.objectsByCanonicalId[key]) return;
    const intent = selectionIntentRef.current + 1;
    selectionIntentRef.current = intent;
    if (mode === 'search') {
      // The result button is removed when the query is cleared; restore focus
      // to the newly materialized semantic node or the canvas instead.
      triggerRef.current = null;
      setQuery('');
      setTypeFilter('');
    }

    const object = workspace.objectsByCanonicalId[key];
    const memberships = object?.memberships.filter((membership) => (
      workspace.root?.domains.some((domain) => domain.visualRole === membership.visualRole) ?? false
    )) ?? [];
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
      setVisibleKeys((current) => mode === 'search'
        ? materializeActiveNodeScope(model, key, visibleNodeLimit)
        : expandActiveAuthorityOneHop(model, current, key, visibleNodeLimit));
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

  function selectNode(key: string, target?: SVGGElement) {
    triggerRef.current = target ?? null;
    resolveNodeSelection(key, 'canvas');
  }

  function focusSearchResult(key: string) {
    resolveNodeSelection(key, 'search');
  }

  function followBoundary(nodeId: string) {
    triggerRef.current = null;
    resolveNodeSelection(nodeId, 'canvas');
  }

  function resetOverview() {
    selectionIntentRef.current += 1;
    pendingCrossDomainSelectionRef.current = null;
    resetDomain();
    setSelectedNodeKey(null);
    setQuery('');
    setTypeFilter('');
    triggerRef.current = null;
  }

  function closeDetail() {
    const key = selectedNodeKey;
    setSelectedNodeKey(null);
    window.setTimeout(() => restoreFocus(key), 0);
  }

  function restoreFocus(nodeKey: string | null) {
    if (triggerRef.current?.isConnected) {
      triggerRef.current.focus();
      return;
    }
    if (nodeKey) {
      for (const node of document.querySelectorAll<SVGGElement>('[data-active-authority-node]')) {
        if (node.dataset.activeAuthorityNode === nodeKey) {
          node.focus();
          return;
        }
      }
    }
    document.querySelector<HTMLElement>('[data-active-graph-stage]')?.focus();
  }

  function onStagePointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.target instanceof Element && event.target.closest('[data-active-authority-node]')) {
      draggingRef.current = null;
      return;
    }
    draggingRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function onStagePointerMove(event: PointerEvent<SVGSVGElement>) {
    const drag = draggingRef.current;
    if (!drag) return;
    setPan({ x: drag.panX + (event.clientX - drag.x), y: drag.panY + (event.clientY - drag.y) });
  }

  function onStagePointerUp() {
    draggingRef.current = null;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-platform-page text-platform-fg-primary" data-active-authority-graph="true" data-active-authority-consumer="engineering-graph" data-graph-locale={locale}>
      <header
        className="border-b border-platform-border bg-platform-surface/95 px-4 py-3 max-[639px]:pt-14 max-[639px]:pb-2"
        data-active-authority-header="true"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold" data-active-authority-title="true">{graphCopy(locale, 'title.graph')}</h2>
              <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-100">{graphCopy(locale, 'badge.engineering')}</span>
            </div>
            <p className="mt-1 text-xs text-platform-fg-secondary">{graphCopy(locale, 'subtitle.graph')}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div
              role="group"
              aria-label={graphCopy(locale, 'language.group')}
              data-graph-language-switch="true"
              className="flex rounded-md border border-platform-border p-0.5"
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
              <p data-graph-language-unavailable="en" className="max-w-56 text-right text-[11px] text-platform-fg-muted">
                {languageState.englishUnavailableReason}
              </p>
            )}
          {workspace.root ? (
            <div className="text-right text-xs text-platform-fg-secondary">
              <div>{reviewedDomainHeaderCopy(locale, workspace.root.domains.length)}</div>
              <div className="mt-1 text-emerald-200">
                {teachingCoverage?.note ?? graphCopy(locale, 'legend.teachingUnpublished')}
              </div>
            </div>
          ) : null}
          </div>
        </div>
      </header>

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
        <div className="flex min-h-0 flex-1 flex-col">
          <p className="px-4 pt-3 text-sm text-platform-fg-secondary">{graphCopy(locale, 'root.chooseDomain')}</p>
          <ActiveAuthorityRootCanvas
            catalog={workspace.root}
            onEnterDomain={(visualRole) => {
              void enterDomain(visualRole);
            }}
          />
        </div>
      ) : !model || !scopedGraph ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <div><Network className="mx-auto h-7 w-7 text-platform-fg-muted" aria-hidden="true" /><p className="mt-3 text-sm text-platform-fg-secondary">{graphCopy(locale, 'empty.domain')}</p><p className="mt-1 text-xs text-platform-fg-muted">{graphCopy(locale, 'empty.noLegacyFallback')}</p></div>
        </div>
      ) : (
        <div className="relative min-h-0 flex-1">
          <main ref={graphMainRef} className="min-h-0 h-full overflow-y-auto p-4" aria-label={graphCopy(locale, 'a11y.graph')} data-active-authority-main="true">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3" data-active-authority-toolbar="true">
              <div className="min-w-[15rem] flex-1">
                <label className="sr-only" htmlFor="active-authority-search">{graphCopy(locale, 'search.label')}</label>
                <div className="relative max-[639px]:shrink-0">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-platform-fg-muted" aria-hidden="true" />
                  <input id="active-authority-search" value={query} onChange={(event) => setQuery(event.target.value)} onInput={(event) => setQuery(event.currentTarget.value)} placeholder={graphCopy(locale, 'search.placeholder')} className="w-full rounded-md border border-platform-border bg-platform-canvas-muted py-2 pl-9 pr-3 text-sm text-platform-fg-primary outline-none focus:ring-2 focus:ring-platform-action-primary" />
                </div>
                {query || typeFilter ? <SearchResults key={`${typeFilter}\u0000${query}`} results={searchResults} onSelect={focusSearchResult} locale={locale} /> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 max-[639px]:w-full max-[639px]:flex-nowrap max-[639px]:overflow-x-auto max-[639px]:pb-1">
                <label className="sr-only" htmlFor="active-authority-type-filter">{graphCopy(locale, 'filter.type')}</label>
                <div className="relative">
                  <select
                    id="active-authority-type-filter"
                    aria-label={graphCopy(locale, 'filter.type')}
                    value={typeFilter}
                    onChange={(event) => {
                      const value = event.target.value;
                      setTypeFilter(value);
                      if (value === 'Formula' || value === 'KnowledgeStatement') {
                        setVisibleKeys((current) => new Set([
                          ...current,
                          ...model.nodes.filter((node) => node.type.canonicalType === value).map((node) => node.key),
                        ]));
                      }
                    }}
                    className="appearance-none rounded-md border border-platform-border bg-platform-canvas-muted py-2 pl-3 pr-8 text-xs text-platform-fg-secondary"
                  >
                    <option value="">{graphCopy(locale, 'filter.allTypes')}</option>
                    {model.nodes.reduce<string[]>((types, node) => types.includes(node.type.canonicalType) ? types : [...types, node.type.canonicalType], []).sort().map((canonicalType) => <option key={canonicalType} value={canonicalType}>{model.nodes.find((node) => node.type.canonicalType === canonicalType)?.type.label ?? presentActiveNodeType(canonicalType).label}</option>)}
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
                      onClick={() => enableFamily(family)}
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
                <button type="button" onClick={resetOverview} className="inline-flex items-center gap-1 rounded-md border border-platform-border px-2.5 py-2 text-xs text-platform-fg-secondary hover:bg-platform-action-subtle max-[639px]:shrink-0"><Crosshair className="h-3.5 w-3.5" aria-hidden="true" />{graphCopy(locale, 'controls.returnDomain')}</button>
              </div>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-platform-fg-secondary max-[639px]:flex-nowrap max-[639px]:overflow-x-auto max-[639px]:pb-1" data-authority-relation-legend="true">
              <span className="inline-flex items-center gap-1"><span aria-hidden="true" className="h-px w-6 bg-sky-300" />{graphCopy(locale, 'legend.teachingOrder')}</span>
              <span className="inline-flex items-center gap-1"><span aria-hidden="true" className="h-px w-6 border-t border-dashed border-slate-400" />{graphCopy(locale, 'legend.engineering')}</span>
              <span data-authority-teaching-coverage="true">{teachingCoverage?.note ?? graphCopy(locale, 'legend.teachingUnavailable')}</span>
            </div>
            {boundaryCues.length > 0 ? (
              <section className="mb-3 rounded-lg border border-platform-border bg-platform-canvas-muted p-3" aria-labelledby="active-authority-boundaries">
                <h3 id="active-authority-boundaries" className="text-xs font-semibold text-platform-fg-primary">{graphCopy(locale, 'boundary.title')}</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {boundaryCues.map((cue) => (
                    <button
                      key={cue.key}
                      type="button"
                      data-authority-boundary-node={cue.nodeId}
                      onClick={() => followBoundary(cue.nodeId)}
                      className="rounded-md border border-platform-border px-2.5 py-1.5 text-left text-xs text-platform-fg-secondary hover:bg-platform-action-subtle"
                    >
                      {boundaryEnterCopy(locale, cue.domainName, cue.objectLabel, cue.relationLabel)}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-platform-fg-muted max-[639px]:flex-nowrap max-[639px]:overflow-x-auto max-[639px]:pb-1">
              <span>{visibleCoverageCopy(locale, scopedGraph.nodes.length, scopedGraph.relations.length)}</span>
              <span>{totalCoverageCopy(locale, model.totalNodeCount, model.totalRelationCount)}</span>
            </div>
            {selectedNodeKey && neighborhoodFailures[selectedNodeKey] ? (
              <div role="alert" aria-live="polite" data-authority-neighborhood-failure={selectedNodeKey} className="mb-2 flex items-center justify-between gap-2 rounded-md border border-red-400/35 bg-red-400/10 px-3 py-2 text-xs text-red-100">
                <span>{neighborhoodFailures[selectedNodeKey]}</span>
                <button
                  type="button"
                  onClick={() => requestNeighborhood(selectedNodeKey)}
                  data-authority-neighborhood-retry={selectedNodeKey}
                  className="shrink-0 underline underline-offset-2"
                >{graphCopy(locale, 'error.retryNeighborhood')}</button>
              </div>
            ) : null}
            <div className="relative overflow-hidden rounded-xl border border-platform-border bg-[#07111f]" data-active-graph-stage="authority" tabIndex={-1}>
              <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-md border border-platform-border bg-platform-surface/90 p-1">
                <button type="button" aria-label={graphCopy(locale, 'controls.zoomOut')} onClick={() => setZoom((value) => Math.max(0.65, Number((value - 0.15).toFixed(2))))} className="rounded p-1.5 text-platform-fg-secondary hover:bg-platform-action-subtle"><Minus className="h-3.5 w-3.5" aria-hidden="true" /></button>
                <span className="min-w-10 text-center text-[10px] text-platform-fg-muted">{Math.round(zoom * 100)}%</span>
                <button type="button" aria-label={graphCopy(locale, 'controls.zoomIn')} onClick={() => setZoom((value) => Math.min(1.75, Number((value + 0.15).toFixed(2))))} className="rounded p-1.5 text-platform-fg-secondary hover:bg-platform-action-subtle"><Plus className="h-3.5 w-3.5" aria-hidden="true" /></button>
                <button type="button" aria-label={graphCopy(locale, 'controls.zoomReset')} onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="rounded p-1.5 text-platform-fg-secondary hover:bg-platform-action-subtle"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /></button>
              </div>
              <svg
                data-active-authority-svg="true"
                data-active-authority-viewport={isCompactViewport ? 'compact' : 'default'}
                data-active-authority-node-limit={visibleNodeLimit}
                viewBox={isCompactViewport ? ACTIVE_MOBILE_VIEWBOX : ACTIVE_DESKTOP_VIEWBOX}
                className="h-[min(60vh,520px)] min-h-[23rem] w-full touch-none"
                role="application"
                aria-label={graphCopy(locale, 'a11y.canvas')}
                onPointerDown={onStagePointerDown}
                onPointerMove={onStagePointerMove}
                onPointerUp={onStagePointerUp}
                onPointerCancel={onStagePointerUp}
              >
                <defs><marker id="active-authority-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#94a3b8" /></marker></defs>
                <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
                  {scopedGraph.relations.map((relation) => {
                    const source = layout.get(relation.sourceKey);
                    const target = layout.get(relation.targetKey);
                    const sourceNode = model.nodeByKey.get(relation.sourceKey);
                    const targetNode = model.nodeByKey.get(relation.targetKey);
                    return source && target && sourceNode && targetNode
                      ? <GraphEdge
                        key={relation.key}
                        relation={relation}
                        source={source}
                        target={target}
                        sourceShape={sourceNode.type.shape}
                        targetShape={targetNode.type.shape}
                        sourceLabel={sourceNode.label}
                        targetLabel={targetNode.label}
                        compact={isCompactViewport}
                        selected={Boolean(selectedNodeKey && (selectedNodeKey === relation.sourceKey || selectedNodeKey === relation.targetKey))}
                      />
                      : null;
                  })}
                  {scopedGraph.nodes.map((node) => {
                    const point = layout.get(node.key);
                    return point ? <GraphNode key={node.key} node={node} point={point} selected={selectedNodeKey === node.key} onSelect={selectNode} compact={isCompactViewport} /> : null;
                  })}
                </g>
              </svg>
              {scopedGraph.nodes.length === 1 && scopedGraph.relations.length === 0 ? <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-platform-fg-muted">{graphCopy(locale, 'empty.noPublishedRelation')}</div> : null}
            </div>
            {model.omittedNodeCount > 0 || model.omittedRelationCount > 0 ? <p className="mt-2 text-xs text-platform-fg-muted">{graphCopy(locale, 'a11y.hiddenUnsafe')}</p> : null}
            {searchResults.length === 0 && (query || typeFilter) ? <p className="mt-3 flex items-center gap-1 text-xs text-platform-fg-muted"><CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />{graphCopy(locale, 'search.empty')}</p> : null}
          </main>
          {selectedNodeKey ? <ActiveNodeDetail nodeKey={selectedNodeKey} fallbackNode={selectedNode} model={model} envelope={workspace.envelope} onShard={applyShard} onIdentityFailure={onIdentityFailure} onClose={closeDetail} compact={isCompactViewport} onActivateNeighbor={(key) => resolveNodeSelection(key, 'canvas')} locale={locale} /> : null}
        </div>
      )}
    </div>
  );
}
