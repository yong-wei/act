import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FLEET_ACTIVE_PACKAGES, XUE_LONG_2_V110 } from '../model-packages/fleet-packages';
import { createMarinePropulsors } from '../model-packages/marine-propulsors';
import type { BindingTelemetrySource } from '../components/semantic-bindings-rig';

describe('received independent proxies and propulsion interfaces', () => {
  for (const descriptor of Object.values(FLEET_ACTIVE_PACKAGES)) {
    it(`${descriptor.packageId}: independently loads the proxy and matches its published anchor interface`, async () => {
      const proxy = descriptor.roles['ship-proxy']!, anchors = descriptor.roles['propulsion-anchors']!;
      const bytes = readFileSync(process.cwd() + '/public' + proxy.url);
      expect(bytes.byteLength).toBeLessThanOrEqual(102400);
      const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
      expect(gltf.animations).toHaveLength(0);
      expect(gltf.parser.json.images ?? []).toHaveLength(0);
      expect(gltf.parser.json.extensionsRequired ?? []).toHaveLength(0);
      let triangles = 0, meshes = 0;
      gltf.scene.traverse(object => {
        if (object instanceof THREE.Mesh) { triangles += object.geometry.index!.count / 3; meshes += 1; }
      });
      expect(triangles).toBeGreaterThanOrEqual(500); expect(triangles).toBeLessThanOrEqual(2000);
      expect(meshes).toBe(1);
      const contract = JSON.parse(readFileSync(process.cwd() + '/public' + anchors.url, 'utf8'));
      expect(contract.version).toBe(descriptor.modelVersion);
      expect(contract.coordinates.modelToSceneMatrix).toEqual(descriptor.modelToSceneMatrix);
      for (const anchor of descriptor.propulsionAnchors!) {
        expect(contract.propulsors.find((p: { id: string }) => p.id === anchor.id)).toMatchObject(anchor);
        const node = gltf.scene.getObjectByName(anchor.proxyNode)!;
        expect(node).toBeDefined();
        const position = node.getWorldPosition(new THREE.Vector3()).toArray();
        position.forEach((value, i) => expect(value).toBeCloseTo(anchor.positionModelM[i], 3));
      }
      expect(createMarinePropulsors(gltf.scene, [], descriptor, () => ({
        speedMps: 0, rudderDeg: 0, attainedCount: 0,
      })).sample({ x: 0, z: 0, headingRad: 0, speedMps: 0 })).toHaveLength(descriptor.propulsionAnchors!.length);
    });
  }
  it('keeps declared pod position, shaft direction and RPM activity identical across proxy and full-node mounts', () => {
    const descriptor = XUE_LONG_2_V110;
    const proxy = new THREE.Group(), full = new THREE.Group(), pivots: THREE.Group[] = [];
    for (const anchor of descriptor.propulsionAnchors!) {
      const pivot = new THREE.Group(); pivot.position.set(...anchor.azimuthPivotModelM!);
      const node = new THREE.Group(); node.name = anchor.lodNode;
      node.position.set(...anchor.positionModelM).sub(pivot.position); pivot.add(node); full.add(pivot); pivots.push(pivot);
    }
    for (const model of [proxy, full]) {
      model.scale.setScalar(1.2); model.rotation.y = -Math.PI / 2; model.position.set(40, -1, 50);
    }
    const sim: BindingTelemetrySource = { rudderDeg: 0, speedMps: 0, attainedCount: 0,
      azipod: { P: { azimuthRad: 0.6, rpm: -45 }, S: { azimuthRad: -0.3, rpm: 90 } } };
    const a = createMarinePropulsors(proxy, [], descriptor, () => sim), b = createMarinePropulsors(full, [], descriptor, () => sim);
    pivots[0].rotation.y = 0.6; pivots[1].rotation.y = -0.3;
    const pose = { x: 100, z: -20, headingRad: 0.4, speedMps: 0 };
    const proxySources = a.sample(pose), fullSources = b.sample(pose);
    expect(proxySources).toHaveLength(2);
    proxySources.forEach((source, i) => {
      expect(source.id).toBe(fullSources[i].id);
      for (const key of ['x', 'z', 'headingRad', 'diameterMeters', 'depthMeters', 'activity'] as const) {
        expect(source[key]).toBeCloseTo(fullSources[i][key]!, 5);
      }
    });
    expect(proxySources[0].activity).toBe(0.25); expect(proxySources[1].activity).toBe(1);
  });
});
