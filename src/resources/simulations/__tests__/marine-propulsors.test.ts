import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createMarinePropulsors } from '../model-packages/marine-propulsors';
import { TYPE055_NANCHANG_101_V2 } from '../model-packages/type055-nanchang-101-v2';
import type { BindingTelemetrySource } from '../components/semantic-bindings-rig';

describe('visible model propulsors', () => {
  const pose = { x: 50, z: 70, headingRad: 0, speedMps: 12 };
  it('reads the mounted node, remaps each substep and never uses demo playback rate as RPM', () => {
    const model = new THREE.Group();
    model.rotation.y = 0.6; model.position.set(300, 0, -100); model.scale.setScalar(2);
    const port = new THREE.Group(); port.name = 'PROP_PORT'; port.position.set(-40, -3, -4); model.add(port);
    const track = new THREE.QuaternionKeyframeTrack('PROP_PORT.quaternion', [0, 1], [0, 0, 0, 1, Math.sin(0.5), 0, 0, Math.cos(0.5)]);
    const animations = [new THREE.AnimationClip('prop_port_spin', 1, [track])];
    const sim: BindingTelemetrySource = { rudderDeg: 0, speedMps: 999, attainedCount: 0, advancing: false };
    const sources = createMarinePropulsors(model, animations, { ...TYPE055_NANCHANG_101_V2, propulsionAnchors: undefined }, () => sim);
    const [source] = sources.sample(pose);
    expect(source.x).toBeCloseTo(58); expect(source.z).toBeCloseTo(-10);
    expect(source.headingRad).toBeCloseTo(0); expect(source.depthMeters).toBeCloseTo(5);
    expect(source.activity).toBeGreaterThan(0); expect(source.estimated).toBe(true);
    const turned = sources.sample({ ...pose, headingRad: Math.PI / 2 })[0];
    expect(turned.x).toBeCloseTo(-30); expect(turned.z).toBeCloseTo(62);
    expect(sources.sample({ ...pose, speedMps: 0 })[0].activity).toBe(0);
  });
  it('supports zero-speed RPM wash, azimuth, reverse thrust, missing nodes and cutter exclusion', () => {
    const model = new THREE.Group(), pivot = new THREE.Group(), prop = new THREE.Group();
    prop.name = 'jet'; prop.position.set(-5, -2, 0); pivot.add(prop); model.add(pivot);
    const descriptor = { ...TYPE055_NANCHANG_101_V2, propulsors: undefined, propulsionAnchors: undefined,
      semanticBindings: [
        { id: 'prop', drive: 'live-spin' as const, nodes: ['jet'], axis: 'x' as const, azipodSlot: 'P' as const, sign: -1 as const },
        { id: 'missing', drive: 'live-spin' as const, nodes: ['absent'], axis: 'x' as const },
        { id: 'cutter', drive: 'live-spin' as const, nodes: ['jet'], axis: 'x' as const, cutter: true },
      ] };
    let sim: BindingTelemetrySource = { rudderDeg: 0, speedMps: 0, attainedCount: 0, azipod: { P: { azimuthRad: 0, rpm: 90 } } };
    const sources = createMarinePropulsors(model, [], descriptor, () => sim);
    expect(sources.sample({ ...pose, speedMps: 0 })).toHaveLength(1);
    expect(sources.sample(pose)[0].activity).toBe(1);
    pivot.rotation.y = Math.PI / 3;
    const turned = sources.sample(pose)[0];
    expect(turned.headingRad).toBeCloseTo(Math.PI / 3);
    sim = { ...sim, azipod: { P: { azimuthRad: 0, rpm: -45 } } };
    expect(sources.sample(pose)[0].activity).toBe(0.25);
    expect(sources.sample(pose)[0].headingRad).toBeCloseTo(Math.PI * 4 / 3);
    sim = { ...sim, advancing: false };
    expect(sources.sample(pose)[0].activity).toBe(0);
  });
});
