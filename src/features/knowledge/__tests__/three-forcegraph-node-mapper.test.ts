// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import ThreeForceGraph from 'three-forcegraph';
import * as THREE from 'three';

describe('three-forcegraph node mapper ownership', () => {
  it('owns removal when a same-id node object replacement produces a fresh Group', async () => {
    const factory = vi.fn(() => {
      const group = new THREE.Group();
      const texture = new THREE.Texture();
      const material = new THREE.MeshBasicMaterial({ map: texture });
      group.add(new THREE.Mesh(new THREE.SphereGeometry(1), material));
      return group;
    });
    const resourceSpies = (group: THREE.Group) => {
      const mesh = group.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
      return {
        geometry: vi.spyOn(mesh.geometry, 'dispose'),
        material: vi.spyOn(mesh.material, 'dispose'),
        texture: vi.spyOn(mesh.material.map!, 'dispose'),
      };
    };
    const expectDisposedOnce = (spies: ReturnType<typeof resourceSpies>) => {
      expect(spies.geometry).toHaveBeenCalledTimes(1);
      expect(spies.material).toHaveBeenCalledTimes(1);
      expect(spies.texture).toHaveBeenCalledTimes(1);
    };
    const graph = new ThreeForceGraph()
      .nodeId('id')
      .nodeThreeObject(factory)
      .nodeThreeObjectExtend(false);
    const settleGraph = async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      graph.tickFrame();
    };

    graph.graphData({ nodes: [{ id: 'same' }], links: [] });
    await settleGraph();
    expect(factory).toHaveBeenCalledTimes(1);
    const first = factory.mock.results[0].value;
    const firstResources = resourceSpies(first);
    expect(first.parent).not.toBeNull();

    graph.graphData({ nodes: [{ id: 'same' }], links: [] });
    await settleGraph();
    expect(factory).toHaveBeenCalledTimes(2);
    const second = factory.mock.results[1].value;
    expect(second).not.toBe(first);
    expect(first.parent).toBeNull();
    expect(first.children).toHaveLength(0);
    expectDisposedOnce(firstResources);
    const secondResources = resourceSpies(second);

    graph.graphData({ nodes: [], links: [] });
    await settleGraph();
    expect(second.parent).toBeNull();
    expectDisposedOnce(firstResources);
    expectDisposedOnce(secondResources);

    graph.graphData({ nodes: [{ id: 'unmount' }], links: [] });
    await settleGraph();
    const third = factory.mock.results[2].value;
    const thirdResources = resourceSpies(third);
    (graph as unknown as { resetProps: () => unknown }).resetProps();
    await settleGraph();
    expect(third.parent).toBeNull();
    expectDisposedOnce(thirdResources);
  });
});
