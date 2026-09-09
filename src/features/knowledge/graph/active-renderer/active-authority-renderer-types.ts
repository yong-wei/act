import type { KnowledgeNodeData, KnowledgeLinkData } from '../../knowledge-graph-system';
import type { RefObject } from 'react';
import type { GraphDimension } from '../../graph-runtime-session';
import type { KnowledgeGraphLayoutState } from '../layout-state';
import type { KnowledgeGraphFitRequest } from '../root-layout';
import type { ActiveAuthorityLabelLayerHandle } from './active-authority-label-layer';
import type {
  ActiveAuthorityLabelDescriptor,
  ActiveAuthorityLayoutNode,
  ActiveAuthorityLayoutSessions,
} from './active-authority-geometry';

export interface ActiveAuthorityCameraPose {
  viewport?: { width: number; height: number };
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  up: { x: number; y: number; z: number };
}

export interface ActiveAuthorityRendererProps {
  kind: 'root' | 'domain';
  dimension: GraphDimension;
  nodes: readonly KnowledgeNodeData[];
  links: readonly KnowledgeLinkData[];
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  onNodeClick: (node: KnowledgeNodeData) => void;
  onBackgroundClick?: () => void;
  onNodeHover: (node: KnowledgeNodeData | null) => void;
  onNodeDragEnd: (node: KnowledgeNodeData) => void;
  layoutState: KnowledgeGraphLayoutState;
  layoutSessions?: ActiveAuthorityLayoutSessions;
  fitViewRequest: KnowledgeGraphFitRequest;
  relayoutVersion: number;
  engineReheatRevision: number;
  autoFitScopeKey: string;
  autoFitReady: boolean;
  autoFitConsumed: boolean;
  autoFitCameraManipulated: boolean;
  restoredCameraPose?: ActiveAuthorityCameraPose | null;
  onAutoFitConsumed: (scopeKey: string) => void;
  onCameraManipulation: (scopeKey: string) => void;
  onCameraPoseChange: (scopeKey: string, pose: ActiveAuthorityCameraPose) => void;
  canvasAriaLabel: string;
  onEngineSettled?: () => void;
}

export interface ActiveAuthorityGraphProps {
  kind: 'root' | 'domain';
  dimension: GraphDimension;
  nodes: readonly ActiveAuthorityLayoutNode[];
  links: readonly KnowledgeLinkData[];
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  onNodeClick: (node: KnowledgeNodeData) => void;
  onBackgroundClick?: () => void;
  onNodeHover: (node: KnowledgeNodeData | null) => void;
  onNodeDragEnd: (node: KnowledgeNodeData) => void;
  fitViewRequest: KnowledgeGraphFitRequest;
  relayoutVersion: number;
  engineReheatRevision: number;
  autoFitScopeKey: string;
  autoFitReady: boolean;
  autoFitConsumed: boolean;
  autoFitCameraManipulated: boolean;
  restoredCameraPose?: ActiveAuthorityCameraPose | null;
  onAutoFitConsumed: (scopeKey: string) => void;
  onCameraManipulation: (scopeKey: string) => void;
  onCameraPoseChange: (scopeKey: string, pose: ActiveAuthorityCameraPose) => void;
  onEngineSettled?: () => void;
  labelLayerRef: RefObject<ActiveAuthorityLabelLayerHandle | null>;
  labels: readonly ActiveAuthorityLabelDescriptor[];
  width: number;
  height: number;
}
