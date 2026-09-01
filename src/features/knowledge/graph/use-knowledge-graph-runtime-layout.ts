import { useCallback, useMemo, useRef, useState, type SetStateAction } from 'react';

import type { GraphDimension } from '../graph-runtime-session';
import type { KnowledgeNodeData } from '../knowledge-graph-system';
import type { KnowledgeGraphCameraPose } from './knowledge-graph-canvas';
import type { KnowledgeGraphFitRequest } from './root-layout';
import {
  clearKnowledgeGraphLayoutPins,
  getEmptyKnowledgeGraphLayoutState,
  getKnowledgeGraphRuntimeNodePosition,
  removeKnowledgeGraphNodePin,
  storeKnowledgeGraphNodePosition,
  type KnowledgeGraphLayoutState,
} from './layout-state';

export type KnowledgeGraphDimensionLayoutStore = Record<GraphDimension, KnowledgeGraphLayoutState>;
export type KnowledgeGraphDimensionRelayoutStore = Record<GraphDimension, number>;

export function createEmptyDimensionLayoutStore(): KnowledgeGraphDimensionLayoutStore {
  return {
    '2d': getEmptyKnowledgeGraphLayoutState(),
    '3d': getEmptyKnowledgeGraphLayoutState(),
  };
}

export function createEmptyDimensionRelayoutStore(): KnowledgeGraphDimensionRelayoutStore {
  return { '2d': 0, '3d': 0 };
}

export function selectDimensionLayout(
  store: KnowledgeGraphDimensionLayoutStore,
  dimension: GraphDimension,
): KnowledgeGraphLayoutState {
  return store[dimension] ?? getEmptyKnowledgeGraphLayoutState();
}

export function writeDimensionLayout(
  store: KnowledgeGraphDimensionLayoutStore,
  dimension: GraphDimension,
  next: KnowledgeGraphLayoutState,
): KnowledgeGraphDimensionLayoutStore {
  if (store[dimension] === next) return store;
  return { ...store, [dimension]: next };
}

export function useKnowledgeGraphRuntimeLayout(options?: {
  initialFitTarget?: KnowledgeGraphFitRequest['target'];
  dimension?: GraphDimension;
}) {
  const dimension = options?.dimension ?? '2d';
  const [layoutByDimension, setLayoutByDimension] = useState(createEmptyDimensionLayoutStore);
  const [relayoutVersionByDimension, setRelayoutVersionByDimension] = useState(
    createEmptyDimensionRelayoutStore,
  );
  const [fitViewRequest, setFitViewRequest] = useState<KnowledgeGraphFitRequest>({
    id: 0,
    target: options?.initialFitTarget ?? 'current',
  });
  const layoutState = selectDimensionLayout(layoutByDimension, dimension);
  const relayoutVersion = relayoutVersionByDimension[dimension] ?? 0;

  const setLayoutState = useCallback((update: SetStateAction<KnowledgeGraphLayoutState>) => {
    setLayoutByDimension((current) => {
      const previous = selectDimensionLayout(current, dimension);
      const next = typeof update === 'function' ? update(previous) : update;
      return writeDimensionLayout(current, dimension, next);
    });
  }, [dimension]);

  const handleNodeDragEnd = useCallback((node: KnowledgeNodeData) => {
    const runtimePosition = getKnowledgeGraphRuntimeNodePosition(
      node as KnowledgeNodeData & { x?: number; y?: number; z?: number },
    );
    if (!runtimePosition) return;
    setLayoutByDimension((current) => writeDimensionLayout(
      current,
      dimension,
      storeKnowledgeGraphNodePosition(selectDimensionLayout(current, dimension), runtimePosition),
    ));
  }, [dimension]);

  const requestFitView = useCallback((target: KnowledgeGraphFitRequest['target'] = 'current') => {
    setFitViewRequest((current) => ({ id: current.id + 1, target }));
  }, []);

  const requestRelayout = useCallback(() => {
    // Manual reflow reseeds the automatic layout but must preserve every
    // explicit user pin (#1739 task 2.3); only the automatic settled
    // coordinates are regenerated.
    setLayoutByDimension((current) => {
      const previous = selectDimensionLayout(current, dimension);
      return writeDimensionLayout(current, dimension, {
        ...previous,
        version: previous.version + 1,
      });
    });
    setRelayoutVersionByDimension((current) => ({
      ...current,
      [dimension]: (current[dimension] ?? 0) + 1,
    }));
    setFitViewRequest((current) => ({ id: current.id + 1, target: 'current' }));
  }, [dimension]);

  const [engineReheatRevision, setEngineReheatRevision] = useState(0);
  const layoutStoreRef = useRef(layoutByDimension);
  layoutStoreRef.current = layoutByDimension;

  /**
   * Remove one explicit pin (or every pin) and return the affected nodes to
   * force ownership (#1739). Unrelated coordinates, pins and camera state
   * are untouched; the engine reheats so unpinned nodes visibly settle
   * again instead of freezing at their last pinned spot.
   */
  const unpinNode = useCallback((nodeId?: string) => {
    const previous = selectDimensionLayout(layoutStoreRef.current, dimension);
    const next = nodeId
      ? removeKnowledgeGraphNodePin(previous, nodeId)
      : clearKnowledgeGraphLayoutPins(previous);
    if (next === previous) return;
    layoutStoreRef.current = writeDimensionLayout(layoutStoreRef.current, dimension, next);
    setLayoutByDimension(() => layoutStoreRef.current);
    setEngineReheatRevision((revision) => revision + 1);
  }, [dimension]);

  const pinnedNodeIds = useMemo(
    () => new Set(Object.keys(layoutState.positionsByNodeId)),
    [layoutState],
  );

  return {
    layoutState,
    setLayoutState,
    relayoutVersion,
    fitViewRequest,
    handleNodeDragEnd,
    requestFitView,
    requestRelayout,
    unpinNode,
    pinnedNodeIds,
    engineReheatRevision,
  };
}

export function useKnowledgeGraphRuntimeCamera() {
  const cameraPoseByScopeRef = useRef(new Map<string, KnowledgeGraphCameraPose>());
  const [manipulatedAutoFitScopeKeys, setManipulatedAutoFitScopeKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [consumedAutoFitScopeKeys, setConsumedAutoFitScopeKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const handleCameraManipulation = useCallback((scopeKey: string) => {
    setManipulatedAutoFitScopeKeys((current) => {
      if (current.has(scopeKey)) return current;
      const next = new Set(current);
      next.add(scopeKey);
      return next;
    });
  }, []);

  const handleAutoFitConsumed = useCallback((scopeKey: string) => {
    setConsumedAutoFitScopeKeys((current) => {
      if (current.has(scopeKey)) return current;
      const next = new Set(current);
      next.add(scopeKey);
      return next;
    });
  }, []);

  const handleCameraPoseChange = useCallback((scopeKey: string, pose: KnowledgeGraphCameraPose) => {
    cameraPoseByScopeRef.current.set(scopeKey, pose);
  }, []);

  return {
    cameraPoseByScopeRef,
    manipulatedAutoFitScopeKeys,
    consumedAutoFitScopeKeys,
    handleCameraManipulation,
    handleAutoFitConsumed,
    handleCameraPoseChange,
  };
}

export type KnowledgeGraphRuntimeLayout = ReturnType<typeof useKnowledgeGraphRuntimeLayout>;

export function isMutableRuntimeLayout(state: KnowledgeGraphLayoutState): boolean {
  return typeof state.version === 'number' && typeof state.positionsByNodeId === 'object';
}
