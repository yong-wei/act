export interface KnowledgeGraphTask74Bounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
}

export interface KnowledgeGraphTask74Edge {
  id: string;
  family: 'child' | 'post-requisite' | 'association';
  direction: 'source-to-target' | 'unordered';
}

export interface KnowledgeGraphTask74Snapshot {
  renderMode: '2D' | '3D';
  visibleNodeIds: string[];
  bodyIds: string[];
  labelIds: string[];
  visibleLineIds: string[];
  bodyBounds: KnowledgeGraphTask74Bounds[];
  labelBounds: KnowledgeGraphTask74Bounds[];
  canonicalEdges: KnowledgeGraphTask74Edge[];
  corridorIds: { nodeIds: string[]; edgeIds: string[] };
  markerCount: number;
  viewportCoverage: {
    declared: number;
    body: number;
    label: number;
    eligible: number;
    deferred: number;
    visibleLine: number;
  };
  camera: {
    mode: 'orthographic-2d' | 'perspective-3d';
    zoom?: number;
    position?: { x: number; y: number; z: number };
    target?: { x: number; y: number; z: number };
  };
}

type Task74Window = Window & { __knowledgeGraphTask74Snapshot?: KnowledgeGraphTask74Snapshot };

export function isKnowledgeGraphTask74PerformanceQa(search: string): boolean {
  return new URLSearchParams(search).get('qa') === 'task-7-4-performance';
}

export function installKnowledgeGraphTask74Snapshot(
  target: Task74Window,
  readSnapshot: () => KnowledgeGraphTask74Snapshot,
): () => void {
  const getter = () => readSnapshot();
  Object.defineProperty(target, '__knowledgeGraphTask74Snapshot', {
    configurable: true,
    enumerable: false,
    get: getter,
  });
  return () => {
    const descriptor = Object.getOwnPropertyDescriptor(target, '__knowledgeGraphTask74Snapshot');
    if (descriptor?.get === getter) delete target.__knowledgeGraphTask74Snapshot;
  };
}
