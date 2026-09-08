import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { fitActiveAuthorityPerspectiveCamera } from '../graph/active-renderer/active-authority-camera-3d';
import { canRestoreActiveCameraPose } from '../graph/active-renderer/active-authority-visual';
import type { ActiveAuthorityLayoutNode } from '../graph/active-renderer/active-authority-geometry';

const nodes = [-1, 1].map((sign) => ({ id: String(sign), name: '节点', nodeType: 'THEORY',
  x: sign * 600, y: sign * 100, z: sign * 50, layoutRadius: 12,
})) as ActiveAuthorityLayoutNode[];

describe('active graph camera geometry', () => {
  it.each([[1200, 500], [272, 328]])('fits node bodies at viewport %s by %s', (width, height) => {
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 10000);
    camera.position.set(300, 200, 1000);
    camera.up.set(0.2, 1, 0).normalize();
    camera.lookAt(0, 0, 0);
    const fit = fitActiveAuthorityPerspectiveCamera(camera, nodes, width, height)!;
    camera.position.copy(fit.position); camera.lookAt(fit.target); camera.updateMatrixWorld();
    for (const node of nodes) {
      const screen = new THREE.Vector3(node.x, node.y, node.z).project(camera);
      expect(Math.abs(screen.x)).toBeLessThan(1);
      expect(Math.abs(screen.y)).toBeLessThan(1);
      expect(screen.z).toBeLessThan(1);
    }
  });

  it('uses the width of a landscape viewport instead of treating width as height', () => {
    const camera = new THREE.PerspectiveCamera(50, 1200 / 500, 0.1, 10000);
    camera.position.z = 1000;
    const fit = fitActiveAuthorityPerspectiveCamera(camera, nodes, 1200, 500)!;
    camera.position.copy(fit.position); camera.lookAt(fit.target); camera.updateMatrixWorld();
    const horizontalExtent = Math.max(...nodes.map((node) => Math.abs(new THREE.Vector3(node.x, node.y, node.z).project(camera).x)));
    expect(horizontalExtent).toBeGreaterThan(0.7);
    expect(horizontalExtent).toBeLessThan(1);
  });

  it('restores a view only when its saved viewport still matches', () => {
    const pose = { position: { x: 20, y: 30, z: 2 }, target: { x: 20, y: 30, z: 0 },
      up: { x: 0, y: 1, z: 0 }, viewport: { width: 1160, height: 485 } };
    expect(canRestoreActiveCameraPose(pose, 1160, 485)).toBe(true);
    expect(canRestoreActiveCameraPose(pose, 342, 432)).toBe(false);
    expect(canRestoreActiveCameraPose({ ...pose, viewport: undefined }, 342, 432)).toBe(true);
  });
});
