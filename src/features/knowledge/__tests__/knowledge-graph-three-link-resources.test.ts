import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

import { KNOWLEDGE_GRAPH_CORRIDOR_MARKER_GEOMETRY } from '../graph/motion';
import {
  createKnowledgeGraphPresentationLinkGroup,
  disposeKnowledgeGraphPresentationLinkGroup,
  updateKnowledgeGraph3DLine,
  updateKnowledgeGraph3DMotionMarker,
} from '../graph/three-link-presentation';

describe('knowledge graph 3D presentation link resources', () => {
  it('puts a non-empty line geometry and material into an explicitly visible render state', () => {
    const group = createKnowledgeGraphPresentationLinkGroup({ directed: false, dash: [] });
    const line = group.userData.presentationLine as THREE.Mesh;
    const material = line.material as THREE.MeshBasicMaterial;
    const initialGeometry = line.geometry;
    updateKnowledgeGraph3DLine(line, {
      points: [new THREE.Vector3(1, 2, 3), new THREE.Vector3(4, 5, 6)],
      color: '#2f7cff',
      opacity: 0.92,
      visible: true,
      emphasized: true,
      width: 3.2,
      pixelsPerWorldUnit: 0.25,
      viewport: { width: 1440, height: 900 },
    });

    expect(line).toBeInstanceOf(THREE.Mesh);
    expect(line.geometry).toBeInstanceOf(THREE.TubeGeometry);
    expect(line.geometry).not.toBe(initialGeometry);
    expect(line.visible).toBe(false);
    expect(material.visible).toBe(false);
    expect(material.opacity).toBe(1);
    expect(material.color.getHexString()).toBe('2f7cff');
    expect(material.depthTest).toBe(false);
    expect(material.side).toBe(THREE.DoubleSide);
    expect(line.frustumCulled).toBe(false);
    expect(line.geometry.getAttribute('position').count).toBeGreaterThan(0);
    expect((line.geometry as THREE.TubeGeometry).parameters.radius * 2 * 0.25)
      .toBeGreaterThanOrEqual(8);
    expect(material.transparent).toBe(false);
    expect(line.renderOrder).toBeGreaterThan(0);
  });

  it('adds and removes the actual Group resources exactly once without changing the static arrow', () => {
    const group = createKnowledgeGraphPresentationLinkGroup({ directed: true, dash: [] });
    const line = group.userData.presentationLine as THREE.Line;
    const arrow = group.userData.presentationArrow as THREE.Mesh;
    const marker = group.userData.presentationMotionMarker as THREE.Mesh;
    expect(group.children).toEqual([line, arrow, marker]);
    expect(arrow.frustumCulled).toBe(false);
    expect(marker.frustumCulled).toBe(false);

    const resources: Array<{ dispose: () => void }> = [
      line.geometry, line.material as THREE.Material,
      arrow.geometry, arrow.material as THREE.Material,
      marker.geometry, marker.material as THREE.Material,
    ];
    const disposals = resources.map((resource) => vi.spyOn(resource, 'dispose'));
    const arrowPositions = (arrow.geometry.getAttribute('position') as THREE.BufferAttribute).array.slice();
    const arrowMatrix = arrow.matrix.toArray();

    updateKnowledgeGraph3DMotionMarker(marker, {
      visible: true,
      point: { x: 12, y: 3, z: 2 },
      tangent: { x: 1, y: 0, z: 0 },
      color: '#cc3344',
      opacity: 0.9,
      pixelsPerWorldUnit: 0.25,
    });
    expect(marker.visible).toBe(true);
    expect(KNOWLEDGE_GRAPH_CORRIDOR_MARKER_GEOMETRY.halfWidth * 2 * marker.scale.x * 0.25)
      .toBeGreaterThanOrEqual(14);
    expect((marker.material as THREE.MeshBasicMaterial).transparent).toBe(false);
    expect(Array.from((arrow.geometry.getAttribute('position') as THREE.BufferAttribute).array)).toEqual(Array.from(arrowPositions));
    expect(arrow.matrix.toArray()).toEqual(arrowMatrix);
    expect(arrow.visible).toBe(false);

    group.remove(line, arrow, marker);
    disposeKnowledgeGraphPresentationLinkGroup(group);
    disposeKnowledgeGraphPresentationLinkGroup(group);
    disposals.forEach((dispose) => expect(dispose).toHaveBeenCalledTimes(1));
  });

  it('rebinds the 3D graph when selection changes the visible link set', () => {
    const source = readFileSync(join(
      process.cwd(),
      'src/features/knowledge/graph/knowledge-graph-canvas.tsx',
    ), 'utf8');
    expect(source).toContain('fgRef.current?.graphData?.(graphData);');
    expect(source).toContain('updatePresentationLinkObjectRef.current(linkObject');
    expect(source).toContain('disposeKnowledgeGraphPresentationLinkGroup(object);');
  });

  it('keeps the ordinary-node natural radius unprojected during focus updates', () => {
    const source = readFileSync(join(
      process.cwd(),
      'src/features/knowledge/graph/knowledge-graph-canvas.tsx',
    ), 'utf8');
    expect(source).toContain('const naturalRadius = (entry.node.__knowledgeRootPacking?.collisionRadius ?? nodeScale.radius)');
    expect(source).toContain('entry.object.userData.knowledgeNaturalRadius = naturalRadius;');
    expect(source).not.toContain('entry.object.userData.knowledgeNaturalRadius = renderedRadius;');
  });
});
