import { useCallback, useRef, useState } from 'react';

import type { KnowledgeNodeData } from '../knowledge-graph-system';
import type { KnowledgeGraphCameraPose } from './knowledge-graph-canvas';
import type { KnowledgeGraphFitRequest } from './root-layout';
import {
  getEmptyKnowledgeGraphLayoutState,
  getKnowledgeGraphRuntimeNodePosition,
  storeKnowledgeGraphNodePosition,
  type KnowledgeGraphLayoutState,
} from './layout-state';

export function useKnowledgeGraphRuntimeLayout(options?: {
  initialFitTarget?: KnowledgeGraphFitRequest['target'];
}) {
  const [layoutState, setLayoutState] = useState(getEmptyKnowledgeGraphLayoutState);
  const [relayoutVersion, setRelayoutVersion] = useState(0);
  const [fitViewRequest, setFitViewRequest] = useState<KnowledgeGraphFitRequest>({
    id: 0,
    target: options?.initialFitTarget ?? 'current',
  });

  const handleNodeDragEnd = useCallback((node: KnowledgeNodeData) => {
    const runtimePosition = getKnowledgeGraphRuntimeNodePosition(
      node as KnowledgeNodeData & { x?: number; y?: number; z?: number },
    );
    if (!runtimePosition) return;
    setLayoutState((current) => storeKnowledgeGraphNodePosition(current, runtimePosition));
  }, []);

  const requestFitView = useCallback((target: KnowledgeGraphFitRequest['target'] = 'current') => {
    setFitViewRequest((current) => ({ id: current.id + 1, target }));
  }, []);

  const requestRelayout = useCallback(() => {
    setLayoutState((current) => ({
      version: current.version + 1,
      positionsByNodeId: {},
    }));
    setRelayoutVersion((current) => current + 1);
    setFitViewRequest((current) => ({ id: current.id + 1, target: 'current' }));
  }, []);

  return {
    layoutState,
    setLayoutState,
    relayoutVersion,
    fitViewRequest,
    handleNodeDragEnd,
    requestFitView,
    requestRelayout,
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
