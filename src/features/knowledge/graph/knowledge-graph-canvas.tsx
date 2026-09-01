'use client';

/**
 * KnowledgeGraphCanvas - 3D 知识图谱画布
 *
 * 使用 react-force-graph-3d 实现的力导向 3D 知识图谱
 * 支持自动布局、手动拖拽、节点标签始终显示
 */

import { useRef, useCallback, useMemo, useEffect, useLayoutEffect, useState, type PointerEvent } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import { GovernedRichText } from '@/components/shared/governed-rich-text';
import type { KnowledgeNodeData, KnowledgeLinkData } from '../knowledge-graph-system';
import {
  getNodeColor,
  getGlowColor,
  getKnowledgeConceptNodeShape,
  getKnowledgeGraphEdgeRenderModulation,
  getKnowledgeNodeScale,
  getKnowledgeSemanticRegionStyle,
  getKnowledgeNodeMaximumPresentationRadius,
  getKnowledgeGraphEffectiveEdgeOpacity,
  getKnowledgeGraphEffectiveEdgeWidth,
  hexToRgba,
  KNOWLEDGE_GRAPH_CANDIDATE_PRESENTATION,
  KNOWLEDGE_GRAPH_SEMANTIC_MAP_CONTRACT,
  KNOWLEDGE_ROOT_BUBBLE_VITALITY,
  type KnowledgeConceptNodeShape,
} from './visual-config';
import {
  attachActiveNodeDecorations3d,
  readActiveNodeDecoration,
} from './active-node-decoration';
import {
  getKnowledgeNodeLabelPresentation,
  type KnowledgeGraphLabelMode,
} from './label-policy';
import {
  markKnowledgeGraphAutomaticNodeAnchors,
  syncKnowledgeGraphMutableNodePositions,
  type KnowledgeGraphLayoutState,
} from './layout-state';
import {
  freezeKnowledgeGraphUnaffectedScope,
  releaseKnowledgeGraphFrozenScope,
  releaseKnowledgeGraphDragFrame,
  applyFocusedExpansionLayout,
  calculateFocusedExpansionRevealTranslation,
  commitKnowledgeGraphRelayoutVersion,
  createFocusedExpansionRevealSignature,
  resolveKnowledgeGraphRuntimeNodeCoordinates,
  resolveFocusedExpansionDepthByNodeId,
  resolveFocusedExpansionRevealTarget,
  selectFocusedExpansionGraphNodes,
  freezeKnowledgeGraphDragFrame,
  selectKnowledgeGraphReheatAffectedNodeIds,
  reheatKnowledgeGraphNewcomerScope,
  translateKnowledgeGraphCameraPose,
  type KnowledgeGraphPositionedNode,
} from './layout-engine';
import {
  KNOWLEDGE_FORCE_ALPHA_DECAY,
  KNOWLEDGE_FORCE_ALPHA_MIN,
  resolveKnowledgeForceLifecycle,
} from './force-lifecycle';
import {
  createKnowledgeGraphMotionScopeKey,
  bindKnowledgeGraphMotionEnvironment,
  createKnowledgeGraphRevealPlan,
  getKnowledgeGraphBreathingIntensity,
  getKnowledgeGraphEntranceFade,
  getKnowledgeGraphMotionMarkerFrame,
  getKnowledgeGraphMotionMarkerPlacement,
  getKnowledgeGraphMotionPhasedMarkerFrame,
  getKnowledgeGraphPresentationLinkOpacity,
  getKnowledgeGraphPresentationLinkProgress,
  getKnowledgeGraphPresentationNodeScale,
  getKnowledgeGraphPresentationNodeOpacity,
  IDLE_KNOWLEDGE_GRAPH_PRESENTATION,
  KnowledgeGraphMotionFrameLoop,
  KnowledgeGraphTransitionGate,
  KNOWLEDGE_GRAPH_MOTION_TRANSITION_EVENT,
  resolveFlowMarkerSet,
  type KnowledgeGraphPresentationState,
  KNOWLEDGE_GRAPH_MOTION,
  prefersReducedKnowledgeGraphMotion,
  selectKnowledgeGraphMotionMarkerEdgeIds,
} from './motion';
import {
  KNOWLEDGE_GRAPH_3D_DIRECTION_COLOR,
  KNOWLEDGE_GRAPH_3D_MARKER_COLOR,
  createKnowledgeGraphPresentationLinkGroup,
  disposeKnowledgeGraphPresentationLinkGroup,
  updateKnowledgeGraph3DLine,
  updateKnowledgeGraph3DMotionMarker,
} from './three-link-presentation';
import { KnowledgeGraphCameraTransition } from './camera-transition';
import {
  isKnowledgeCanvasPolylineHit,
  finishKnowledgeCanvasBlankGesture,
  moveKnowledgeCanvasBlankGesture,
  shouldDismissKnowledgeCanvasBlankGesture,
  startKnowledgeCanvasBlankGesture,
  type KnowledgeCanvasBlankGesture,
} from './canvas-dismissal';
import {
  KNOWLEDGE_ROOT_BUBBLE_STYLE,
  type KnowledgeGraphFitRequest,
  isCompactKnowledgeRootSet,
  packKnowledgeGraphRootNodes,
} from './root-layout';
import { buildKnowledgeTeachingOrderLayout } from './teaching-order-layout';
import {
  KNOWLEDGE_NODE_LABEL_POLICY,
  KNOWLEDGE_ROOT_MINIMUM_PROJECTION_SCALE,
  getKnowledgeGraph3DArrowLength,
  getKnowledgeGraph3DNodePresentationRadius,
  layoutKnowledgeNodeLabel,
  layoutKnowledgeRootLabel,
  getKnowledgeNodeLabelBounds,
} from './node-label-layout';
import {
  applyKnowledgeGraph3DControlsPolicy,
  normalizeKnowledgeRootCameraPose,
  getKnowledgeGraph3DControlsPolicy,
  getKnowledgeGraphViewportFit,
  getKnowledgeRootProjectionSafeCameraDistance,
  getKnowledgeGraphViewportSafeInsets,
  getKnowledgeProjectionScale,
  getPerspectiveCameraFitDistance,
  placeKnowledgeGraphLabels,
  projectKnowledgeWorldPoint,
  type KnowledgeViewportNode,
} from './viewport-fit';
import { getKnowledgeGraphEndpointArrow } from './edge-geometry';
import {
  buildKnowledgeGraphEdgeLaneCurvatures,
  createKnowledgeGraphRendererEdgePath,
  getKnowledgeGraphEdgeEmphasisState,
  getKnowledgeGraphEdgePresentation,
  getKnowledgeGraphNodeEmphasisOpacity,
  getKnowledgeGraphPartialEdgePath,
  getKnowledgeGraphPresentationLinkKey,
  getKnowledgeGraphPresentationFamily,
  selectKnowledgeGraphStructuralForegroundEdgeIds,
  sampleKnowledgeGraphEdgePath,
  type KnowledgeGraphSelectedCorridorEmphasis,
} from './edge-presentation';
import {
  installKnowledgeGraphTask74Snapshot,
  isKnowledgeGraphTask74PerformanceQa,
} from './performance-snapshot';

export interface KnowledgeGraphCameraPose {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  up: { x: number; y: number; z: number };
}

interface KnowledgeGraphCanvasProps {
  nodes: KnowledgeNodeData[];
  links: KnowledgeLinkData[];
  presentationLinks?: readonly KnowledgeLinkData[];
  selectedNode: KnowledgeNodeData | null;
  hoveredNode: KnowledgeNodeData | null;
  onNodeClick: (node: KnowledgeNodeData) => void;
  onNodeHover: (node: KnowledgeNodeData | null) => void;
  onNodeDragEnd: (node: KnowledgeNodeData) => void;
  onBackgroundClick?: () => void;
  labelMode: KnowledgeGraphLabelMode;
  layoutState: KnowledgeGraphLayoutState;
  fitViewRequest: KnowledgeGraphFitRequest;
  autoFitScopeKey?: string | null;
  autoFitReady?: boolean;
  autoFitConsumed?: boolean;
  autoFitCameraManipulated?: boolean;
  restoredCameraPose?: KnowledgeGraphCameraPose | null;
  onAutoFitConsumed?: (scopeKey: string) => void;
  onCameraManipulation?: (scopeKey: string) => void;
  onCameraPoseChange?: (scopeKey: string, pose: KnowledgeGraphCameraPose) => void;
  relayoutVersion: number;
  engineReheatRevision?: number;
  width?: number;
  height?: number;
  expandedNodeIds: readonly string[];
  expandedDirectLinks: readonly KnowledgeLinkData[];
  activationSequenceByCenterId: Readonly<Record<string, number>>;
  materializedNodeIds: readonly string[];
  graphVersion: string | null;
  lessonOrderNodeIds?: readonly string[];
  teachingOrderLinks?: readonly KnowledgeLinkData[];
  selectedCorridorEmphasis?: KnowledgeGraphSelectedCorridorEmphasis | null;
  collapsingNodeId?: string | null;
  onCollapsePresentationComplete?: (nodeId: string) => void;
}

const EMPTY_LESSON_ORDER_NODE_IDS: readonly string[] = [];

type RuntimeKnowledgeGraphNode = KnowledgeGraphPositionedNode & {
  vx?: number;
  vy?: number;
  vz?: number;
};

export function getKnowledgeGraphNodeVisualDataSignature(node: any): string {
  const rootPacking = node.__knowledgeRootPacking;
  return JSON.stringify([
    node.id,
    node.name,
    node.nodeType,
    node.knowledgeDim,
    node.bloomLevel,
    node.conceptKind,
    node.candidate === true,
    node.sourceCoverageCount ?? null,
    node.graphDegree,
    node.graphImportanceScore,
    node.importance,
    node.metadata,
    rootPacking ? {
      collisionRadius: rootPacking.collisionRadius,
      labelBounds: rootPacking.labelBounds,
    } : null,
  ]);
}

function disposeKnowledgeGraphObject3D(object: THREE.Object3D): void {
  const disposedGeometries = new Set<THREE.BufferGeometry>();
  const disposedMaterials = new Set<THREE.Material>();
  const disposedTextures = new Set<THREE.Texture>();
  object.traverse((child) => {
    const renderable = child as THREE.Mesh;
    if (renderable.geometry && !disposedGeometries.has(renderable.geometry)) {
      disposedGeometries.add(renderable.geometry);
      renderable.geometry.dispose();
    }
    const materials = Array.isArray(renderable.material)
      ? renderable.material
      : renderable.material ? [renderable.material] : [];
    materials.forEach((material) => {
      if (disposedMaterials.has(material)) return;
      disposedMaterials.add(material);
      const map = (material as THREE.Material & { map?: THREE.Texture | null }).map;
      if (map && !disposedTextures.has(map)) {
        disposedTextures.add(map);
        map.dispose();
      }
      material.dispose();
    });
  });
  const detachedOwnedChildren = object.userData.knowledgeOwnedChildren as THREE.Object3D[] | undefined;
  detachedOwnedChildren?.forEach((child) => {
    if (child.parent !== object) disposeKnowledgeGraphObject3D(child);
  });
  object.userData.knowledgeOwnedChildren = [];
}

function updateKnowledgeGraphNodeProjection(
  object: THREE.Group,
  labelPresentation: {
    scale: number;
    projectedScale: number;
    offsetX: number;
    offsetY: number;
    visible: boolean;
    fontSize: number;
  },
): void {
  const mesh = object.userData.knowledgeBodyMesh as THREE.Mesh | undefined;
  const naturalRadius = object.userData.knowledgeNaturalRadius as number | undefined;
  if (mesh && naturalRadius !== undefined) {
    const radius = object.userData.knowledgeIsRootBubble
      ? naturalRadius
      : getKnowledgeGraph3DNodePresentationRadius(
          naturalRadius,
          labelPresentation.projectedScale,
        );
    mesh.scale.setScalar(radius / 5);
    object.userData.knowledgePresentationRadius = radius;
  }
}

function getKnowledgeGraph3DRenderedNodeRadius(
  node: any,
  naturalRadius: number,
  projectedScale: number,
): number {
  return node?.__knowledgeRootPacking
    ? naturalRadius
    : getKnowledgeGraph3DNodePresentationRadius(naturalRadius, projectedScale);
}

export function getKnowledgeGraphProjectedSphereBounds(input: {
  camera: THREE.PerspectiveCamera;
  center: { x: number; y: number; z: number };
  radius: number;
  width: number;
  height: number;
}) {
  const cameraPoint = new THREE.Vector3(input.center.x, input.center.y, input.center.z)
    .applyMatrix4(input.camera.matrixWorldInverse);
  const depth = -cameraPoint.z;
  if (!Number.isFinite(depth) || !Number.isFinite(input.radius) || input.radius < 0 || depth <= input.radius) {
    return null;
  }
  const projectedExtrema = (center: number, projectionScale: number) => {
    const denominator = depth * depth - input.radius * input.radius;
    const tangent = input.radius * Math.sqrt(depth * depth + center * center - input.radius * input.radius);
    return [
      (center * depth - tangent) / denominator * projectionScale,
      (center * depth + tangent) / denominator * projectionScale,
    ] as const;
  };
  const [leftNdc, rightNdc] = projectedExtrema(cameraPoint.x, input.camera.projectionMatrix.elements[0]);
  const [bottomNdc, topNdc] = projectedExtrema(cameraPoint.y, input.camera.projectionMatrix.elements[5]);
  return {
    left: (leftNdc + 1) * input.width / 2,
    top: (1 - topNdc) * input.height / 2,
    right: (rightNdc + 1) * input.width / 2,
    bottom: (1 - bottomNdc) * input.height / 2,
  };
}

function getKnowledgeGraph3DSafeFitCameraDistance(input: {
  nodes: Array<KnowledgeViewportNode & { name: string; z: number }>;
  width: number;
  height: number;
  initialDistance: number;
  cameraCenterX: number;
  cameraCenterY: number;
  fovDegrees: number;
  zoom: number;
  labelMode: KnowledgeGraphLabelMode;
  selectedNodeId?: string;
  hoveredNodeId?: string;
  margin: number;
}): number {
  const camera = new THREE.PerspectiveCamera(
    input.fovDegrees,
    input.width / Math.max(1, input.height),
    0.1,
    Math.max(2000, input.initialDistance * 4),
  );
  camera.zoom = input.zoom;

  const hasSafeBounds = (distance: number) => {
    camera.position.set(input.cameraCenterX, input.cameraCenterY, distance);
    camera.lookAt(input.cameraCenterX, input.cameraCenterY, 0);
    camera.far = Math.max(2000, distance * 4);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    const project = (point: { x: number; y: number; z: number }) => {
      const projected = new THREE.Vector3(point.x, point.y, point.z).project(camera);
      return { x: projected.x, y: projected.y, z: projected.z };
    };
    const projectedNodes = input.nodes.map((node) => {
      const center = { x: node.x, y: node.y, z: node.z };
      const screen = projectKnowledgeWorldPoint({
        ...center,
        width: input.width,
        height: input.height,
        project,
      });
      const projectedScale = getKnowledgeProjectionScale({
        center,
        right: new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion),
        up: new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion),
        width: input.width,
        height: input.height,
        project,
      });
      return {
        ...node,
        screenX: screen.x,
        screenY: screen.y,
        projectedScale,
        bodyRadius: node.isRootBubble
          ? node.bodyRadius
          : getKnowledgeGraph3DRenderedNodeRadius(node, node.bodyRadius, projectedScale),
      };
    });
    const placements = placeKnowledgeGraphLabels({
      nodes: projectedNodes,
      scale: 1,
      labelMode: input.labelMode,
      width: input.width,
      height: input.height,
      padding: getKnowledgeGraphViewportSafeInsets({ width: input.width, height: input.height }),
      enforceViewport: true,
      selectedNodeId: input.selectedNodeId,
      hoveredNodeId: input.hoveredNodeId,
    });
    return projectedNodes.every((node) => {
      const bodyBounds = getKnowledgeGraphProjectedSphereBounds({
        camera,
        center: { x: node.x, y: node.y, z: node.z },
        radius: node.bodyRadius,
        width: input.width,
        height: input.height,
      });
      if (!bodyBounds) return false;
      const placement = placements.get(node.id);
      let labelBounds: typeof bodyBounds | null = null;
      if (placement?.visible) {
        const layout = node.isRootBubble
          ? layoutKnowledgeRootLabel(node.name)
          : layoutKnowledgeNodeLabel(node.name);
        const policyFontSize = 'fontSize' in layout
          ? Number(layout.fontSize)
          : KNOWLEDGE_NODE_LABEL_POLICY.fontSize;
        const centerX = node.screenX! + (node.isRootBubble ? 0 : placement.offsetX);
        const centerY = node.screenY! + (node.isRootBubble ? 0 : placement.offsetY);
        const halfWidth = layout.width * placement.fontSize / policyFontSize / 2;
        const halfHeight = layout.height * placement.fontSize / policyFontSize / 2;
        labelBounds = {
          left: centerX - halfWidth,
          top: centerY - halfHeight,
          right: centerX + halfWidth,
          bottom: centerY + halfHeight,
        };
      }
      return Math.min(bodyBounds.left, labelBounds?.left ?? Number.POSITIVE_INFINITY) >= input.margin
        && Math.min(bodyBounds.top, labelBounds?.top ?? Number.POSITIVE_INFINITY) >= input.margin
        && Math.max(bodyBounds.right, labelBounds?.right ?? Number.NEGATIVE_INFINITY) <= input.width - input.margin
        && Math.max(bodyBounds.bottom, labelBounds?.bottom ?? Number.NEGATIVE_INFINITY) <= input.height - input.margin;
    });
  };

  const initialDistance = Math.max(0.0001, input.initialDistance);
  if (hasSafeBounds(initialDistance)) return initialDistance;
  let low = initialDistance;
  let high = initialDistance * 2;
  for (let index = 0; index < 24 && !hasSafeBounds(high); index += 1) {
    high *= 2;
  }
  if (!hasSafeBounds(high)) return initialDistance;
  for (let index = 0; index < 48; index += 1) {
    const candidate = (low + high) / 2;
    if (hasSafeBounds(candidate)) high = candidate;
    else low = candidate;
  }
  return high;
}

// ========== 几何体创建函数 ==========

/**
 * 根据概念宏类目形状创建几何体
 */
function createGeometryByConceptShape(shape: KnowledgeConceptNodeShape): THREE.BufferGeometry {
  switch (shape) {
    case 'circle':
      return new THREE.SphereGeometry(4, 32, 32);
    case 'square':
      return new THREE.BoxGeometry(7, 7, 7);
    case 'hexagon':
      return new THREE.IcosahedronGeometry(5, 0);
    case 'triangle':
      return new THREE.TetrahedronGeometry(5, 0);
    case 'diamond':
      return new THREE.OctahedronGeometry(5, 0);
    case 'pentagon':
      return new THREE.CylinderGeometry(4.5, 4.5, 4.5, 5, 1);
    default:
      return new THREE.SphereGeometry(4, 32, 32);
  }
}

// 候选徽标：共享画布纹理 + 候选文案，所有节点复用一份。
let candidateBadgeTexture: THREE.CanvasTexture | null = null;

function getKnowledgeGraphCandidateBadgeTexture(): THREE.CanvasTexture {
  if (!candidateBadgeTexture) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const context = canvas.getContext('2d')!;
    context.font = '600 40px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = hexToRgba(KNOWLEDGE_GRAPH_CANDIDATE_PRESENTATION.color, 1);
    context.fillText(KNOWLEDGE_GRAPH_CANDIDATE_PRESENTATION.label, 64, 34);
    candidateBadgeTexture = new THREE.CanvasTexture(canvas);
  }
  return candidateBadgeTexture;
}

function createKnowledgeGraphCandidateBadge(opacity: number): THREE.Sprite {
  const badge = new THREE.Sprite(new THREE.SpriteMaterial({
    map: getKnowledgeGraphCandidateBadgeTexture(),
    transparent: true,
    opacity,
    depthWrite: false,
  }));
  badge.scale.set(6.4, 3.2, 1);
  return badge;
}

export function KnowledgeGraphCanvas({
  nodes,
  links,
  presentationLinks = links,
  selectedNode,
  hoveredNode,
  onNodeClick,
  onNodeHover,
  onNodeDragEnd,
  onBackgroundClick,
  labelMode,
  layoutState,
  fitViewRequest,
  autoFitScopeKey = null,
  autoFitReady = false,
  autoFitConsumed = false,
  autoFitCameraManipulated = false,
  restoredCameraPose = null,
  onAutoFitConsumed,
  onCameraManipulation,
  onCameraPoseChange,
  relayoutVersion,
  engineReheatRevision = 0,
  width,
  height,
  expandedNodeIds,
  expandedDirectLinks,
  activationSequenceByCenterId,
  materializedNodeIds,
  graphVersion,
  lessonOrderNodeIds = EMPTY_LESSON_ORDER_NODE_IDS,
  teachingOrderLinks = links,
  selectedCorridorEmphasis = selectedNode ? {
    selectedNodeId: selectedNode.id,
    nodeIds: [selectedNode.id],
    edgeIds: [],
  } : null,
  collapsingNodeId = null,
  onCollapsePresentationComplete,
}: KnowledgeGraphCanvasProps) {
  const compactRootView = isCompactKnowledgeRootSet(nodes);
  const fgRef = useRef<any>(null);
  const nodeObjectsByIdRef = useRef(new Map<string, {
    node: any;
    object: THREE.Group;
    dataSignature: string;
  }>());
  const linkObjectsByIdRef = useRef(new Map<string, THREE.Group>());
  const nodeObjectBuilderRef = useRef<(object: THREE.Group, node: any) => void>(() => undefined);
  const nodeVisualStateRef = useRef({
    selectedNodeId: null as string | null,
    hoveredNodeId: null as string | null,
    corridorNodeIds: [] as readonly string[],
    presentation: IDLE_KNOWLEDGE_GRAPH_PRESENTATION,
  });
  const previousFocusedNodeIdsRef = useRef(new Set<string>());
  const labelPlacementsRef = useRef<ReturnType<typeof placeKnowledgeGraphLabels>>(new Map());
  const viewportScaleRef = useRef(1);
  const activeCanvasPointerIdsRef = useRef(new Set<number>());
  const blankGesturesByPointerIdRef = useRef(new Map<number, KnowledgeCanvasBlankGesture>());
  const completedBlankGestureRef = useRef<KnowledgeCanvasBlankGesture | null>(null);
  const consumedFitSignatureRef = useRef<string | null>(null);
  const consumedAutoFitScopeKeysRef = useRef(new Set<string>());
  const cameraManipulatedRef = useRef(false);
  const cameraManipulationScopeRef = useRef(autoFitScopeKey);
  if (cameraManipulationScopeRef.current !== autoFitScopeKey) {
    cameraManipulationScopeRef.current = autoFitScopeKey;
    cameraManipulatedRef.current = autoFitCameraManipulated;
  } else if (autoFitCameraManipulated) {
    cameraManipulatedRef.current = true;
  }
  const [autoFitCount, setAutoFitCount] = useState(0);
  const [explicitFitCount, setExplicitFitCount] = useState(0);
  const fitTimerRef = useRef<number | null>(null);
  const projectionSettledTimerRef = useRef<number | null>(null);
  const [viewportScale, setViewportScale] = useState(1);
  viewportScaleRef.current = viewportScale;
  const [cameraProjectionRevision, setCameraProjectionRevision] = useState(0);
  const projectionAnimationFrameRef = useRef<number | null>(null);
  const poseReportTimerRef = useRef<number | null>(null);
  const pendingPoseReportScopeRef = useRef<string | null>(null);
  const posePersistenceEnabledScopesRef = useRef(new Set<string>());
  const lastReportedPoseSignatureByScopeRef = useRef(new Map<string, string>());
  const restoredCameraScopeRef = useRef<string | null>(null);
  const restoredFitRequestIdRef = useRef<number | null>(null);
  const activeCameraScopeRef = useRef(autoFitScopeKey);
  if (activeCameraScopeRef.current !== autoFitScopeKey) {
    activeCameraScopeRef.current = autoFitScopeKey;
    restoredCameraScopeRef.current = null;
    restoredFitRequestIdRef.current = null;
  }
  const rightPanRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const layoutStateRef = useRef(layoutState);
  const runtimePositionsByNodeIdRef = useRef(new Map<string, Partial<RuntimeKnowledgeGraphNode>>());
  // 与 2D 相同：react-force-graph-3d 的 ref 也不暴露 graphData 方法，memo 节点
  // 数组即 d3 原地变异的活对象，用 ref 保留上一代续承沉降坐标（#1739）。
  const liveNodesRef = useRef<RuntimeKnowledgeGraphNode[]>([]);
  const committedRelayoutVersionRef = useRef(relayoutVersion);

  useEffect(() => () => nodeObjectsByIdRef.current.clear(), []);
  const committedGraphVersionRef = useRef(graphVersion);
  const revealedExpansionSignatureRef = useRef('');
  const previousExpandedNodeIdsRef = useRef<readonly string[]>([]);
  const focusedRevealTargetNodeIdRef = useRef<string | null>(null);
  const presentationExpandedNodeIdsRef = useRef<readonly string[]>([]);
  const presentationGenerationRef = useRef(0);
  const presentationGateRef = useRef(new KnowledgeGraphTransitionGate());
  const cameraTransitionRef = useRef(new KnowledgeGraphCameraTransition());
  const motionFrameLoopRef = useRef<KnowledgeGraphMotionFrameLoop | null>(null);
  const motionElapsedMsRef = useRef(0);
  const [presentation, setPresentation] = useState<KnowledgeGraphPresentationState>(
    IDLE_KNOWLEDGE_GRAPH_PRESENTATION
  );
  const [viewportRevision, setViewportRevision] = useState(0);
  const [layoutSettledRevision, setLayoutSettledRevision] = useState(0);
  const settledLayoutSignatureRef = useRef('');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [motionEnvironmentActive, setMotionEnvironmentActive] = useState(false);
  const forceLifecycle = resolveKnowledgeForceLifecycle({
    dimension: '3d',
    liveEngine: true,
    reducedMotion,
  });
  useEffect(() => {
    const handleResize = () => setViewportRevision((value) => value + 1);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const presentationRef = useRef(IDLE_KNOWLEDGE_GRAPH_PRESENTATION);
  presentationRef.current = presentation;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isLightTheme, setIsLightTheme] = useState(false);
  const laneCurvatureByLinkKey = useMemo(
    () => buildKnowledgeGraphEdgeLaneCurvatures(presentationLinks),
    [presentationLinks],
  );
  layoutStateRef.current = layoutState;

  useEffect(() => {
    const updateTheme = () => {
      setIsLightTheme(document.documentElement.classList.contains('light'));
    };

    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    committedRelayoutVersionRef.current = commitKnowledgeGraphRelayoutVersion({
      committedVersion: committedRelayoutVersionRef.current,
      nextVersion: relayoutVersion,
      runtimePositions: runtimePositionsByNodeIdRef.current,
    });
  }, [relayoutVersion]);

  useEffect(() => {
    runtimePositionsByNodeIdRef.current.clear();
    revealedExpansionSignatureRef.current = '';
    previousExpandedNodeIdsRef.current = [];
    focusedRevealTargetNodeIdRef.current = null;
    presentationExpandedNodeIdsRef.current = [];
    presentationGateRef.current.cancel();
    presentationRef.current = IDLE_KNOWLEDGE_GRAPH_PRESENTATION;
    setPresentation(IDLE_KNOWLEDGE_GRAPH_PRESENTATION);
  }, [graphVersion]);

  useEffect(() => () => {
    presentationGateRef.current.dispose();
    cameraTransitionRef.current.dispose();
    motionFrameLoopRef.current?.dispose();
    linkObjectsByIdRef.current.forEach(disposeKnowledgeGraphPresentationLinkGroup);
    linkObjectsByIdRef.current.clear();
  }, []);

  // 1. 处理数据并转换 links 格式
  const graphData = useMemo(() => {
    const graphVersionChanged = committedGraphVersionRef.current !== graphVersion;
    if (graphVersionChanged) runtimePositionsByNodeIdRef.current.clear();
    committedGraphVersionRef.current = graphVersion;
    const degreeById = new Map<string, number>();
    links.forEach((link) => {
      degreeById.set(link.sourceId, (degreeById.get(link.sourceId) ?? 0) + 1);
      degreeById.set(link.targetId, (degreeById.get(link.targetId) ?? 0) + 1);
    });
    const clonedNodes = nodes.map((n) => ({
      ...n,
      graphDegree: n.graphDegree ?? degreeById.get(n.id) ?? 0,
    } as any));
    const useCompactRootPacking = isCompactKnowledgeRootSet(clonedNodes);
    const preserveRuntimeCoordinates = !useCompactRootPacking
      && !graphVersionChanged
      && committedRelayoutVersionRef.current === relayoutVersion;

    // 转换 links: sourceId/targetId -> source/target (ForceGraph3D 格式)
    const transformedLinks = links.map(l => ({
      ...l,
      source: l.sourceId,
      target: l.targetId,
    }));

    const clonedBaseLayoutNodes = useCompactRootPacking
      ? packKnowledgeGraphRootNodes(clonedNodes, {
          viewportWidth: width ?? 1280,
          viewportHeight: height ?? 720,
          graphVersion,
        })
      : buildKnowledgeTeachingOrderLayout({
          nodes: clonedNodes,
          links: teachingOrderLinks,
          lessonOrderNodeIds,
          viewportWidth: width ?? 1280,
          viewportHeight: height ?? 720,
        }).nodes as RuntimeKnowledgeGraphNode[];
    const baseLayoutNodes = resolveKnowledgeGraphRuntimeNodeCoordinates({
      nodes: clonedBaseLayoutNodes,
      liveNodes: liveNodesRef.current,
      runtimePositionsByNodeId: runtimePositionsByNodeIdRef.current,
      preserve: preserveRuntimeCoordinates,
    }) as RuntimeKnowledgeGraphNode[];
    markKnowledgeGraphAutomaticNodeAnchors(baseLayoutNodes);
    const focusedLayoutNodes = applyFocusedExpansionLayout({
      nodes: baseLayoutNodes,
      expandedNodeIds,
      directExpansionLinks: expandedDirectLinks,
      layoutState,
      activationSequenceByCenterId,
      materializedNodeIds,
    });
    const focusedDepthByNodeId = resolveFocusedExpansionDepthByNodeId({
      nodes: focusedLayoutNodes,
      expandedNodeIds,
      directExpansionLinks: expandedDirectLinks,
      layoutState,
      activationSequenceByCenterId,
      materializedNodeIds,
    });
    const focusedThreeDimensionalNodes = focusedLayoutNodes.map((node) => {
      const focusedZ = focusedDepthByNodeId.get(node.id);
      if (focusedZ === undefined) return node;
      // Focused depth is a z seed, not a fixed coordinate: ordinary nodes
      // stay under force ownership in every dimension (#1739).
      return {
        ...node,
        z: focusedZ,
        positionZ: focusedZ,
        __knowledgeAutomaticAnchor: node.__knowledgeAutomaticAnchor
          ? { ...node.__knowledgeAutomaticAnchor, z: focusedZ }
          : node.__knowledgeAutomaticAnchor,
      };
    });

    return {
      nodes: focusedThreeDimensionalNodes,
      links: transformedLinks
    };
  }, [nodes, links, relayoutVersion, layoutState, expandedNodeIds, expandedDirectLinks, activationSequenceByCenterId, materializedNodeIds, graphVersion, width, height, lessonOrderNodeIds, teachingOrderLinks]);
  liveNodesRef.current = graphData.nodes as RuntimeKnowledgeGraphNode[];
  const structuralForegroundEdgeIdSet = useMemo(() => new Set(
    selectKnowledgeGraphStructuralForegroundEdgeIds(graphData.links),
  ), [graphData.links]);

  const motionMarkerEdgeIds = useMemo(() => selectKnowledgeGraphMotionMarkerEdgeIds({
    active: Boolean(selectedCorridorEmphasis?.selectedNodeId),
    motionEligibleEdgeIds: selectedCorridorEmphasis?.motionEligibleEdgeIds ?? [],
    motionSuppressedEdgeIds: selectedCorridorEmphasis?.motionSuppressedEdgeIds ?? [],
    visibleEdgeIds: graphData.links.map((link) => getKnowledgeGraphPresentationLinkKey(link)),
  }), [graphData.links, selectedCorridorEmphasis]);
  const motionMarkerEdgeIdSet = useMemo(() => new Set(motionMarkerEdgeIds), [motionMarkerEdgeIds]);
  // 环境流层：同一可见 post-requisite 结构前景集合上的确定性预算标记。
  const ambientFlowSelection = useMemo(() => resolveFlowMarkerSet({
    scope: 'ambient',
    active: true,
    motionEligibleEdgeIds: [...structuralForegroundEdgeIdSet],
    motionSuppressedEdgeIds: [],
    visibleEdgeIds: graphData.links.map((link) => getKnowledgeGraphPresentationLinkKey(link)),
  }), [graphData.links, structuralForegroundEdgeIdSet]);
  const ambientFlowEdgeIdSet = useMemo(() => new Set(ambientFlowSelection.edgeIds), [ambientFlowSelection]);
  // 并发计数与绘制同口径：环境流层会排除已选走廊边，重叠边只按走廊标记计一次，
  // 否则快照、属性与性能预算都在高报真实并发标记数。
  const activeMotionMarkerCount = motionMarkerEdgeIds.length
    + ambientFlowSelection.edgeIds.filter((edgeId) => !motionMarkerEdgeIdSet.has(edgeId)).length;

  // 根气泡入场错峰：按稳定排序的气泡 id 计算每个气泡的淡入延迟（纯绘制层）。
  // 必须从打包后的 graphData.nodes 计算——__knowledgeRootPacking 由本组件
  // packKnowledgeGraphRootNodes 注入，props.nodes 不携带该字段。
  const rootEntranceDelayByNodeId = useMemo(() => {
    const rootBubbleIds = graphData.nodes
      .filter((node: any) => Boolean(node.__knowledgeRootPacking))
      .map((node: any) => node.id)
      .sort();
    const span = KNOWLEDGE_ROOT_BUBBLE_VITALITY.entrance.staggerSpanMs;
    return new Map(rootBubbleIds.map((nodeId, index) => [
      nodeId,
      rootBubbleIds.length > 1 ? (index * span) / (rootBubbleIds.length - 1) : 0,
    ]));
  }, [graphData.nodes]);
  const rootEntranceStartMsRef = useRef<number | null>(null);
  // 入场结束态用 state 收敛：布防 ref 只服务帧采样的淡入计算，
  // entranceDone 让 entranceActive 在错峰播完后关闭，帧循环才能随之停摆。
  const [entranceDone, setEntranceDone] = useState(false);
  const entranceScopeKey = `${graphVersion}:${[...rootEntranceDelayByNodeId.keys()].join('|')}:${reducedMotion ? 'rm' : 'full'}`;
  const entranceScopeKeyRef = useRef('');
  if (entranceScopeKeyRef.current !== entranceScopeKey) {
    entranceScopeKeyRef.current = entranceScopeKey;
    setEntranceDone(false);
    rootEntranceStartMsRef.current = rootEntranceDelayByNodeId.size > 0 && !reducedMotion
      ? performance.now()
      : null;
  }
  const entranceActive = rootEntranceStartMsRef.current !== null && !entranceDone;
  const rootBreathingActive = !reducedMotion && graphData.nodes.some((node: any) => (
    Boolean(node.__knowledgeRootPacking) && (selectedNode?.id === node.id || hoveredNode?.id === node.id)
  ));
  const motionScopeKey = createKnowledgeGraphMotionScopeKey({
    graphVersion,
    selectedNodeId: selectedCorridorEmphasis?.selectedNodeId ?? null,
    visibleNodeIds: graphData.nodes.map((node) => node.id),
    motionEligibleEdgeIds: motionMarkerEdgeIds,
  });

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      setReducedMotion(false);
      setMotionEnvironmentActive(true);
      return;
    }
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    return bindKnowledgeGraphMotionEnvironment({
      documentTarget: document,
      mediaQuery,
      offscreenTarget: rootRef.current,
      transitionEvent: {
        eventTarget: document,
        isActive: () => presentationRef.current.phase !== 'idle',
      },
      suspend: () => {
        motionFrameLoopRef.current?.stop();
        motionElapsedMsRef.current = 0;
        setReducedMotion(mediaQuery.matches);
        setMotionEnvironmentActive(false);
        fgRef.current?.refresh?.();
      },
      resume: () => {
        setReducedMotion(false);
        setMotionEnvironmentActive(true);
      },
    });
  }, []);

  useEffect(() => {
    document.dispatchEvent(new CustomEvent(KNOWLEDGE_GRAPH_MOTION_TRANSITION_EVENT));
  }, [presentation.phase]);

  // 根气泡活力帧：呼吸光晕、轮缘光弧与入场淡入（只写材质透明度，纯绘制层）。
  const applyRootBubbleVitalityFrame = useCallback((nowMs: number) => {
    const breathingWave = getKnowledgeGraphBreathingIntensity(nowMs, KNOWLEDGE_ROOT_BUBBLE_VITALITY.breathing);
    const entranceStartMs = rootEntranceStartMsRef.current;
    nodeObjectsByIdRef.current.forEach((entry, nodeId) => {
      if (!entry.node.__knowledgeRootPacking) return;
      // 与 builder 同口径：激活含选中、悬停与走廊成员，透明度含走廊强调因子，
      // 否则逐帧覆写会抹掉走廊聚焦的变暗对比。
      const isActive = selectedNode?.id === nodeId
        || hoveredNode?.id === nodeId
        || Boolean(selectedCorridorEmphasis?.nodeIds.includes(nodeId));
      const entranceFade = reducedMotion || entranceStartMs === null
        ? 1
        : getKnowledgeGraphEntranceFade(
          nowMs - entranceStartMs,
          rootEntranceDelayByNodeId.get(nodeId) ?? 0,
          KNOWLEDGE_ROOT_BUBBLE_VITALITY.entrance.fadeDurationMs
        );
      const presentationOpacity = getKnowledgeGraphPresentationNodeOpacity({ ...presentationRef.current, nodeId })
        * getKnowledgeGraphNodeEmphasisOpacity(nodeId, selectedCorridorEmphasis);
      const halo = entry.object.userData.knowledgeVitalityHalo as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | undefined;
      if (halo) {
        const haloAlpha = isActive && !reducedMotion
          ? KNOWLEDGE_ROOT_BUBBLE_VITALITY.halo.alphaMin
            + (KNOWLEDGE_ROOT_BUBBLE_VITALITY.halo.alphaMax - KNOWLEDGE_ROOT_BUBBLE_VITALITY.halo.alphaMin) * breathingWave
          : KNOWLEDGE_ROOT_BUBBLE_VITALITY.halo.alphaMin;
        halo.material.opacity = haloAlpha * entranceFade * presentationOpacity;
      }
      const rimArc = entry.object.userData.knowledgeVitalityRimArc as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | undefined;
      if (rimArc) {
        rimArc.material.opacity = (isActive
          ? KNOWLEDGE_ROOT_BUBBLE_VITALITY.rimArc.activeAlpha
          : KNOWLEDGE_ROOT_BUBBLE_VITALITY.rimArc.inactiveAlpha) * entranceFade * presentationOpacity;
      }
      const body = entry.object.userData.knowledgeBodyMesh as THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhongMaterial> | undefined;
      if (body) {
        body.material.opacity = (isActive ? 1 : 0.9) * presentationOpacity * entranceFade;
      }
    });
  }, [hoveredNode?.id, reducedMotion, rootEntranceDelayByNodeId, selectedCorridorEmphasis, selectedNode?.id]);

  useEffect(() => {
    const motionDisabled = !motionEnvironmentActive || reducedMotion || prefersReducedKnowledgeGraphMotion();
    if (motionDisabled || (activeMotionMarkerCount === 0 && !rootBreathingActive && !entranceActive)) {
      const shouldRefresh = motionElapsedMsRef.current > 0 || activeMotionMarkerCount > 0;
      motionFrameLoopRef.current?.stop();
      motionElapsedMsRef.current = 0;
      if (shouldRefresh) fgRef.current?.refresh?.();
      return;
    }
    const loop = motionFrameLoopRef.current ?? new KnowledgeGraphMotionFrameLoop({
      now: () => performance.now(),
      requestFrame: (callback) => window.requestAnimationFrame(callback),
      cancelFrame: (frameId) => window.cancelAnimationFrame(frameId),
    });
    motionFrameLoopRef.current = loop;
    loop.start(motionScopeKey, (elapsedMs) => {
      motionElapsedMsRef.current = elapsedMs;
      fgRef.current?.refresh?.();
      applyRootBubbleVitalityFrame(performance.now());
      // 入场结束后且无走廊/环境流/呼吸活动时自动停摆，避免空转。
      if (activeMotionMarkerCount === 0 && !rootBreathingActive) {
        const entranceStartMs = rootEntranceStartMsRef.current;
        if (entranceStartMs === null
          || performance.now() - entranceStartMs >= KNOWLEDGE_ROOT_BUBBLE_VITALITY.entrance.totalDurationMs) {
          setEntranceDone(true);
          motionFrameLoopRef.current?.stop();
        }
      }
    });
    return () => loop.stop();
  }, [activeMotionMarkerCount, applyRootBubbleVitalityFrame, entranceActive, motionEnvironmentActive, motionScopeKey, reducedMotion, rootBreathingActive]);

  useEffect(() => {
    const activeLinkIds = new Set(graphData.links.map((link) => getKnowledgeGraphPresentationLinkKey(link)));
    linkObjectsByIdRef.current.forEach((object, linkId) => {
      if (activeLinkIds.has(linkId)) return;
      disposeKnowledgeGraphPresentationLinkGroup(object);
      linkObjectsByIdRef.current.delete(linkId);
    });
    fgRef.current?.refresh?.();
    const refreshFrame = window.requestAnimationFrame(() => {
      // d3 在摄入后会把 memo 链接对象的 source/target 原地解析为节点引用；
      // ref 上没有 graphData 方法，直接读 memo 数组即活对象（#1739）。
      const liveLinks = graphData.links as any[];
      liveLinks.forEach((link) => {
        const source = typeof link.source === 'object' ? link.source : null;
        const target = typeof link.target === 'object' ? link.target : null;
        if (!source || !target) return;
        const linkObject = linkObjectsByIdRef.current.get(getKnowledgeGraphPresentationLinkKey(link));
        if (!linkObject) return;
        updatePresentationLinkObjectRef.current(linkObject, {
          start: { x: source.x, y: source.y, z: source.z ?? 0 },
          end: { x: target.x, y: target.y, z: target.z ?? 0 },
        }, link);
      });
      fgRef.current?.refresh?.();
      setCameraProjectionRevision((value) => value + 1);
    });
    return () => window.cancelAnimationFrame(refreshFrame);
  }, [graphData]);

  useEffect(() => {
    cameraTransitionRef.current.cancel();
    const expandedIds = [...new Set(expandedNodeIds)];
    const previousExpandedIds = presentationExpandedNodeIdsRef.current;
    const targetNodeId = collapsingNodeId ?? resolveFocusedExpansionRevealTarget(previousExpandedIds, expandedIds);
    if (!targetNodeId) {
      presentationExpandedNodeIdsRef.current = expandedIds;
      const activePresentation = presentationRef.current;
      if (
        expandedIds.length > 0
        && activePresentation.phase !== 'idle'
        && activePresentation.targetNodeId
        && expandedIds.includes(activePresentation.targetNodeId)
      ) return;
      presentationGateRef.current.cancel();
      presentationRef.current = IDLE_KNOWLEDGE_GRAPH_PRESENTATION;
      setPresentation((current) => current.phase === 'idle'
        ? current
        : IDLE_KNOWLEDGE_GRAPH_PRESENTATION);
      return;
    }
    const targetDirectLinks = expandedDirectLinks.filter((link) => (
      link.sourceId === targetNodeId || link.targetId === targetNodeId
    ));
    const directNodeIds = [...new Set(targetDirectLinks.map((link) => (
      link.sourceId === targetNodeId ? link.targetId : link.sourceId
    )))];
    const relationIds = targetDirectLinks.map((link) => `${link.sourceId}:${link.targetId}`);
    const phase = collapsingNodeId ? 'collapsing' : 'revealing';
    const nodeById = new Map(graphData.nodes.map((node) => [node.id, node as KnowledgeNodeData & {
      __knowledgeAutomaticAnchor?: { activationSequence?: number; provenanceCenterId?: string };
    }]));
    const activationSequence = activationSequenceByCenterId[targetNodeId];
    const newlyMaterializedNodeIds = directNodeIds.filter((nodeId) => {
      const anchor = nodeById.get(nodeId)?.__knowledgeAutomaticAnchor;
      return materializedNodeIds.includes(nodeId)
        && anchor?.provenanceCenterId === targetNodeId
        && (activationSequence === undefined || anchor.activationSequence === activationSequence);
    });
    if (phase === 'revealing' && newlyMaterializedNodeIds.length === 0) {
      presentationGateRef.current.cancel();
      presentationRef.current = IDLE_KNOWLEDGE_GRAPH_PRESENTATION;
      setPresentation((current) => current.phase === 'idle'
        ? current
        : IDLE_KNOWLEDGE_GRAPH_PRESENTATION);
      return;
    }
    presentationExpandedNodeIdsRef.current = expandedIds;
    const animatedRelationIds = phase === 'collapsing'
      ? relationIds
      : targetDirectLinks
        .filter((link) => newlyMaterializedNodeIds.includes(
          link.sourceId === targetNodeId ? link.targetId : link.sourceId
        ))
        .map((link) => `${link.sourceId}:${link.targetId}`);
    const plan = createKnowledgeGraphRevealPlan({
      graphVersion: graphVersion ?? 'pending',
      targetNodeId,
      generation: ++presentationGenerationRef.current,
      nodeIds: phase === 'collapsing' ? directNodeIds : newlyMaterializedNodeIds,
      reducedMotion: prefersReducedKnowledgeGraphMotion(),
    });
    presentationGateRef.current.cancel(plan.key);
    if (plan.focusDurationMs === 0) {
      presentationRef.current = IDLE_KNOWLEDGE_GRAPH_PRESENTATION;
      setPresentation(IDLE_KNOWLEDGE_GRAPH_PRESENTATION);
      if (collapsingNodeId) onCollapsePresentationComplete?.(collapsingNodeId);
      return;
    }
    const nodeTimings = Object.fromEntries(plan.nodes.map((node) => [node.nodeId, {
      delayMs: node.delayMs,
      durationMs: node.durationMs,
    }]));
    const durationMs = phase === 'collapsing'
      ? plan.collapseDurationMs
      : Math.max(plan.focusDurationMs, plan.relationDurationMs, ...plan.nodes.map((node) => node.delayMs + node.durationMs));
    const nextPresentation: KnowledgeGraphPresentationState = {
      key: plan.key,
      phase,
      targetNodeId,
      directNodeIds,
      animatedNodeIds: phase === 'collapsing' ? directNodeIds : newlyMaterializedNodeIds,
      revealedNodeIds: phase === 'collapsing' ? directNodeIds : [],
      revealedRelationIds: phase === 'collapsing' ? relationIds : [],
      animatedRelationIds,
      elapsedMs: 0,
      durationMs,
      relationDurationMs: plan.relationDurationMs,
      collapseDurationMs: plan.collapseDurationMs,
      animateParticles: plan.animateParticles,
      nodeTimings,
    };
    presentationRef.current = nextPresentation;
    setPresentation(nextPresentation);
    if (phase === 'collapsing') {
      presentationGateRef.current.schedule(plan.key, () => {
        presentationRef.current = IDLE_KNOWLEDGE_GRAPH_PRESENTATION;
        setPresentation(IDLE_KNOWLEDGE_GRAPH_PRESENTATION);
        onCollapsePresentationComplete?.(targetNodeId);
      }, plan.collapseDurationMs);
      return;
    }
    presentationGateRef.current.schedule(plan.key, () => {
      setPresentation((current) => current.key === plan.key
        ? { ...current, revealedRelationIds: animatedRelationIds }
        : current);
    }, plan.relationDurationMs);
    plan.nodes.forEach((node) => {
      presentationGateRef.current.schedule(plan.key, () => {
        setPresentation((current) => current.key === plan.key
          ? { ...current, revealedNodeIds: [...new Set([...current.revealedNodeIds, node.nodeId])] }
          : current);
      }, node.delayMs);
    });
    presentationGateRef.current.schedule(plan.key, () => {
      presentationRef.current = IDLE_KNOWLEDGE_GRAPH_PRESENTATION;
      setPresentation(IDLE_KNOWLEDGE_GRAPH_PRESENTATION);
    }, durationMs);
  }, [activationSequenceByCenterId, collapsingNodeId, expandedDirectLinks, expandedNodeIds, graphData.nodes, graphVersion, materializedNodeIds, nodes, onCollapsePresentationComplete]);

  const presentationKey = presentation.key;
  const presentationPhase = presentation.phase;
  const presentationDurationMs = presentation.durationMs ?? 0;
  nodeVisualStateRef.current = {
    selectedNodeId: selectedNode?.id ?? null,
    hoveredNodeId: hoveredNode?.id ?? null,
    corridorNodeIds: selectedCorridorEmphasis?.nodeIds ?? [],
    presentation,
  };

  useEffect(() => {
    if (presentationPhase === 'idle' || !presentationKey || presentationDurationMs <= 0) return;
    const startedAtMs = performance.now();
    const requestFrame = typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame.bind(window)
      : (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 16);
    const cancelFrame = typeof window.cancelAnimationFrame === 'function'
      ? window.cancelAnimationFrame.bind(window)
      : (frame: number) => window.clearTimeout(frame);
    let frame = 0;
    const tick = (now: number) => {
      const elapsedMs = Math.min(presentationDurationMs, Math.max(0, now - startedAtMs));
      setPresentation((current) => current.key === presentationKey
        ? { ...current, elapsedMs }
        : current);
      if (elapsedMs < presentationDurationMs) frame = requestFrame(tick);
    };
    frame = requestFrame(tick);
    return () => cancelFrame(frame);
  }, [presentationDurationMs, presentationKey, presentationPhase]);

  const rememberRuntimeNodePosition = useCallback((node: RuntimeKnowledgeGraphNode) => {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
    runtimePositionsByNodeIdRef.current.set(node.id, {
      x: node.x,
      y: node.y,
      ...(Number.isFinite(node.z) ? { z: node.z } : {}),
      ...(Number.isFinite(node.vx) ? { vx: node.vx } : {}),
      ...(Number.isFinite(node.vy) ? { vy: node.vy } : {}),
      ...(Number.isFinite(node.vz) ? { vz: node.vz } : {}),
      ...(Number.isFinite(node.fx) ? { fx: node.fx } : {}),
      ...(Number.isFinite(node.fy) ? { fy: node.fy } : {}),
      ...(Number.isFinite(node.fz) ? { fz: node.fz } : {}),
      ...(node.__knowledgeAutomaticAnchor
        ? { __knowledgeAutomaticAnchor: node.__knowledgeAutomaticAnchor }
        : {}),
    });
  }, []);

  const layoutSignature = `${graphVersion ?? 'pending'}:${relayoutVersion}:${graphData.nodes.map((node) => node.id).join('|')}`;
  const snapshotRuntimePositions = useCallback(() => {
    const graphNodes = (fgRef.current?.graphData?.()?.nodes ?? graphData.nodes) as RuntimeKnowledgeGraphNode[];
    graphNodes.forEach(rememberRuntimeNodePosition);
  }, [graphData.nodes, rememberRuntimeNodePosition]);
  // Component-scoped reheat (#1739): newly disclosed nodes settle while
  // unaffected nodes hold their settled coordinates; the frame is released
  // at the engine-stop settle milestone.
  const unaffectedFrozenNodeIdsRef = useRef<Set<string>>(new Set());
  const knownNodeIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    const previousIds = knownNodeIdsRef.current;
    knownNodeIdsRef.current = new Set(graphData.nodes.map((node: any) => String(node.id)));
    if (!previousIds || forceLifecycle.staticLayout) return;
    const graphNodes = (fgRef.current?.graphData?.()?.nodes ?? graphData.nodes) as RuntimeKnowledgeGraphNode[];
    const frozenNodeIds = reheatKnowledgeGraphNewcomerScope({
      nodes: graphNodes,
      links: graphData.links,
      previousIds,
    });
    if (!frozenNodeIds) return;
    unaffectedFrozenNodeIdsRef.current = frozenNodeIds;
    fgRef.current?.d3ReheatSimulation?.();
  }, [forceLifecycle.staticLayout, graphData.links, graphData.nodes]);

  const handleEngineStop = useCallback(() => {
    snapshotRuntimePositions();
    if (unaffectedFrozenNodeIdsRef.current.size > 0) {
      const graphNodes = (fgRef.current?.graphData?.()?.nodes ?? graphData.nodes) as RuntimeKnowledgeGraphNode[];
      releaseKnowledgeGraphFrozenScope(graphNodes, {
        frozenNodeIds: unaffectedFrozenNodeIdsRef.current,
        pinnedNodeIds: new Set(Object.keys(layoutStateRef.current.positionsByNodeId)),
      });
      unaffectedFrozenNodeIdsRef.current = new Set();
    }
    if (settledLayoutSignatureRef.current === layoutSignature) return;
    settledLayoutSignatureRef.current = layoutSignature;
    setCameraProjectionRevision((revision) => revision + 1);
    setLayoutSettledRevision((revision) => revision + 1);
  }, [graphData.nodes, layoutSignature, snapshotRuntimePositions]);

  useEffect(() => {
    const qaWindow = window as Window & {
      __knowledgeGraphQaNodePoints?: (nodeId?: string) => Array<{ x: number; y: number }>;
      __knowledgeGraphQaNodeDebug?: (nodeId?: string) => Array<Record<string, unknown>>;
      __knowledgeGraphQaPresentationDebug?: () => Record<string, unknown>;
      __knowledgeGraphQaResetViewport?: () => void;
      __knowledgeGraphQaCenterNode?: (nodeId: string) => void;
    };
    const qaMode = new URLSearchParams(window.location.search).get('qa');
    const qaEnabled = qaMode === 'knowledge-product'
      || qaMode === 'issue-894-direct-activation'
      || qaMode === 'three-orbit-controls'
      || qaMode === 'task-42-webgl-acceptance';
    if (!qaEnabled) {
      delete qaWindow.__knowledgeGraphQaNodePoints;
      delete qaWindow.__knowledgeGraphQaNodeDebug;
      delete qaWindow.__knowledgeGraphQaPresentationDebug;
      delete qaWindow.__knowledgeGraphQaResetViewport;
      delete qaWindow.__knowledgeGraphQaCenterNode;
      return;
    }
    const getNodePoints = (requestedNodeId = selectedNode?.id) => {
      if (!requestedNodeId || !fgRef.current?.graph2ScreenCoords) return [];
      const graphNodes = [
        ...((fgRef.current.graphData?.()?.nodes ?? []) as Array<KnowledgeNodeData & { x?: number; y?: number; z?: number }>),
        ...(graphData.nodes as Array<KnowledgeNodeData & { x?: number; y?: number; z?: number }>),
      ];
      const canvas = document.querySelector<HTMLCanvasElement>('[data-knowledge-canvas-primary="true"] canvas');
      const rect = canvas?.getBoundingClientRect();
      const candidates: Array<{ x: number; y: number }> = [];
      for (const graphNode of graphNodes) {
        if (graphNode.id !== requestedNodeId) continue;
        const graphX = Number(graphNode.x);
        const graphY = Number(graphNode.y);
        const graphZ = Number(graphNode.z ?? 0);
        if (![graphX, graphY, graphZ].every(Number.isFinite)) continue;
        const screen = fgRef.current.graph2ScreenCoords(graphX, graphY, graphZ);
        const screenX = Number(screen?.x);
        const screenY = Number(screen?.y);
        if (![screenX, screenY].every(Number.isFinite)) continue;
        if (!rect) continue;
        candidates.push({ x: rect.left + screenX, y: rect.top + screenY });
      }
      return candidates.flatMap((point) => [
        point,
        { x: point.x - 8, y: point.y },
        { x: point.x + 8, y: point.y },
        { x: point.x, y: point.y - 8 },
        { x: point.x, y: point.y + 8 },
      ]).filter((point, index, points) => (
        index === points.findIndex((candidate) => (
          Math.round(candidate.x) === Math.round(point.x)
          && Math.round(candidate.y) === Math.round(point.y)
        ))
      ));
    };
    qaWindow.__knowledgeGraphQaNodePoints = getNodePoints;
    qaWindow.__knowledgeGraphQaNodeDebug = (requestedNodeId = selectedNode?.id) => {
      const camera = fgRef.current?.camera?.() as THREE.PerspectiveCamera | undefined;
      const controls = fgRef.current?.controls?.() as {
        target?: { x?: number; y?: number; z?: number };
        enablePan?: boolean;
        mouseButtons?: { RIGHT?: number };
      } | undefined;
      const renderer = fgRef.current?.renderer?.() as {
        info?: { render?: { calls?: number; triangles?: number } };
        domElement?: { width?: number; height?: number };
      } | undefined;
      const scene = fgRef.current?.scene?.() as { children?: unknown[] } | undefined;
      const renderCalls = renderer?.info?.render?.calls;
      const renderTriangles = renderer?.info?.render?.triangles;
      const rendererWidth = renderer?.domElement?.width;
      const rendererHeight = renderer?.domElement?.height;
      const graphNodes = [
        ...((fgRef.current?.graphData?.()?.nodes ?? graphData.nodes) as Array<KnowledgeNodeData & { x?: number; y?: number; z?: number }>),
        ...(graphData.nodes as Array<KnowledgeNodeData & { x?: number; y?: number; z?: number }>),
      ];
      return graphNodes
        .filter((node) => node.id === requestedNodeId)
        .map((node) => {
          camera?.updateMatrixWorld(true);
          camera?.updateProjectionMatrix();
          const worldPoint = new THREE.Vector3(Number(node.x), Number(node.y), Number(node.z ?? 0));
          const cameraPoint = camera && worldPoint.clone().applyMatrix4(camera.matrixWorldInverse);
          const ndc = camera && worldPoint.clone().project(camera);
          const depth = cameraPoint ? -cameraPoint.z : Number.NaN;
          const isInFrustum = Boolean(camera && ndc
            && [worldPoint.x, worldPoint.y, worldPoint.z, ndc.x, ndc.y, ndc.z, depth].every(Number.isFinite)
            && depth >= camera.near && depth <= camera.far
            && ndc.x >= -1 && ndc.x <= 1
            && ndc.y >= -1 && ndc.y <= 1
            && ndc.z >= -1 && ndc.z <= 1);
          const point = fgRef.current?.graph2ScreenCoords && [node.x, node.y, node.z ?? 0].every(Number.isFinite)
            ? fgRef.current.graph2ScreenCoords(node.x!, node.y!, node.z ?? 0)
            : null;
          const placement = labelPlacementsRef.current.get(node.id);
          const focused = selectedNode?.id === node.id
            || hoveredNode?.id === node.id
            || Boolean(selectedCorridorEmphasis?.nodeIds.includes(node.id));
          const rootPacking = (node as KnowledgeNodeData & {
            __knowledgeRootPacking?: { collisionRadius?: number };
          }).__knowledgeRootPacking;
          const naturalRadius = rootPacking?.collisionRadius ?? getKnowledgeNodeScale({
            metadata: node.metadata,
            degree: node.graphDegree,
            focused,
            importanceScore: node.graphImportanceScore,
            sourceCoverageCount: node.sourceCoverageCount,
          }).radius;
          const renderedBodyRadius = placement
            ? getKnowledgeGraph3DRenderedNodeRadius(node, naturalRadius, placement.projectedScale)
            : Number.NaN;
          const labelElement = Array.from(
            document.querySelectorAll<HTMLElement>('[data-knowledge-3d-node-label]'),
          ).find((element) => element.getAttribute('data-knowledge-3d-node-label') === node.id);
          const canvasElement = document.querySelector<HTMLCanvasElement>(
            '[data-knowledge-canvas-primary="true"] canvas',
          );
          const canvasRect = canvasElement?.getBoundingClientRect();
          const labelRect = labelElement?.getBoundingClientRect();
          const bodyBounds = camera && Number.isFinite(renderedBodyRadius)
            ? getKnowledgeGraphProjectedSphereBounds({
                camera,
                center: { x: worldPoint.x, y: worldPoint.y, z: worldPoint.z },
                radius: renderedBodyRadius,
                width: canvasRect?.width ?? width ?? 800,
                height: canvasRect?.height ?? height ?? 600,
              })
            : null;
          const labelBounds = labelRect && canvasRect ? {
            left: labelRect.left - canvasRect.left,
            top: labelRect.top - canvasRect.top,
            right: labelRect.right - canvasRect.left,
            bottom: labelRect.bottom - canvasRect.top,
          } : null;
          const projectedBounds = bodyBounds || labelBounds ? {
            left: Math.min(bodyBounds?.left ?? Number.POSITIVE_INFINITY, labelBounds?.left ?? Number.POSITIVE_INFINITY),
            top: Math.min(bodyBounds?.top ?? Number.POSITIVE_INFINITY, labelBounds?.top ?? Number.POSITIVE_INFINITY),
            right: Math.max(bodyBounds?.right ?? Number.NEGATIVE_INFINITY, labelBounds?.right ?? Number.NEGATIVE_INFINITY),
            bottom: Math.max(bodyBounds?.bottom ?? Number.NEGATIVE_INFINITY, labelBounds?.bottom ?? Number.NEGATIVE_INFINITY),
          } : null;
          return {
            id: node.id,
            x: Number.isFinite(node.x) ? node.x! : null,
            y: Number.isFinite(node.y) ? node.y! : null,
            z: Number.isFinite(node.z) ? node.z! : null,
            screenX: Number.isFinite(Number(point?.x)) ? Number(point?.x) : null,
            screenY: Number.isFinite(Number(point?.y)) ? Number(point?.y) : null,
            depth: Number.isFinite(depth) ? depth : null,
            isInFrustum: isInFrustum ? 1 : 0,
            cameraX: Number.isFinite(camera?.position?.x) ? Number(camera?.position?.x) : null,
            cameraY: Number.isFinite(camera?.position?.y) ? Number(camera?.position?.y) : null,
            cameraZ: Number.isFinite(camera?.position?.z) ? Number(camera?.position?.z) : null,
            targetX: Number.isFinite(controls?.target?.x) ? Number(controls?.target?.x) : null,
            targetY: Number.isFinite(controls?.target?.y) ? Number(controls?.target?.y) : null,
            targetZ: Number.isFinite(controls?.target?.z) ? Number(controls?.target?.z) : null,
            enablePan: controls?.enablePan === true ? 1 : 0,
            rightMouseAction: Number.isFinite(controls?.mouseButtons?.RIGHT)
              ? Number(controls?.mouseButtons?.RIGHT)
              : null,
            sceneChildren: Array.isArray(scene?.children) ? scene.children.length : null,
            renderCalls: Number.isFinite(renderCalls) ? Number(renderCalls) : null,
            renderTriangles: Number.isFinite(renderTriangles) ? Number(renderTriangles) : null,
            rendererWidth: Number.isFinite(rendererWidth) ? Number(rendererWidth) : null,
            rendererHeight: Number.isFinite(rendererHeight) ? Number(rendererHeight) : null,
            bodyBounds,
            labelBounds,
            projectedBounds,
          };
        });
    };
    qaWindow.__knowledgeGraphQaPresentationDebug = () => {
      const sceneNodeGroups: THREE.Object3D[] = [];
      fgRef.current?.scene?.()?.traverse?.((object: THREE.Object3D & { __graphObjType?: string }) => {
        if (object.__graphObjType === 'node') sceneNodeGroups.push(object);
      });
      const summarizeObject = (id: string, object: THREE.Object3D) => ({
        id,
        objectScale: Math.max(object.scale.x, object.scale.y, object.scale.z),
        hasBody: Boolean(object.userData.knowledgeBodyMesh),
        visibleChildren: object.children.filter((child) => child.visible).length,
        childCount: object.children.length,
        bodyScale: object.userData.knowledgeBodyMesh
          ? Math.max(...(object.userData.knowledgeBodyMesh as THREE.Mesh).scale.toArray())
          : 0,
      });
      const sceneGroups = sceneNodeGroups.map((object) => summarizeObject(
        String((object as THREE.Object3D & { __data?: { id?: string } }).__data?.id ?? object.uuid),
        object,
      ));
      return ({
      phase: presentation.phase,
      elapsedMs: presentation.elapsedMs ?? 0,
      animatedNodeIds: presentation.animatedNodeIds ?? [],
      animatedRelationIds: presentation.animatedRelationIds ?? [],
      expandedNodeIds,
      materializedNodeIds,
      graphNodes: (graphData.nodes as Array<KnowledgeNodeData & { __knowledgeAutomaticAnchor?: unknown }>).map((node) => ({
        id: node.id,
        anchor: node.__knowledgeAutomaticAnchor ?? null,
      })),
      sceneGroups,
      retainedObjects: sceneGroups,
      componentCache: [...nodeObjectsByIdRef.current.entries()].map(([id, { object }]) => (
        summarizeObject(id, object)
      )),
      edges: graphData.links.map((link: any) => ({
        id: getKnowledgeGraphPresentationLinkKey(link),
        curvature: laneCurvatureByLinkKey.get(getKnowledgeGraphPresentationLinkKey(link)) ?? 0,
        targetArrow: getKnowledgeGraphEdgePresentation(link).directed,
      })),
      });
    };
    qaWindow.__knowledgeGraphQaResetViewport = () => {
      fgRef.current?.cameraPosition?.({ x: 0, y: 0, z: 350 }, { x: 0, y: 0, z: 0 }, 0);
      const controls = fgRef.current?.controls?.() as { update?: () => void } | undefined;
      const camera = fgRef.current?.camera?.() as {
        updateMatrixWorld?: (force?: boolean) => void;
        updateProjectionMatrix?: () => void;
      } | undefined;
      controls?.update?.();
      camera?.updateProjectionMatrix?.();
      camera?.updateMatrixWorld?.(true);
    };
    qaWindow.__knowledgeGraphQaCenterNode = (nodeId: string) => {
      const node = (fgRef.current?.graphData?.()?.nodes ?? graphData.nodes)
        .find((candidate: KnowledgeNodeData & { x?: number; y?: number; z?: number }) => candidate.id === nodeId) as
        | (KnowledgeNodeData & { x?: number; y?: number; z?: number })
        | undefined;
      const x = Number(node?.x ?? node?.positionX);
      const y = Number(node?.y ?? node?.positionY);
      const z = Number(node?.z ?? node?.positionZ ?? 0);
      if (![x, y, z].every(Number.isFinite)) return;
      fgRef.current?.cameraPosition?.({ x, y, z: z + 350 }, { x, y, z }, 0);
      const controls = fgRef.current?.controls?.() as { update?: () => void } | undefined;
      const camera = fgRef.current?.camera?.() as {
        updateMatrixWorld?: (force?: boolean) => void;
        updateProjectionMatrix?: () => void;
      } | undefined;
      controls?.update?.();
      camera?.updateProjectionMatrix?.();
      camera?.updateMatrixWorld?.(true);
    };
    return () => {
      delete qaWindow.__knowledgeGraphQaNodePoints;
      delete qaWindow.__knowledgeGraphQaNodeDebug;
      delete qaWindow.__knowledgeGraphQaPresentationDebug;
      delete qaWindow.__knowledgeGraphQaResetViewport;
      delete qaWindow.__knowledgeGraphQaCenterNode;
    };
  }, [
    expandedNodeIds,
    graphData,
    height,
    hoveredNode?.id,
    laneCurvatureByLinkKey,
    materializedNodeIds,
    presentation.animatedNodeIds,
    presentation.animatedRelationIds,
    presentation.elapsedMs,
    presentation.phase,
    selectedNode?.id,
    selectedCorridorEmphasis,
    width,
  ]);

  const labelPlacements = useMemo(() => {
    void cameraProjectionRevision;
    return placeKnowledgeGraphLabels({
    nodes: graphData.nodes.map((node: any) => {
      const camera = fgRef.current?.camera?.() as THREE.Camera | undefined;
      let projection: {
        screenX?: number;
        screenY?: number;
        projectedScale?: number;
        isInFrustum?: boolean;
        depth?: number;
      } = {};
      if (camera && (width ?? 800) > 0 && (height ?? 600) > 0) {
        camera.updateMatrixWorld();
        const project = (point: { x: number; y: number; z: number }) => {
          const value = new THREE.Vector3(point.x, point.y, point.z).project(camera);
          return { x: value.x, y: value.y, z: value.z };
        };
        const center = projectKnowledgeWorldPoint({
          x: node.x ?? 0, y: node.y ?? 0, z: node.z ?? 0,
          width: width ?? 800, height: height ?? 600, project,
        });
        const projectedScale = getKnowledgeProjectionScale({
          center: { x: node.x ?? 0, y: node.y ?? 0, z: node.z ?? 0 },
          right: new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion),
          up: new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion),
          width: width ?? 800,
          height: height ?? 600,
          project,
        });
        const worldPoint = new THREE.Vector3(node.x ?? 0, node.y ?? 0, node.z ?? 0);
        const cameraPoint = worldPoint.clone().applyMatrix4(camera.matrixWorldInverse);
        const ndc = worldPoint.clone().project(camera);
        const depth = -cameraPoint.z;
        const perspectiveCamera = camera as THREE.PerspectiveCamera;
        const near = Number.isFinite(perspectiveCamera.near) ? perspectiveCamera.near : 0;
        const far = Number.isFinite(perspectiveCamera.far) ? perspectiveCamera.far : Number.POSITIVE_INFINITY;
        const finite = [worldPoint.x, worldPoint.y, worldPoint.z, ndc.x, ndc.y, ndc.z, depth]
          .every(Number.isFinite);
        const isInFrustum = finite && depth >= near && depth <= far
          && ndc.x >= -1 && ndc.x <= 1
          && ndc.y >= -1 && ndc.y <= 1
          && ndc.z >= -1 && ndc.z <= 1;
        projection = { screenX: center.x, screenY: center.y, projectedScale, isInFrustum, depth };
      }
      return {
        id: node.id, x: node.x ?? 0, y: node.y ?? 0,
        ...projection,
        bodyRadius: node.__knowledgeRootPacking?.collisionRadius
          ?? getKnowledgeNodeMaximumPresentationRadius(node),
        isRootBubble: Boolean(node.__knowledgeRootPacking),
        isKeyNode: node.labelPriority,
        importance: node.importance,
        labelBounds: node.__knowledgeRootPacking?.labelBounds ?? getKnowledgeNodeLabelBounds({
          name: node.name, bodyRadius: getKnowledgeNodeMaximumPresentationRadius(node),
        }),
      };
    }),
    scale: viewportScale, labelMode,
    width: width ?? 800, height: height ?? 600,
    padding: getKnowledgeGraphViewportSafeInsets({ width: width ?? 800, height: height ?? 600 }),
    enforceViewport: true,
      selectedNodeId: selectedNode?.id, hoveredNodeId: hoveredNode?.id,
    });
  }, [cameraProjectionRevision, graphData.nodes, height, hoveredNode?.id, labelMode, selectedNode?.id, viewportScale, width]);
  labelPlacementsRef.current = labelPlacements;

  const flushCameraPose = useCallback((scopeKey: string | null) => {
    if (!scopeKey || !onCameraPoseChange || !posePersistenceEnabledScopesRef.current.has(scopeKey)) return;
    if (pendingPoseReportScopeRef.current === scopeKey && poseReportTimerRef.current !== null) {
      window.clearTimeout(poseReportTimerRef.current);
      poseReportTimerRef.current = null;
      pendingPoseReportScopeRef.current = null;
    }
    const camera = fgRef.current?.camera?.() as THREE.PerspectiveCamera | undefined;
    const controls = fgRef.current?.controls?.() as { target?: THREE.Vector3 } | undefined;
    if (!camera || !controls?.target) return;
    const values = [
      camera.position.x, camera.position.y, camera.position.z,
      controls.target.x, controls.target.y, controls.target.z,
      camera.up.x, camera.up.y, camera.up.z,
    ];
    if (!values.every(Number.isFinite)) return;
    const signature = values.join(':');
    if (lastReportedPoseSignatureByScopeRef.current.get(scopeKey) === signature) return;
    lastReportedPoseSignatureByScopeRef.current.set(scopeKey, signature);
    onCameraPoseChange(scopeKey, {
      position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      target: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
      up: { x: camera.up.x, y: camera.up.y, z: camera.up.z },
    });
  }, [onCameraPoseChange]);
  const scheduleCameraPoseReport = useCallback((scopeKey: string | null) => {
    if (!scopeKey) return;
    if (poseReportTimerRef.current !== null) {
      window.clearTimeout(poseReportTimerRef.current);
      poseReportTimerRef.current = null;
      if (pendingPoseReportScopeRef.current !== scopeKey) {
        flushCameraPose(pendingPoseReportScopeRef.current);
      }
    }
    pendingPoseReportScopeRef.current = scopeKey;
    poseReportTimerRef.current = window.setTimeout(() => {
      poseReportTimerRef.current = null;
      pendingPoseReportScopeRef.current = null;
      flushCameraPose(scopeKey);
    }, 100);
  }, [flushCameraPose]);
  useLayoutEffect(() => {
    const scopeKey = autoFitScopeKey;
    return () => flushCameraPose(scopeKey);
  }, [autoFitScopeKey, flushCameraPose]);

  const scheduleProjectionRefresh = useCallback(() => {
    // DOM labels depend on live camera projection/frustum state. Keep React work
    // bounded to one commit per display frame; node Object3D instances are updated
    // independently and are not recreated by this revision.
    if (projectionAnimationFrameRef.current !== null) return;
    projectionAnimationFrameRef.current = window.requestAnimationFrame(() => {
      projectionAnimationFrameRef.current = null;
      setCameraProjectionRevision((value) => value + 1);
    });
  }, []);

  useEffect(() => () => {
    if (projectionAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(projectionAnimationFrameRef.current);
    }
  }, []);

  useEffect(() => {
    if (!autoFitScopeKey || !restoredCameraPose || !fgRef.current?.cameraPosition) return;
    if (restoredCameraScopeRef.current === autoFitScopeKey) return;
    restoredCameraScopeRef.current = autoFitScopeKey;
    restoredFitRequestIdRef.current = fitViewRequest.id;
    posePersistenceEnabledScopesRef.current.add(autoFitScopeKey);
    const camera = fgRef.current.camera?.() as THREE.PerspectiveCamera | undefined;
    camera?.up.set(restoredCameraPose.up.x, restoredCameraPose.up.y, restoredCameraPose.up.z);
    const safePose = compactRootView
      ? normalizeKnowledgeRootCameraPose(restoredCameraPose, getKnowledgeRootProjectionSafeCameraDistance({
        viewportHeight: height ?? 600,
        fovDegrees: camera?.fov,
        zoom: camera?.zoom,
      }))
      : restoredCameraPose;
    fgRef.current.cameraPosition(safePose.position, safePose.target, 0);
    scheduleProjectionRefresh();
  }, [autoFitScopeKey, compactRootView, fitViewRequest.id, height, restoredCameraPose, scheduleProjectionRefresh]);

  useEffect(() => {
    const controls = fgRef.current?.controls?.() as {
      addEventListener?: (event: string, listener: () => void) => void;
      removeEventListener?: (event: string, listener: () => void) => void;
      enablePan?: boolean;
      enableRotate?: boolean;
      enableZoom?: boolean;
      maxDistance?: number;
      screenSpacePanning?: boolean;
      mouseButtons?: { RIGHT?: number };
    } | undefined;
    if (!controls?.addEventListener) return;
    const previous = {
      enablePan: controls.enablePan,
      enableRotate: controls.enableRotate,
      enableZoom: controls.enableZoom,
      maxDistance: controls.maxDistance,
      screenSpacePanning: controls.screenSpacePanning,
      rightMouseButton: controls.mouseButtons?.RIGHT,
    };
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    if (controls.mouseButtons) controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    const rootControlsPolicy = getKnowledgeGraph3DControlsPolicy({
      compactRootView,
      viewportHeight: height ?? 600,
      fovDegrees: (fgRef.current?.camera?.() as THREE.PerspectiveCamera | undefined)?.fov,
      zoom: (fgRef.current?.camera?.() as THREE.PerspectiveCamera | undefined)?.zoom,
    });
    const restoreRootControls = applyKnowledgeGraph3DControlsPolicy(controls, rootControlsPolicy);
    const handleControlsChange = () => {
      scheduleProjectionRefresh();
      scheduleCameraPoseReport(autoFitScopeKey);
    };
    controls.addEventListener('change', handleControlsChange);
    return () => {
      controls.removeEventListener?.('change', handleControlsChange);
      restoreRootControls();
      controls.enablePan = previous.enablePan;
      controls.enableRotate = previous.enableRotate;
      controls.enableZoom = previous.enableZoom;
      controls.maxDistance = previous.maxDistance;
      controls.screenSpacePanning = previous.screenSpacePanning;
      if (controls.mouseButtons) controls.mouseButtons.RIGHT = previous.rightMouseButton;
      flushCameraPose(autoFitScopeKey);
    };
  }, [autoFitScopeKey, compactRootView, flushCameraPose, height, scheduleCameraPoseReport, scheduleProjectionRefresh]);

  useEffect(() => {
    const canvas = fgRef.current?.renderer?.()?.domElement as HTMLCanvasElement | undefined;
    if (!canvas) return;
    const preventContextMenu = (event: Event) => event.preventDefault();
    canvas.addEventListener('contextmenu', preventContextMenu, true);
    return () => canvas.removeEventListener('contextmenu', preventContextMenu, true);
  }, []);

  // 2. 创建自定义节点 3D 对象
  const populateNodeObject = useCallback((group: THREE.Group, node: any) => {
    const ownedChildren = group.userData.knowledgeOwnedChildren as THREE.Object3D[] | undefined;
    const resourcesToDispose = group.children.length > 0 ? group.children : ownedChildren ?? [];
    resourcesToDispose.forEach((child) => disposeKnowledgeGraphObject3D(child));
    group.clear();
    group.renderOrder = 2;
    const visualState = nodeVisualStateRef.current;
    const presentationOpacity = getKnowledgeGraphPresentationNodeOpacity({
      ...visualState.presentation, nodeId: node.id,
    }) * getKnowledgeGraphNodeEmphasisOpacity(node.id, {
      selectedNodeId: visualState.selectedNodeId,
      nodeIds: visualState.corridorNodeIds,
      edgeIds: [],
    });

    // 获取颜色配置
    const fillColor = getNodeColor(node.knowledgeDim);
    const glowColor = getGlowColor(node.bloomLevel);
    const isSelected = visualState.selectedNodeId === node.id;
    const isHovered = visualState.hoveredNodeId === node.id;
    const isActive = isSelected || isHovered
      || visualState.corridorNodeIds.includes(node.id);
    const nodeScale = getKnowledgeNodeScale({
      metadata: node.metadata,
      degree: node.graphDegree,
      focused: isActive,
      importanceScore: node.graphImportanceScore,
      sourceCoverageCount: node.sourceCoverageCount,
    });
    const presentationScale = getKnowledgeGraphPresentationNodeScale({
      ...visualState.presentation, nodeId: node.id,
    });
    const rootPacking = node.__knowledgeRootPacking;
    const isRootBubble = Boolean(rootPacking);
    const projectedScale = labelPlacementsRef.current.get(node.id)?.projectedScale ?? viewportScaleRef.current;
    const naturalRadius = (rootPacking?.collisionRadius ?? nodeScale.radius) * presentationScale;
    const presentationRadius = isRootBubble
      ? naturalRadius
      : getKnowledgeGraph3DNodePresentationRadius(naturalRadius, projectedScale);
    const presentationGlowRadius = isRootBubble
      ? presentationRadius * 1.08
      : nodeScale.glowRadius * presentationScale;
    const semanticRegionStyle = getKnowledgeSemanticRegionStyle(node, isLightTheme);

    if (!isRootBubble && semanticRegionStyle.enabled) {
      const regionRadius = Math.min(
        semanticRegionStyle.maxRadius,
        presentationRadius * semanticRegionStyle.radiusMultiplier
      );
      const territoryGeometry = new THREE.RingGeometry(
        regionRadius * 0.82,
        regionRadius,
        64
      );
      const territoryMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(hexToRgba(semanticRegionStyle.strokeColor, 1)),
        transparent: true,
        opacity: semanticRegionStyle.strokeOpacity * presentationOpacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const territory = new THREE.Mesh(territoryGeometry, territoryMaterial);
      territory.rotation.x = Math.PI / 2;
      group.add(territory);
    }

    // 1. 创建节点几何体
    const geometry = isRootBubble
      ? new THREE.SphereGeometry(5, 40, 40)
      : createGeometryByConceptShape(getKnowledgeConceptNodeShape(node));

    // 2. 创建材质（带发光效果）
    const material = new THREE.MeshPhongMaterial({
      color: new THREE.Color(hexToRgba(
        isRootBubble ? KNOWLEDGE_ROOT_BUBBLE_STYLE.surface : fillColor,
        1,
      )),
      emissive: new THREE.Color(hexToRgba(
        isRootBubble
          ? KNOWLEDGE_ROOT_BUBBLE_STYLE.surfaceDepth
          : glowColor ?? fillColor,
        1,
      )),
      emissiveIntensity: isRootBubble
        ? KNOWLEDGE_ROOT_BUBBLE_STYLE.emissiveIntensity
        : glowColor ? (isActive ? 0.8 : 0.5) : (isActive ? 0.4 : 0.2),
      transparent: true,
      opacity: (isActive ? 1 : 0.9) * presentationOpacity,
      shininess: isRootBubble ? KNOWLEDGE_ROOT_BUBBLE_STYLE.shininess : 100,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 2;
    mesh.scale.setScalar(presentationRadius / 5);
    group.add(mesh);
    group.userData.knowledgeBodyMesh = mesh;
    group.userData.knowledgeNaturalRadius = naturalRadius;
    group.userData.knowledgeIsRootBubble = isRootBubble;
    group.userData.knowledgeRootLabelComplete = isRootBubble;

    const decoration = readActiveNodeDecoration(node.metadata);
    if (!isRootBubble && decoration) {
      attachActiveNodeDecorations3d(group, THREE, {
        radius: presentationRadius,
        decoration,
        opacity: presentationOpacity,
      });
    }

    // 3. 创建辉光层（如果有 bloomLevel）
    if (isRootBubble || glowColor) {
      const glowGeometry = new THREE.SphereGeometry(
        isRootBubble ? presentationGlowRadius : presentationGlowRadius / 1.7,
        16,
        16,
      );
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(hexToRgba(
          isRootBubble ? KNOWLEDGE_ROOT_BUBBLE_STYLE.glow : glowColor!,
          1,
        )),
        transparent: true,
        opacity: (isRootBubble ? (isActive ? 0.2 : 0.1) : isActive ? 0.3 : 0.15)
          * presentationOpacity,
        depthWrite: false,
      });
      const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
      group.add(glowMesh);
    }

    // 4. 创建选中环
    const ringInnerRadius = presentationRadius + 0.6;
    const ringOuterRadius = ringInnerRadius + Math.max(0.8, presentationRadius * 0.12);
    const ringGeometry = new THREE.RingGeometry(ringInnerRadius, ringOuterRadius, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.8 * presentationOpacity,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.visible = isSelected;
    group.add(ring);
    group.userData.knowledgeSelectionRing = ring;

    // 候选节点：虚线轮廓环 + 候选徽标，绝不被误认为已审知识
    if (!isRootBubble && node.candidate === true) {
      const candidateRingRadius = presentationRadius + 1.1;
      const candidateRing = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(
          new THREE.EllipseCurve(0, 0, candidateRingRadius, candidateRingRadius, 0, Math.PI * 2).getPoints(48)
        ),
        new THREE.LineDashedMaterial({
          color: new THREE.Color(hexToRgba(KNOWLEDGE_GRAPH_CANDIDATE_PRESENTATION.color, 1)),
          dashSize: 1.6,
          gapSize: 1.1,
          transparent: true,
          opacity: 0.95 * presentationOpacity,
        })
      );
      candidateRing.computeLineDistances();
      candidateRing.rotation.x = Math.PI / 2;
      group.add(candidateRing);

      const badge = createKnowledgeGraphCandidateBadge(0.95 * presentationOpacity);
      badge.position.set(0, presentationRadius + 2.2, 0);
      group.add(badge);
    }

    // 根气泡活力：外晕 halo + 轮缘光弧（透明材质，活力帧只写透明度）。
    if (isRootBubble) {
      const vitalityHalo = new THREE.Mesh(
        new THREE.SphereGeometry(presentationRadius * KNOWLEDGE_ROOT_BUBBLE_VITALITY.halo.radiusGain, 24, 24),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(hexToRgba(KNOWLEDGE_ROOT_BUBBLE_VITALITY.halo.color, 1)),
          transparent: true,
          opacity: KNOWLEDGE_ROOT_BUBBLE_VITALITY.halo.alphaMin * presentationOpacity,
          depthWrite: false,
        })
      );
      vitalityHalo.renderOrder = 1;
      group.add(vitalityHalo);
      group.userData.knowledgeVitalityHalo = vitalityHalo;

      const rimArcConfig = KNOWLEDGE_ROOT_BUBBLE_VITALITY.rimArc;
      const rimArcMesh = new THREE.Mesh(
        new THREE.RingGeometry(
          presentationRadius * 0.88,
          presentationRadius * rimArcConfig.radiusGain,
          32,
          1,
          rimArcConfig.startAngle,
          rimArcConfig.endAngle - rimArcConfig.startAngle
        ),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(hexToRgba(rimArcConfig.color, 1)),
          transparent: true,
          opacity: (isActive ? rimArcConfig.activeAlpha : rimArcConfig.inactiveAlpha) * presentationOpacity,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      rimArcMesh.renderOrder = 3;
      rimArcMesh.rotation.x = Math.PI / 2;
      group.add(rimArcMesh);
      group.userData.knowledgeVitalityRimArc = rimArcMesh;
    }

    group.userData.knowledgePresentationRadius = presentationRadius;
    group.userData.knowledgeOwnedChildren = [...group.children];
  }, [isLightTheme]);

  nodeObjectBuilderRef.current = populateNodeObject;

  const createNodeObject = useCallback((node: any) => {
    const dataSignature = getKnowledgeGraphNodeVisualDataSignature(node);
    const group = new THREE.Group();
    nodeObjectBuilderRef.current(group, node);
    const placement = labelPlacementsRef.current.get(node.id);
    if (placement) updateKnowledgeGraphNodeProjection(group, placement);
    nodeObjectsByIdRef.current.set(node.id, { node, object: group, dataSignature });
    return group;
  }, []);

  useEffect(() => {
    const activeNodeById = new Map(graphData.nodes.map((node: any) => [node.id, node]));
    nodeObjectsByIdRef.current.forEach((entry, nodeId) => {
      const node = activeNodeById.get(nodeId);
      if (!node) {
        nodeObjectsByIdRef.current.delete(nodeId);
        return;
      }
      const dataSignature = getKnowledgeGraphNodeVisualDataSignature(node);
      if (entry.dataSignature !== dataSignature) {
        nodeObjectBuilderRef.current(entry.object, node);
        entry.dataSignature = dataSignature;
      }
      entry.node = node;
    });
  }, [graphData.nodes]);

  useEffect(() => {
    nodeObjectsByIdRef.current.forEach(({ node, object }) => {
      const body = object.userData.knowledgeBodyMesh as THREE.Mesh<
        THREE.BufferGeometry, THREE.MeshPhongMaterial
      > | undefined;
      if (body) {
        const isRootBubble = Boolean(node.__knowledgeRootPacking);
        const fillColor = isRootBubble
          ? KNOWLEDGE_ROOT_BUBBLE_STYLE.surface
          : getNodeColor(node.knowledgeDim);
        const glowColor = isRootBubble
          ? KNOWLEDGE_ROOT_BUBBLE_STYLE.surfaceDepth
          : getGlowColor(node.bloomLevel);
        body.material.color.set(new THREE.Color(hexToRgba(fillColor, 1)));
        body.material.emissive.set(new THREE.Color(hexToRgba(glowColor ?? fillColor, 1)));
        body.material.needsUpdate = true;
        body.visible = true;
      }
    });
  }, [height, isLightTheme]);

  useEffect(() => {
    const currentFocusedNodeIds = new Set([
      selectedNode?.id,
      hoveredNode?.id,
      ...(selectedCorridorEmphasis?.nodeIds ?? []),
    ].filter((nodeId): nodeId is string => Boolean(nodeId)));
    const changedNodeIds = new Set([
      ...previousFocusedNodeIdsRef.current,
      ...currentFocusedNodeIds,
    ]);
    changedNodeIds.forEach((nodeId) => {
      const entry = nodeObjectsByIdRef.current.get(nodeId);
      if (!entry) return;
      const isSelected = selectedNode?.id === nodeId;
      const isActive = isSelected || hoveredNode?.id === nodeId
        || Boolean(selectedCorridorEmphasis?.nodeIds.includes(nodeId));
      const nodeScale = getKnowledgeNodeScale({
        metadata: entry.node.metadata,
        degree: entry.node.graphDegree,
        focused: isActive,
        importanceScore: entry.node.graphImportanceScore,
        sourceCoverageCount: entry.node.sourceCoverageCount,
      });
      const presentationScale = getKnowledgeGraphPresentationNodeScale({ ...presentation, nodeId });
      const naturalRadius = (entry.node.__knowledgeRootPacking?.collisionRadius ?? nodeScale.radius)
        * presentationScale;
      const renderedRadius = getKnowledgeGraph3DRenderedNodeRadius(
        entry.node,
        naturalRadius,
        labelPlacementsRef.current.get(nodeId)?.projectedScale ?? viewportScaleRef.current,
      );
      const mesh = entry.object.userData.knowledgeBodyMesh as THREE.Mesh | undefined;
      if (mesh) mesh.scale.setScalar(renderedRadius / 5);
      entry.object.userData.knowledgeNaturalRadius = naturalRadius;
      entry.object.userData.knowledgePresentationRadius = renderedRadius;
      const ring = entry.object.userData.knowledgeSelectionRing as THREE.Mesh | undefined;
      if (ring) ring.visible = isSelected;
    });
    previousFocusedNodeIdsRef.current = currentFocusedNodeIds;
  }, [hoveredNode?.id, presentation, selectedCorridorEmphasis, selectedNode?.id]);

  useEffect(() => {
    nodeObjectsByIdRef.current.forEach(({ node, object }) => {
      const placement = labelPlacements.get(node.id);
      if (placement) {
        updateKnowledgeGraphNodeProjection(object, placement);
      }
    });
  }, [height, labelPlacements]);

  const getLinkAppearance = useCallback((link: any) => {
    const { style } = getKnowledgeGraphEdgePresentation(link);
    const strength = typeof link.strength === 'number'
      ? Math.min(1, Math.max(0, link.strength))
      : 1;
    const sourceId = typeof link.source === 'object' ? link.source.id : link.sourceId;
    const targetId = typeof link.target === 'object' ? link.target.id : link.targetId;
    const focusState = hoveredNode?.id
      ? (sourceId === hoveredNode.id || targetId === hoveredNode.id ? 'active' : 'dimmed')
      : getKnowledgeGraphEdgeEmphasisState({
        link,
        emphasis: selectedCorridorEmphasis,
        structuralForegroundEdgeIds: structuralForegroundEdgeIdSet,
      });
    const sourceNode = typeof link.source === 'object' ? link.source : null;
    const targetNode = typeof link.target === 'object' ? link.target : null;
    const renderModulation = getKnowledgeGraphEdgeRenderModulation({
      candidate: sourceNode?.candidate === true || targetNode?.candidate === true,
      evidenceState: link.evidenceState,
    });
    const opacity = getKnowledgeGraphEffectiveEdgeOpacity(style, strength, focusState)
      * renderModulation.opacityFactor
      * getKnowledgeGraphPresentationLinkOpacity({
        ...presentation,
        sourceId,
        targetId,
      });
    return {
      color: isLightTheme ? style.lightColor : style.darkColor,
      opacity,
      width: getKnowledgeGraphEffectiveEdgeWidth(style, strength, focusState, '3d')
        * renderModulation.widthFactor,
    };
  }, [hoveredNode?.id, isLightTheme, presentation, selectedCorridorEmphasis, structuralForegroundEdgeIdSet]);

  const createPresentationLinkObject = useCallback((link: any) => {
    const linkId = getKnowledgeGraphPresentationLinkKey(link);
    const existing = linkObjectsByIdRef.current.get(linkId);
    if (existing) return existing;
    const { style, directed } = getKnowledgeGraphEdgePresentation(link);
    const group = createKnowledgeGraphPresentationLinkGroup({ directed, dash: style.dash });
    linkObjectsByIdRef.current.set(linkId, group);
    return group;
  }, []);

  const updatePresentationLinkObjectImpl = useCallback((
    linkObject: THREE.Object3D,
    coordinates: {
      start: { x: number; y: number; z: number };
      end: { x: number; y: number; z: number };
    },
    link: any,
  ) => {
    const group = linkObject as THREE.Group;
    group.position.set(0, 0, 0);
    group.quaternion.identity();
    group.scale.set(1, 1, 1);
    group.updateMatrixWorld(true);
    const line = group.userData.presentationLine as THREE.Mesh;
    const arrowMesh = group.userData.presentationArrow as THREE.Mesh;
    const motionMarkerMesh = group.userData.presentationMotionMarker as THREE.Mesh;
    const sourceId = typeof link.source === 'object' ? link.source.id : link.sourceId;
    const targetId = typeof link.target === 'object' ? link.target.id : link.targetId;
    const progress = getKnowledgeGraphPresentationLinkProgress({
      ...presentation,
      sourceId,
      targetId,
    });
    const sourceNode = typeof link.source === 'object' ? link.source : null;
    const targetNode = typeof link.target === 'object' ? link.target : null;
    const getRadius = (node: any) => getKnowledgeGraph3DRenderedNodeRadius(
      node,
      (node?.__knowledgeRootPacking?.collisionRadius ?? getKnowledgeNodeScale({
        metadata: node?.metadata,
        degree: node?.graphDegree,
        focused: selectedCorridorEmphasis?.nodeIds.includes(node?.id)
          || selectedNode?.id === node?.id
          || hoveredNode?.id === node?.id,
        importanceScore: node?.graphImportanceScore,
        sourceCoverageCount: node?.sourceCoverageCount,
      }).radius) * getKnowledgeGraphPresentationNodeScale({ ...presentation, nodeId: node?.id }),
      labelPlacementsRef.current.get(node?.id)?.projectedScale ?? viewportScaleRef.current,
    );
    const sourcePresentationRadius = getRadius(sourceNode);
    const targetPresentationRadius = getRadius(targetNode);
    const linkKey = getKnowledgeGraphPresentationLinkKey(link);
    const laneCurvature = laneCurvatureByLinkKey.get(linkKey) ?? 0;
    const appearance = getLinkAppearance(link);
    const { directed } = getKnowledgeGraphEdgePresentation(link);
    const arrowLength = getKnowledgeGraph3DArrowLength(
      labelPlacementsRef.current.get(targetId)?.projectedScale ?? viewportScaleRef.current,
    );
    const pixelsPerWorldUnit = Math.max(0.0001, Math.min(
      labelPlacementsRef.current.get(sourceId)?.projectedScale ?? viewportScaleRef.current,
      labelPlacementsRef.current.get(targetId)?.projectedScale ?? viewportScaleRef.current,
    ));
    const geometrySignature = [
      coordinates.start.x,
      coordinates.start.y,
      coordinates.start.z,
      coordinates.end.x,
      coordinates.end.y,
      coordinates.end.z,
      sourcePresentationRadius,
      targetPresentationRadius,
      sourceNode ? getKnowledgeConceptNodeShape(sourceNode) : '',
      targetNode ? getKnowledgeConceptNodeShape(targetNode) : '',
      laneCurvature,
      progress,
      appearance.color,
      appearance.opacity,
      appearance.width,
      directed,
      arrowLength,
      width,
      height,
      pixelsPerWorldUnit,
    ].join('|');
    let fullPath = group.userData.presentationFullPath as ReturnType<typeof createKnowledgeGraphRendererEdgePath> | undefined;
    if (!fullPath || group.userData.presentationGeometrySignature !== geometrySignature) {
      fullPath = createKnowledgeGraphRendererEdgePath({
        renderer: '3d',
        link,
        source: coordinates.start,
        target: coordinates.end,
        sourceNodeType: sourceNode?.nodeType,
        targetNodeType: targetNode?.nodeType,
        sourceShape: sourceNode ? getKnowledgeConceptNodeShape(sourceNode) : undefined,
        targetShape: targetNode ? getKnowledgeConceptNodeShape(targetNode) : undefined,
        sourcePresentationRadius,
        targetPresentationRadius,
        laneCurvature,
      });
      group.userData.presentationFullPath = fullPath;
      group.userData.presentationGeometrySignature = geometrySignature;

      const drawPath = getKnowledgeGraphPartialEdgePath(fullPath, progress);
      updateKnowledgeGraph3DLine(line, {
        points: sampleKnowledgeGraphEdgePath(drawPath).map(
          (point) => new THREE.Vector3(point.x, point.y, point.z),
        ),
        color: appearance.color,
        opacity: appearance.opacity,
        visible: !fullPath.hiddenReason && progress > 0,
        emphasized: getKnowledgeGraphEdgeEmphasisState({
          link,
          emphasis: selectedCorridorEmphasis,
          structuralForegroundEdgeIds: structuralForegroundEdgeIdSet,
        }) === 'active',
        width: appearance.width,
        pixelsPerWorldUnit,
        viewport: { width: width ?? 800, height: height ?? 600 },
      });

      arrowMesh.visible = false;
      if (directed && progress >= 0.999) {
        const arrow = getKnowledgeGraphEndpointArrow(fullPath, {
          length: arrowLength,
          halfWidth: arrowLength / 2,
        });
        const position = arrowMesh.geometry.getAttribute('position') as THREE.BufferAttribute;
        [arrow.tip, arrow.left, arrow.right].forEach((point, index) => {
          position.setXYZ(index, point.x, point.y, point.z);
        });
        position.needsUpdate = true;
        const arrowMaterial = arrowMesh.material as THREE.MeshBasicMaterial;
        arrowMaterial.color.set(KNOWLEDGE_GRAPH_3D_DIRECTION_COLOR);
        arrowMaterial.opacity = 1;
        arrowMaterial.transparent = false;
      }
    }
    group.visible = !fullPath.hiddenReason && progress > 0;
    if (!group.visible) return true;
    const motionEdgeEligible = motionMarkerEdgeIdSet.has(linkKey)
      || (typeof link.id === 'string' && motionMarkerEdgeIdSet.has(link.id));
    const ambientEdgeEligible = !motionEdgeEligible && ambientFlowEdgeIdSet.has(linkKey);
    const corridorFrame = motionEdgeEligible ? getKnowledgeGraphMotionMarkerFrame(motionElapsedMsRef.current) : null;
    const ambientFrame = ambientEdgeEligible
      ? getKnowledgeGraphMotionPhasedMarkerFrame(
        motionElapsedMsRef.current,
        ambientFlowSelection.phaseOffsetByEdgeId[linkKey] ?? 0
      )
      : null;
    const activeFrame = corridorFrame ?? ambientFrame;
    motionMarkerMesh.visible = (motionEdgeEligible || ambientEdgeEligible)
      && progress >= 0.999
      && motionEnvironmentActive
      && !reducedMotion
      && Boolean(activeFrame?.visible);
    if (motionMarkerMesh.visible && activeFrame) {
      const marker = getKnowledgeGraphMotionMarkerPlacement(fullPath, activeFrame.progress);
      updateKnowledgeGraph3DMotionMarker(motionMarkerMesh, {
        visible: marker.visible,
        point: marker.point,
        tangent: marker.tangent,
        color: motionEdgeEligible ? KNOWLEDGE_GRAPH_3D_MARKER_COLOR : appearance.color,
        opacity: motionEdgeEligible ? 1 : Math.min(0.82, appearance.opacity * 0.72),
        pixelsPerWorldUnit,
        sizeScale: motionEdgeEligible ? 1 : 0.72,
      });
    }
    return true;
  }, [ambientFlowEdgeIdSet, ambientFlowSelection, getLinkAppearance, height, hoveredNode?.id, laneCurvatureByLinkKey, motionEnvironmentActive, motionMarkerEdgeIdSet, presentation, reducedMotion, selectedCorridorEmphasis, selectedNode?.id, structuralForegroundEdgeIdSet, width]);
  const updatePresentationLinkObjectRef = useRef(updatePresentationLinkObjectImpl);
  updatePresentationLinkObjectRef.current = updatePresentationLinkObjectImpl;
  const updatePresentationLinkObject = useCallback((
    object: THREE.Object3D,
    positions: { start: { x: number; y: number; z: number }; end: { x: number; y: number; z: number } },
    link: any,
  ) => updatePresentationLinkObjectRef.current(object, positions, link), []);
  const getAccessibleNodeLabel = useCallback(
    (node: any) => (
      node.richTitle?.state === 'available'
        ? node.richTitle.accessibleName
        : layoutKnowledgeNodeLabel(node.name).accessibleName
    ),
    [],
  );

  // 5. 配置物理引擎
  useEffect(() => {
    if (fgRef.current) {
      // 配置力导向参数（降低斥力使节点更紧凑）
      fgRef.current.d3Force('charge').strength(-110);
      fgRef.current.d3Force('link').distance(70);

      // 添加碰撞检测
      const d3 = require('d3');
      fgRef.current.d3Force('collide', d3.forceCollide(22).strength(0.85));
    }
  }, []);

  useEffect(() => {
    if (!fgRef.current?.cameraPosition) return;
    if ((width ?? 800) <= 0 || (height ?? 600) <= 0) return;
    const camera = fgRef.current.camera?.();
    const fov = Number.isFinite(camera?.fov) ? camera.fov : 50;
    const zoom = Number.isFinite(camera?.zoom) && camera.zoom > 0 ? camera.zoom : 1;
    const aspect = Number.isFinite(camera?.aspect) && camera.aspect > 0
      ? camera.aspect
      : (width ?? 800) / Math.max(1, height ?? 600);
    const fitSignature = `${fitViewRequest.id}:${width ?? 800}:${height ?? 600}:${window.devicePixelRatio}:${aspect}:${fov}:${zoom}:${relayoutVersion}`;
    const shouldAutoFit = Boolean(autoFitScopeKey)
      && autoFitReady
      && !autoFitConsumed
      && !consumedAutoFitScopeKeysRef.current.has(autoFitScopeKey!)
      && !cameraManipulatedRef.current
      && restoredCameraScopeRef.current !== autoFitScopeKey;
    const shouldExplicitlyFit = consumedFitSignatureRef.current !== fitSignature
      && restoredFitRequestIdRef.current !== fitViewRequest.id
      && (fitViewRequest.target !== 'root'
        || (!autoFitScopeKey && isCompactKnowledgeRootSet(nodes)));
    if (!shouldAutoFit && !shouldExplicitlyFit) return;
    if (graphData.nodes.length > 1 && settledLayoutSignatureRef.current !== layoutSignature) return;
    const effectiveWidth = Math.min(width ?? 800, (height ?? 600) * aspect);
    const positionedNodes = (fgRef.current?.graphData?.()?.nodes ?? graphData.nodes).map((node: any) => {
      const rootPacking = node.__knowledgeRootPacking as {
        collisionRadius: number;
        labelBounds: ReturnType<typeof getKnowledgeNodeLabelBounds>;
      } | undefined;
      const bodyRadius = rootPacking?.collisionRadius ?? getKnowledgeNodeMaximumPresentationRadius(node);
      return {
        id: node.id,
        name: node.name,
        x: node.x ?? 0,
        y: node.y ?? 0,
        z: node.z ?? 0,
        bodyRadius,
        isRootBubble: Boolean(rootPacking),
        isKeyNode: node.labelPriority,
        importance: node.importance,
        labelBounds: rootPacking?.labelBounds ?? getKnowledgeNodeLabelBounds({
          name: node.name,
          bodyRadius,
        }),
      };
    });
    const fit = getKnowledgeGraphViewportFit({
      nodes: positionedNodes,
      width: effectiveWidth,
      height: height ?? 600,
      padding: getKnowledgeGraphViewportSafeInsets({ width: effectiveWidth, height: height ?? 600 }),
      labelMode,
      selectedNodeId: selectedNode?.id,
      hoveredNodeId: hoveredNode?.id,
    });
    const effectiveFitScale = compactRootView
      ? Math.max(fit.scale, KNOWLEDGE_ROOT_MINIMUM_PROJECTION_SCALE)
      : fit.scale;
    const initialDistance = getPerspectiveCameraFitDistance({
      viewportHeight: height ?? 600,
      pixelsPerWorldUnit: effectiveFitScale,
      fovDegrees: fov,
      zoom,
    });
    const distance = getKnowledgeGraph3DSafeFitCameraDistance({
      nodes: positionedNodes,
      width: effectiveWidth,
      height: height ?? 600,
      initialDistance,
      cameraCenterX: fit.centerX,
      cameraCenterY: fit.cameraCenterY,
      fovDegrees: fov,
      zoom,
      labelMode,
      selectedNodeId: selectedNode?.id,
      hoveredNodeId: hoveredNode?.id,
      margin: 8,
    });
    if (fitTimerRef.current !== null) window.clearTimeout(fitTimerRef.current);
    fitTimerRef.current = window.setTimeout(() => {
      if (shouldAutoFit && cameraManipulatedRef.current) {
        fitTimerRef.current = null;
        return;
      }
      setViewportScale(effectiveFitScale);
      if (autoFitScopeKey) posePersistenceEnabledScopesRef.current.add(autoFitScopeKey);
      fgRef.current?.cameraPosition?.(
        { x: fit.centerX, y: fit.cameraCenterY, z: distance },
        { x: fit.centerX, y: fit.cameraCenterY, z: 0 },
        0
      );
      flushCameraPose(autoFitScopeKey);
      scheduleProjectionRefresh();
      if (projectionSettledTimerRef.current !== null) {
        window.clearTimeout(projectionSettledTimerRef.current);
      }
      projectionSettledTimerRef.current = window.setTimeout(() => {
        scheduleProjectionRefresh();
        projectionSettledTimerRef.current = null;
      }, 80);
      consumedFitSignatureRef.current = fitSignature;
      if (shouldAutoFit) {
        if (autoFitScopeKey) {
          consumedAutoFitScopeKeysRef.current.add(autoFitScopeKey);
          onAutoFitConsumed?.(autoFitScopeKey);
        }
        setAutoFitCount((count) => count + 1);
      } else {
        setExplicitFitCount((count) => count + 1);
      }
      fitTimerRef.current = null;
    }, 0);
    return () => {
      if (fitTimerRef.current !== null) window.clearTimeout(fitTimerRef.current);
      fitTimerRef.current = null;
      if (projectionSettledTimerRef.current !== null) {
        window.clearTimeout(projectionSettledTimerRef.current);
        projectionSettledTimerRef.current = null;
      }
    };
  }, [autoFitConsumed, autoFitReady, autoFitScopeKey, compactRootView, fitViewRequest, flushCameraPose, graphData.nodes, height, hoveredNode?.id, labelMode, layoutSettledRevision, layoutSignature, nodes, onAutoFitConsumed, relayoutVersion, scheduleProjectionRefresh, selectedNode?.id, viewportRevision, width]);

  useEffect(() => {
    const cameraTransition = cameraTransitionRef.current;
    const expandedIds = [...new Set(expandedNodeIds)];
    const newlyExpandedTarget = resolveFocusedExpansionRevealTarget(
      previousExpandedNodeIdsRef.current,
      expandedIds
    );
    previousExpandedNodeIdsRef.current = expandedIds;
    if (newlyExpandedTarget) {
      focusedRevealTargetNodeIdRef.current = newlyExpandedTarget;
      revealedExpansionSignatureRef.current = '';
    }
    if (expandedIds.length === 0) {
      focusedRevealTargetNodeIdRef.current = null;
      revealedExpansionSignatureRef.current = '';
      return;
    }
    const targetNodeId = focusedRevealTargetNodeIdRef.current;
    if (!targetNodeId || !expandedIds.includes(targetNodeId)) {
      focusedRevealTargetNodeIdRef.current = null;
      return;
    }
    const targetDirectLinks = expandedDirectLinks.filter((link) => (
      link.sourceId === targetNodeId || link.targetId === targetNodeId
    ));
    if (targetDirectLinks.length === 0) return;
    const expansionSignature = createFocusedExpansionRevealSignature(
      [targetNodeId],
      targetDirectLinks
    );
    if (revealedExpansionSignatureRef.current === expansionSignature) return;

    const animationFrame = window.requestAnimationFrame(() => {
      const viewportWidth = Number(width);
      const viewportHeight = Number(height);
      const camera = fgRef.current?.camera?.() as THREE.Camera | undefined;
      const controls = fgRef.current?.controls?.() as { target?: THREE.Vector3 } | undefined;
      if (
        !Number.isFinite(viewportWidth)
        || !Number.isFinite(viewportHeight)
        || !camera
        || !controls?.target
        || !fgRef.current?.graph2ScreenCoords
        || !fgRef.current?.cameraPosition
      ) {
        return;
      }

      const focusedNodeIds = new Set([targetNodeId]);
      targetDirectLinks.forEach((link) => {
        focusedNodeIds.add(link.sourceId === targetNodeId ? link.targetId : link.sourceId);
      });
      const refNodes = fgRef.current.graphData?.()?.nodes as RuntimeKnowledgeGraphNode[] | undefined;
      const graphNodes = selectFocusedExpansionGraphNodes({
        refNodes,
        currentNodes: graphData.nodes,
        requiredNodeIds: [...focusedNodeIds],
      });
      const graphNodeById = new Map(graphNodes.map((node) => [node.id, node]));
      if ([...focusedNodeIds].some((nodeId) => !graphNodeById.has(nodeId))) return;
      const focusedScreenPoints = [...focusedNodeIds].flatMap((nodeId) => {
        const node = graphNodeById.get(nodeId);
        if (!node) return [];
        const graphX = Number(node.x);
        const graphY = Number(node.y);
        const graphZ = Number(node.z ?? 0);
        if (!Number.isFinite(graphX) || !Number.isFinite(graphY) || !Number.isFinite(graphZ)) return [];
        const screen = fgRef.current.graph2ScreenCoords(graphX, graphY, graphZ);
        const screenX = Number(screen?.x);
        const screenY = Number(screen?.y);
        return Number.isFinite(screenX) && Number.isFinite(screenY)
          ? [{ x: screenX, y: screenY }]
          : [];
      });
      if (focusedScreenPoints.length !== focusedNodeIds.size) return;
      const reveal = calculateFocusedExpansionRevealTranslation({
        points: focusedScreenPoints,
        viewportWidth,
        viewportHeight,
        padding: 48,
      });
      const centerNode = graphNodeById.get(targetNodeId);
      if (!reveal || !centerNode) return;

      if (reveal.x === 0 && reveal.y === 0) {
        revealedExpansionSignatureRef.current = expansionSignature;
        return;
      }
      const centerWorld = new THREE.Vector3(
        Number(centerNode.x),
        Number(centerNode.y),
        Number(centerNode.z ?? 0)
      );
      if (![centerWorld.x, centerWorld.y, centerWorld.z].every(Number.isFinite)) return;
      const projectedCenter = centerWorld.clone().project(camera);
      const centerScreen = fgRef.current.graph2ScreenCoords(
        centerWorld.x,
        centerWorld.y,
        centerWorld.z
      );
      const desiredWorld = new THREE.Vector3(
        ((Number(centerScreen?.x) + reveal.x) / viewportWidth) * 2 - 1,
        -((Number(centerScreen?.y) + reveal.y) / viewportHeight) * 2 + 1,
        projectedCenter.z
      ).unproject(camera);
      if (![desiredWorld.x, desiredWorld.y, desiredWorld.z].every(Number.isFinite)) return;
      const cameraTranslation = centerWorld.clone().sub(desiredWorld);
      const translatedPose = translateKnowledgeGraphCameraPose({
        cameraPosition: camera.position,
        target: controls.target,
        translation: cameraTranslation,
      });
      const currentCameraPosition = {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      };
      const currentTarget = {
        x: controls.target.x,
        y: controls.target.y,
        z: controls.target.z,
      };
      cameraTransitionRef.current.start(
        prefersReducedKnowledgeGraphMotion() ? 0 : KNOWLEDGE_GRAPH_MOTION.cameraDurationMs,
        (progress) => {
          fgRef.current?.cameraPosition?.({
            x: currentCameraPosition.x + (translatedPose.cameraPosition.x - currentCameraPosition.x) * progress,
            y: currentCameraPosition.y + (translatedPose.cameraPosition.y - currentCameraPosition.y) * progress,
            z: currentCameraPosition.z + (translatedPose.cameraPosition.z - currentCameraPosition.z) * progress,
          }, {
            x: currentTarget.x + (translatedPose.target.x - currentTarget.x) * progress,
            y: currentTarget.y + (translatedPose.target.y - currentTarget.y) * progress,
            z: currentTarget.z + (translatedPose.target.z - currentTarget.z) * progress,
          }, 0);
        }
      );
      revealedExpansionSignatureRef.current = expansionSignature;
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      cameraTransition.cancel();
    };
  }, [expandedDirectLinks, expandedNodeIds, graphData.nodes, height, width]);

  useEffect(() => {
    const currentNodes = (fgRef.current?.graphData?.()?.nodes ?? graphData.nodes) as
      | Array<KnowledgeNodeData & { x?: number; y?: number; z?: number; fx?: number; fy?: number; fz?: number }>
      | undefined;
    syncKnowledgeGraphMutableNodePositions(currentNodes, layoutState);
  }, [graphData, layoutState]);

  const lastEngineReheatRevisionRef = useRef(engineReheatRevision);
  useEffect(() => {
    if (engineReheatRevision <= lastEngineReheatRevisionRef.current) return;
    lastEngineReheatRevisionRef.current = engineReheatRevision;
    if (forceLifecycle.staticLayout) return;
    fgRef.current?.d3ReheatSimulation?.();
  }, [engineReheatRevision, forceLifecycle.staticLayout]);

  // 6. 节点点击处理
  const handleNodeClick = useCallback((node: any) => {
    onNodeClick(node as KnowledgeNodeData);
  }, [onNodeClick]);

  // 7. 节点悬停处理
  const handleNodeHover = useCallback((node: any) => {
    onNodeHover(node as KnowledgeNodeData | null);
  }, [onNodeHover]);

  const handleNodeDragEnd = useCallback((node: any) => {
    scheduleProjectionRefresh();
    rememberRuntimeNodePosition(node as RuntimeKnowledgeGraphNode);
    const graphNodes = (fgRef.current?.graphData?.()?.nodes ?? graphData.nodes) as RuntimeKnowledgeGraphNode[];
    releaseKnowledgeGraphDragFrame(graphNodes, {
      draggedId: String(node?.id ?? ''),
      pinnedNodeIds: new Set(Object.keys(layoutStateRef.current.positionsByNodeId)),
    });
    onNodeDragEnd(node as KnowledgeNodeData);
    flushCameraPose(autoFitScopeKey);
  }, [autoFitScopeKey, flushCameraPose, graphData.nodes, onNodeDragEnd, rememberRuntimeNodePosition, scheduleProjectionRefresh]);

  const handleNodeDrag = useCallback((node: any) => {
    scheduleProjectionRefresh();
    cameraManipulatedRef.current = true;
    if (autoFitScopeKey) posePersistenceEnabledScopesRef.current.add(autoFitScopeKey);
    if (autoFitScopeKey) onCameraManipulation?.(autoFitScopeKey);
    const graphNodes = (fgRef.current?.graphData?.()?.nodes ?? graphData.nodes) as RuntimeKnowledgeGraphNode[];
    freezeKnowledgeGraphDragFrame(graphNodes, node as RuntimeKnowledgeGraphNode);
  }, [autoFitScopeKey, graphData.nodes, onCameraManipulation, scheduleProjectionRefresh]);

  const handleCanvasPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const canvas = event.currentTarget.querySelector<HTMLCanvasElement>('canvas');
    if (event.button === 2 && event.target === canvas) {
      event.preventDefault();
      event.stopPropagation();
      rightPanRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
      cameraManipulatedRef.current = true;
      if (autoFitScopeKey) posePersistenceEnabledScopesRef.current.add(autoFitScopeKey);
      if (autoFitScopeKey) onCameraManipulation?.(autoFitScopeKey);
      return;
    }
    completedBlankGestureRef.current = null;
    if (!activeCanvasPointerIdsRef.current.has(event.pointerId)) {
      if (activeCanvasPointerIdsRef.current.size > 0) {
        blankGesturesByPointerIdRef.current.clear();
      }
      activeCanvasPointerIdsRef.current.add(event.pointerId);
    }
    if (event.target !== canvas) return;
    const rect = canvas?.getBoundingClientRect();
    const graph2ScreenCoords = fgRef.current?.graph2ScreenCoords;
    if (!rect || !graph2ScreenCoords) return;
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const graphNodes = (fgRef.current?.graphData?.()?.nodes ?? graphData.nodes) as RuntimeKnowledgeGraphNode[];
    const graphNodeById = new Map(graphNodes.map((node) => [node.id, node]));
    const hitNode = graphNodes.some((node) => {
      if (![node.x, node.y, node.z ?? 0].every(Number.isFinite)) return false;
      const point = graph2ScreenCoords(node.x, node.y, node.z ?? 0);
      const nodeScale = getKnowledgeNodeScale({
        metadata: node.metadata,
        degree: node.graphDegree,
        focused: selectedNode?.id === node.id || hoveredNode?.id === node.id,
      });
      return Math.hypot(Number(point?.x) - localX, Number(point?.y) - localY) <= nodeScale.radius + 14;
    });
    const hitLink = !hitNode && graphData.links.some((link: any) => {
      const source = typeof link.source === 'object' ? link.source : graphNodeById.get(link.sourceId);
      const target = typeof link.target === 'object' ? link.target : graphNodeById.get(link.targetId);
      if (!source || !target || ![source.x, source.y, source.z ?? 0, target.x, target.y, target.z ?? 0].every(Number.isFinite)) {
        return false;
      }
      const getRadius = (node: RuntimeKnowledgeGraphNode) => getKnowledgeGraph3DRenderedNodeRadius(
        node,
        ((node as any).__knowledgeRootPacking?.collisionRadius ?? getKnowledgeNodeScale({
          metadata: node.metadata,
          degree: node.graphDegree,
          focused: selectedCorridorEmphasis?.nodeIds.includes(node.id)
            || selectedNode?.id === node.id
            || hoveredNode?.id === node.id,
          importanceScore: node.graphImportanceScore,
          sourceCoverageCount: node.sourceCoverageCount,
        }).radius) * getKnowledgeGraphPresentationNodeScale({ ...presentation, nodeId: node.id }),
        labelPlacementsRef.current.get(node.id)?.projectedScale ?? viewportScaleRef.current,
      );
      // 命中测试必须与渲染路径共享同一形状与半径输入，否则新形状节点上的
      // 可见边会被误判为画布空白。
      const path = createKnowledgeGraphRendererEdgePath({
        renderer: '3d',
        link,
        source,
        target,
        sourceNodeType: source.nodeType,
        targetNodeType: target.nodeType,
        sourceShape: getKnowledgeConceptNodeShape(source),
        targetShape: getKnowledgeConceptNodeShape(target),
        sourcePresentationRadius: getRadius(source),
        targetPresentationRadius: getRadius(target),
        laneCurvature: laneCurvatureByLinkKey.get(getKnowledgeGraphPresentationLinkKey(link)) ?? 0,
      });
      if (path.hiddenReason) return false;
      const points = sampleKnowledgeGraphEdgePath(path, 12).map((point) => {
        const projected = graph2ScreenCoords(point.x, point.y, point.z);
        return { x: Number(projected?.x), y: Number(projected?.y) };
      });
      if (!points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))) return false;
      return isKnowledgeCanvasPolylineHit({ x: localX, y: localY, points, tolerance: 9 });
    });
    if (!hitNode && !hitLink) {
      if (activeCanvasPointerIdsRef.current.size === 1) {
        blankGesturesByPointerIdRef.current.set(
          event.pointerId,
          startKnowledgeCanvasBlankGesture(event)
        );
      }
      cameraManipulatedRef.current = true;
      if (autoFitScopeKey) posePersistenceEnabledScopesRef.current.add(autoFitScopeKey);
      if (autoFitScopeKey) onCameraManipulation?.(autoFitScopeKey);
    }
  }, [autoFitScopeKey, graphData.links, graphData.nodes, hoveredNode?.id, laneCurvatureByLinkKey, onCameraManipulation, presentation, selectedCorridorEmphasis, selectedNode?.id]);

  const handleCanvasPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const rightPan = rightPanRef.current;
    if (rightPan?.pointerId === event.pointerId) {
      event.preventDefault();
      event.stopPropagation();
      const camera = fgRef.current?.camera?.() as THREE.PerspectiveCamera | undefined;
      const controls = fgRef.current?.controls?.() as { target?: THREE.Vector3; update?: () => void } | undefined;
      const canvas = fgRef.current?.renderer?.()?.domElement as HTMLCanvasElement | undefined;
      if (camera && controls?.target && canvas) {
        const distance = camera.position.distanceTo(controls.target);
        const worldPerPixel = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
          / Math.max(1, canvas.clientHeight);
        const translation = new THREE.Vector3(1, 0, 0)
          .applyQuaternion(camera.quaternion)
          .multiplyScalar(-(event.clientX - rightPan.x) * worldPerPixel)
          .add(new THREE.Vector3(0, 1, 0)
            .applyQuaternion(camera.quaternion)
            .multiplyScalar((event.clientY - rightPan.y) * worldPerPixel));
        camera.position.add(translation);
        controls.target.add(translation);
        controls.update?.();
        scheduleProjectionRefresh();
      }
      rightPanRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
      return;
    }
    const gesture = blankGesturesByPointerIdRef.current.get(event.pointerId) ?? null;
    const moved = moveKnowledgeCanvasBlankGesture(gesture, event);
    if (moved) blankGesturesByPointerIdRef.current.set(event.pointerId, moved);
  }, [scheduleProjectionRefresh]);

  const handleCanvasPointerCancel = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (rightPanRef.current?.pointerId === event.pointerId) rightPanRef.current = null;
    if (!activeCanvasPointerIdsRef.current.delete(event.pointerId)) return;
    blankGesturesByPointerIdRef.current.delete(event.pointerId);
  }, []);

  const handleCanvasPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (rightPanRef.current?.pointerId === event.pointerId) {
      rightPanRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      flushCameraPose(autoFitScopeKey);
      scheduleCameraPoseReport(autoFitScopeKey);
      return;
    }
    if (!activeCanvasPointerIdsRef.current.delete(event.pointerId)) return;
    const gesture = blankGesturesByPointerIdRef.current.get(event.pointerId) ?? null;
    blankGesturesByPointerIdRef.current.delete(event.pointerId);
    completedBlankGestureRef.current = finishKnowledgeCanvasBlankGesture(gesture, event);
    flushCameraPose(autoFitScopeKey);
    scheduleCameraPoseReport(autoFitScopeKey);
  }, [autoFitScopeKey, flushCameraPose, scheduleCameraPoseReport]);

  const handleBackgroundClick = useCallback(() => {
    const shouldDismiss = shouldDismissKnowledgeCanvasBlankGesture(completedBlankGestureRef.current);
    completedBlankGestureRef.current = null;
    if (shouldDismiss) onBackgroundClick?.();
  }, [onBackgroundClick]);

  useEffect(() => {
    if (!isKnowledgeGraphTask74PerformanceQa(window.location.search)) return;
    return installKnowledgeGraphTask74Snapshot(window, () => {
      const currentWidth = width ?? 800;
      const currentHeight = height ?? 600;
      const nodes = (fgRef.current?.graphData?.()?.nodes ?? graphData.nodes) as Array<KnowledgeNodeData & {
        x?: number;
        y?: number;
        z?: number;
        graphDegree?: number;
        graphImportanceScore?: number;
      }>;
      const bodyBounds = nodes.flatMap((node) => {
        const point = fgRef.current?.graph2ScreenCoords?.(
          Number(node.x ?? node.positionX),
          Number(node.y ?? node.positionY),
          Number(node.z ?? node.positionZ ?? 0),
        );
        const placement = labelPlacementsRef.current.get(node.id);
        if (!point || !placement || ![point.x, point.y, placement.projectedScale].every(Number.isFinite)) return [];
        const focused = selectedNode?.id === node.id
          || hoveredNode?.id === node.id
          || Boolean(selectedCorridorEmphasis?.nodeIds.includes(node.id));
        const rootPacking = (node as KnowledgeNodeData & {
          __knowledgeRootPacking?: { collisionRadius?: number };
        }).__knowledgeRootPacking;
        const naturalRadius = (rootPacking?.collisionRadius ?? getKnowledgeNodeScale({
          metadata: node.metadata,
          degree: node.graphDegree,
          focused,
          importanceScore: node.graphImportanceScore,
          sourceCoverageCount: node.sourceCoverageCount,
        }).radius) * getKnowledgeGraphPresentationNodeScale({ ...presentationRef.current, nodeId: node.id });
        const radius = getKnowledgeGraph3DRenderedNodeRadius(node, naturalRadius, placement.projectedScale)
          * placement.projectedScale;
        if (point.x + radius < 0 || point.x - radius > currentWidth || point.y + radius < 0 || point.y - radius > currentHeight) return [];
        return [{ id: node.id, x: point.x - radius, y: point.y - radius, width: radius * 2, height: radius * 2, radius }];
      });
      const labelBounds = nodes.flatMap((node) => {
        const point = fgRef.current?.graph2ScreenCoords?.(
          Number(node.x ?? node.positionX),
          Number(node.y ?? node.positionY),
          Number(node.z ?? node.positionZ ?? 0),
        );
        const placement = labelPlacementsRef.current.get(node.id);
        if (!point || !placement?.visible || ![point.x, point.y].every(Number.isFinite)) return [];
        const layout = layoutKnowledgeNodeLabel(node.name);
        const labelWidth = layout.width * placement.fontSize / KNOWLEDGE_NODE_LABEL_POLICY.fontSize;
        const labelHeight = layout.height * placement.fontSize / KNOWLEDGE_NODE_LABEL_POLICY.fontSize;
        const centerX = point.x + placement.offsetX;
        const centerY = point.y + placement.offsetY;
        return [{ id: node.id, x: centerX - labelWidth / 2, y: centerY - labelHeight / 2, width: labelWidth, height: labelHeight }];
      });
      const camera = fgRef.current?.camera?.() as THREE.PerspectiveCamera | undefined;
      const target = fgRef.current?.controls?.()?.target as THREE.Vector3 | undefined;
      const visibleLineIds = Array.from(
        document.querySelectorAll<SVGPolylineElement>('[data-knowledge-3d-screen-edge-id]'),
        (edge) => edge.getAttribute('data-knowledge-3d-screen-edge-id') ?? '',
      ).filter(Boolean).sort();
      const linkById = new Map(graphData.links.map((link: any) => [
        getKnowledgeGraphPresentationLinkKey(link), link,
      ]));
      const edgeTraces = Array.from(
        document.querySelectorAll<SVGPolylineElement>('[data-knowledge-3d-screen-edge-id]'),
      ).flatMap((edge) => {
        const id = edge.getAttribute('data-knowledge-3d-screen-edge-id') ?? '';
        const link: any = linkById.get(id);
        if (!link) return [];
        const points = Array.from(edge.points, (point) => ({ x: point.x, y: point.y }));
        if (points.length < 2) return [];
        return [{
          id,
          sourceId: typeof link.source === 'object' ? link.source.id : link.sourceId,
          targetId: typeof link.target === 'object' ? link.target.id : link.targetId,
          points,
        }];
      }).sort((left, right) => left.id.localeCompare(right.id));
      return {
        renderMode: '3D',
        visibleNodeIds: nodes.map((node) => node.id).sort(),
        bodyIds: bodyBounds.map((bound) => bound.id).sort(),
        labelIds: labelBounds.map((bound) => bound.id).sort(),
        visibleLineIds,
        edgeTraces,
        bodyBounds: bodyBounds.sort((left, right) => left.id.localeCompare(right.id)),
        labelBounds: labelBounds.sort((left, right) => left.id.localeCompare(right.id)),
        canonicalEdges: graphData.links.map((link: any) => {
          const family = getKnowledgeGraphPresentationFamily(link);
          return {
            id: getKnowledgeGraphPresentationLinkKey(link),
            family,
            direction: family === 'association' ? 'unordered' as const : 'source-to-target' as const,
            sourceId: typeof link.source === 'object' ? link.source.id : link.sourceId,
            targetId: typeof link.target === 'object' ? link.target.id : link.targetId,
          };
        }).sort((left, right) => left.id.localeCompare(right.id)),
        corridorIds: {
          nodeIds: [...(selectedCorridorEmphasis?.nodeIds ?? [])].sort(),
          edgeIds: [...(selectedCorridorEmphasis?.edgeIds ?? [])].sort(),
        },
        markerCount: !motionEnvironmentActive || reducedMotion ? 0 : activeMotionMarkerCount,
        viewportCoverage: {
          declared: nodes.length,
          body: bodyBounds.length,
          label: labelBounds.length,
          eligible: labelPlacementsRef.current.size,
          deferred: [...labelPlacementsRef.current.values()].filter((placement) => !placement.visible).length,
          visibleLine: visibleLineIds.length,
        },
        camera: {
          mode: 'perspective-3d',
          ...(camera ? { position: { x: camera.position.x, y: camera.position.y, z: camera.position.z } } : {}),
          ...(target ? { target: { x: target.x, y: target.y, z: target.z } } : {}),
        },
      };
    });
  }, [
    graphData,
    height,
    hoveredNode?.id,
    motionEnvironmentActive,
    activeMotionMarkerCount,
    reducedMotion,
    selectedCorridorEmphasis,
    selectedNode?.id,
    width,
  ]);

  const domLabelModels = graphData.nodes.flatMap((node: any) => {
    const placement = labelPlacements.get(node.id);
    const point = fgRef.current?.graph2ScreenCoords?.(node.x ?? 0, node.y ?? 0, node.z ?? 0);
    if (!placement?.visible || !Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return [];
    const isRootBubble = Boolean(node.__knowledgeRootPacking);
    const layout = isRootBubble ? layoutKnowledgeRootLabel(node.name) : layoutKnowledgeNodeLabel(node.name);
    const policyFontSize: number = isRootBubble && 'fontSize' in layout
      ? Number((layout as { fontSize: number }).fontSize)
      : KNOWLEDGE_NODE_LABEL_POLICY.fontSize;
    return [{
      id: node.id,
      lines: layout.lines.map((line) => line.text),
      richTitle: node.richTitle,
      x: Number(point.x) + (isRootBubble ? 0 : placement.offsetX),
      y: Number(point.y) + (isRootBubble ? 0 : placement.offsetY),
      width: layout.width * placement.fontSize / policyFontSize,
      height: layout.height * placement.fontSize / policyFontSize,
      fontSize: placement.fontSize,
      isRootBubble,
      completeName: layout.accessibleName,
      opacity: getKnowledgeGraphPresentationNodeOpacity({ ...presentation, nodeId: node.id })
        * getKnowledgeGraphNodeEmphasisOpacity(node.id, selectedCorridorEmphasis),
    }];
  });
  const screenEdgeModels = graphData.links.flatMap((link: any) => {
    void cameraProjectionRevision;
    const id = getKnowledgeGraphPresentationLinkKey(link);
    const source = typeof link.source === 'object' ? link.source : null;
    const target = typeof link.target === 'object' ? link.target : null;
    if (!source || !target || ![
      source.x, source.y, source.z ?? 0, target.x, target.y, target.z ?? 0,
    ].every(Number.isFinite)) return [];
    const getRadius = (node: any) => getKnowledgeGraph3DRenderedNodeRadius(
      node,
      (node.__knowledgeRootPacking?.collisionRadius ?? getKnowledgeNodeScale({
        metadata: node.metadata,
        degree: node.graphDegree,
        focused: selectedCorridorEmphasis?.nodeIds.includes(node.id)
          || selectedNode?.id === node.id
          || hoveredNode?.id === node.id,
        importanceScore: node.graphImportanceScore,
        sourceCoverageCount: node.sourceCoverageCount,
      }).radius) * getKnowledgeGraphPresentationNodeScale({ ...presentation, nodeId: node.id }),
      labelPlacementsRef.current.get(node.id)?.projectedScale ?? viewportScaleRef.current,
    );
    const path = createKnowledgeGraphRendererEdgePath({
      renderer: '3d',
      link,
      source,
      target,
      sourceNodeType: source.nodeType,
      targetNodeType: target.nodeType,
      sourceShape: getKnowledgeConceptNodeShape(source),
      targetShape: getKnowledgeConceptNodeShape(target),
      sourcePresentationRadius: getRadius(source),
      targetPresentationRadius: getRadius(target),
      laneCurvature: laneCurvatureByLinkKey.get(id) ?? 0,
    });
    if (path.hiddenReason) return [];
    const points = sampleKnowledgeGraphEdgePath(path, 24).flatMap((point) => {
      const projected = fgRef.current?.graph2ScreenCoords?.(point.x, point.y, point.z);
      return projected && Number.isFinite(projected.x) && Number.isFinite(projected.y)
        ? [{ x: Number(projected.x), y: Number(projected.y) }]
        : [];
    });
    if (points.length < 2) return [];
    const { style, directed } = getKnowledgeGraphEdgePresentation(link);
    const appearance = getLinkAppearance(link);
    return [{ id, points, appearance, dash: style.dash, directed }];
  });

  return (
    <div
      ref={rootRef}
      className="relative h-full w-full"
      data-knowledge-graph-renderer="3D"
      data-knowledge-render-layer-order="edge,node,label"
      data-knowledge-selected-emphasis-contract="shared-corridor-input"
      data-knowledge-edge-lanes={JSON.stringify(graphData.links.map((link: any) => ({
        id: getKnowledgeGraphPresentationLinkKey(link),
        curvature: laneCurvatureByLinkKey.get(getKnowledgeGraphPresentationLinkKey(link)) ?? 0,
        targetArrow: getKnowledgeGraphEdgePresentation(link).directed,
      })))}
      data-knowledge-label-max-lines={KNOWLEDGE_NODE_LABEL_POLICY.maxLines}
      data-knowledge-graph-presentation-phase={presentation.phase}
      data-knowledge-graph-presentation-elapsed-ms={String(presentation.elapsedMs ?? 0)}
      data-knowledge-auto-fit-count={String(autoFitCount)}
      data-knowledge-explicit-fit-count={String(explicitFitCount)}
      data-knowledge-camera-manipulated={cameraManipulatedRef.current ? 'true' : 'false'}
      data-knowledge-restored-camera-pose={restoredCameraPose ? JSON.stringify(restoredCameraPose) : ''}
      data-knowledge-graph-animated-node-count={String(presentation.animatedNodeIds?.length ?? 0)}
      data-knowledge-graph-animated-relation-count={String(presentation.animatedRelationIds?.length ?? 0)}
      data-knowledge-motion-marker-count={!motionEnvironmentActive || reducedMotion ? '0' : String(activeMotionMarkerCount)}
      onPointerDownCapture={handleCanvasPointerDown}
      onPointerMoveCapture={handleCanvasPointerMove}
      onPointerUpCapture={handleCanvasPointerUp}
      onPointerCancelCapture={handleCanvasPointerCancel}
      onWheelCapture={() => {
        cameraManipulatedRef.current = true;
        if (autoFitScopeKey) posePersistenceEnabledScopesRef.current.add(autoFitScopeKey);
        if (autoFitScopeKey) onCameraManipulation?.(autoFitScopeKey);
        scheduleCameraPoseReport(autoFitScopeKey);
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <svg
        className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible"
        data-knowledge-3d-screen-edge-layer="true"
        aria-hidden="true"
      >
        <defs>
          <marker id="knowledge-3d-direction" markerWidth="14" markerHeight="14" refX="11" refY="7" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M 0 0 L 14 7 L 0 14 z" fill={KNOWLEDGE_GRAPH_3D_DIRECTION_COLOR} />
          </marker>
        </defs>
        {screenEdgeModels.map((edge) => (
          <polyline
            key={edge.id}
            data-knowledge-3d-screen-edge-id={edge.id}
            points={edge.points.map((point) => `${point.x},${point.y}`).join(' ')}
            fill="none"
            stroke={edge.appearance.color}
            strokeWidth={edge.appearance.width}
            strokeOpacity={edge.appearance.opacity}
            strokeDasharray={edge.dash.length > 0 ? edge.dash.join(' ') : undefined}
            strokeLinecap="round"
            strokeLinejoin="round"
            markerEnd={edge.directed ? 'url(#knowledge-3d-direction)' : undefined}
          />
        ))}
      </svg>

      <div className="absolute inset-0 z-10">
      <ForceGraph3D
        ref={fgRef}
        width={width}
        height={height}
        graphData={graphData}

        // 节点渲染
        nodeThreeObject={createNodeObject}
        nodeThreeObjectExtend={false}
        nodeLabel={getAccessibleNodeLabel}

        // 连线渲染
        linkThreeObject={createPresentationLinkObject}
        linkThreeObjectExtend={false}
        linkPositionUpdate={updatePresentationLinkObject}

        // 交互
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        onNodeDrag={handleNodeDrag}
        onNodeDragEnd={handleNodeDragEnd}
        onBackgroundClick={handleBackgroundClick}
        onEngineStop={handleEngineStop}
        onEngineTick={scheduleProjectionRefresh}
        enableNodeDrag={true}

        // 物理引擎：有界力生命周期（#1739）
        d3VelocityDecay={0.3}
        d3AlphaDecay={KNOWLEDGE_FORCE_ALPHA_DECAY}
        d3AlphaMin={KNOWLEDGE_FORCE_ALPHA_MIN}
        warmupTicks={forceLifecycle.warmupTicks}
        cooldownTicks={forceLifecycle.cooldownTicks}
        cooldownTime={forceLifecycle.cooldownTimeMs}

        // 背景透明（使用CSS渐变背景）
        backgroundColor="rgba(0,0,0,0)"

      />
      </div>

      <div
        className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
        data-knowledge-3d-dom-label-layer="true"
        data-knowledge-visible-label-count={String(domLabelModels.length)}
      >
        {domLabelModels.map((label) => (
          <div
            key={label.id}
            data-knowledge-3d-node-label={label.id}
            data-knowledge-screen-font-size={String(label.fontSize)}
            data-knowledge-root-label={label.isRootBubble ? 'inside-complete' : undefined}
            data-knowledge-complete-name={label.isRootBubble ? label.completeName : undefined}
            className={label.isRootBubble
              ? 'absolute flex flex-col items-center justify-center text-center font-bold leading-tight text-platform-fg-inverse [text-shadow:0_0_2px_hsl(var(--platform-canvas)),0_0_5px_hsl(var(--platform-canvas))]'
              : 'absolute flex flex-col items-center justify-center text-center font-semibold leading-tight text-platform-fg-primary [text-shadow:0_0_2px_hsl(var(--platform-canvas)),0_0_4px_hsl(var(--platform-canvas))]'}
            style={{
              left: label.x,
              top: label.y,
              width: label.width,
              minHeight: label.height,
              fontSize: label.fontSize,
              opacity: label.opacity,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {label.richTitle ? (
              <GovernedRichText projection={label.richTitle} density="canvas" theme={isLightTheme ? 'light' : 'dark'} />
            ) : label.lines.map((line, index) => <span key={`${label.id}:${index}`}>{line}</span>)}
          </div>
        ))}
      </div>

      {/* 操作提示 */}
      <div className="pointer-events-none absolute bottom-4 left-4 text-xs text-slate-500">
        <div>鼠标左键拖拽旋转 | 滚轮缩放 | 右键平移</div>
        <div>点击节点查看详情 | 拖拽节点调整位置</div>
      </div>
    </div>
  );
}
