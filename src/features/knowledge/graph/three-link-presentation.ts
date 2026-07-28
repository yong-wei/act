import * as THREE from 'three';

import { KNOWLEDGE_GRAPH_CORRIDOR_MARKER_GEOMETRY } from './motion';

export const KNOWLEDGE_GRAPH_3D_DIRECTION_COLOR = '#f97316';
export const KNOWLEDGE_GRAPH_3D_MARKER_COLOR = '#fde047';

export function createKnowledgeGraphPresentationLinkGroup({
  directed,
  dash,
}: {
  directed: boolean;
  dash: readonly number[];
}) {
  const group = new THREE.Group();
  group.renderOrder = 0;
  const lineMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: false,
    opacity: 1,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  const line = new THREE.Mesh(new THREE.BufferGeometry(), lineMaterial);
  line.visible = false;
  line.frustumCulled = false;
  line.userData.dashedRelation = dash.length > 0;

  const arrowGeometry = new THREE.BufferGeometry();
  arrowGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3));
  arrowGeometry.setIndex([0, 1, 2]);
  const arrow = new THREE.Mesh(arrowGeometry, new THREE.MeshBasicMaterial({
    color: KNOWLEDGE_GRAPH_3D_DIRECTION_COLOR,
    transparent: false,
    opacity: 1,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
  }));
  arrow.visible = false;
  arrow.frustumCulled = false;
  arrow.renderOrder = 4;

  const marker = new THREE.Mesh(
    new THREE.ConeGeometry(
      KNOWLEDGE_GRAPH_CORRIDOR_MARKER_GEOMETRY.halfWidth,
      KNOWLEDGE_GRAPH_CORRIDOR_MARKER_GEOMETRY.frontExtent
        + KNOWLEDGE_GRAPH_CORRIDOR_MARKER_GEOMETRY.backExtent,
      5,
    ),
    new THREE.MeshBasicMaterial({
      color: KNOWLEDGE_GRAPH_3D_MARKER_COLOR,
      transparent: false,
      opacity: 1,
      depthWrite: false,
      depthTest: false,
    }),
  );
  marker.visible = false;
  marker.frustumCulled = false;
  marker.renderOrder = 5;
  group.add(line, arrow, marker);
  group.userData.presentationLine = line;
  group.userData.presentationArrow = arrow;
  group.userData.presentationMotionMarker = marker;
  group.userData.knowledgeOwnedChildren = [line, arrow, marker];
  return group;
}

export function updateKnowledgeGraph3DLine(
  line: THREE.Mesh,
  state: {
    points: readonly THREE.Vector3[];
    color: THREE.ColorRepresentation;
    opacity: number;
    visible: boolean;
    emphasized: boolean;
    width: number;
    pixelsPerWorldUnit: number;
    viewport: { width: number; height: number };
  },
) {
  const pixelsPerWorldUnit = Math.max(0.0001, state.pixelsPerWorldUnit);
  const minimumScreenDiameter = 8;
  const screenDiameter = Math.max(minimumScreenDiameter, state.width * 2.4);
  const tubeRadius = screenDiameter / (2 * pixelsPerWorldUnit);
  const previousGeometry = line.geometry;
  line.geometry = state.points.length >= 2
    ? new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([...state.points]),
        Math.max(2, state.points.length - 1),
        tubeRadius,
        5,
        false,
      )
    : new THREE.BufferGeometry();
  previousGeometry.dispose();
  const material = line.material as THREE.MeshBasicMaterial;
  material.color.set(state.color);
  material.opacity = 1;
  material.transparent = false;
  material.depthWrite = false;
  material.depthTest = false;
  // The mesh retains canonical 3D geometry for hit testing and projected SVG
  // paths. Static relations are rendered once by the screen-space edge layer.
  material.visible = false;
  line.visible = false;
  line.renderOrder = state.emphasized ? 3 : 1;
}

export function updateKnowledgeGraph3DMotionMarker(
  marker: THREE.Mesh,
  state: {
    visible: boolean;
    point?: { x: number; y: number; z: number };
    tangent?: { x: number; y: number; z: number };
    color?: THREE.ColorRepresentation;
    opacity?: number;
    pixelsPerWorldUnit?: number;
    sizeScale?: number;
  },
) {
  marker.visible = state.visible;
  if (!state.visible || !state.point || !state.tangent) return;
  marker.position.set(state.point.x, state.point.y, state.point.z);
  marker.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(state.tangent.x, state.tangent.y, state.tangent.z).normalize(),
  );
  const material = marker.material as THREE.MeshBasicMaterial;
  if (state.color !== undefined) material.color.set(state.color);
  if (state.opacity !== undefined) material.opacity = state.opacity;
  const pixelsPerWorldUnit = Math.max(0.0001, state.pixelsPerWorldUnit ?? 1);
  const naturalScreenWidth = KNOWLEDGE_GRAPH_CORRIDOR_MARKER_GEOMETRY.halfWidth
    * 2 * pixelsPerWorldUnit;
  marker.scale.setScalar(Math.max(1, 14 / naturalScreenWidth) * (state.sizeScale ?? 1));
}

export function disposeKnowledgeGraphPresentationLinkGroup(group: THREE.Group) {
  if (group.userData.knowledgeDisposed) return;
  group.userData.knowledgeDisposed = true;
  const children = group.userData.knowledgeOwnedChildren as THREE.Object3D[] | undefined;
  (children ?? group.children).forEach((child) => {
    const renderable = child as THREE.Mesh;
    renderable.geometry?.dispose();
    const materials = Array.isArray(renderable.material) ? renderable.material : [renderable.material];
    materials.filter(Boolean).forEach((material) => material.dispose());
  });
  group.clear();
  group.userData.knowledgeOwnedChildren = [];
}
