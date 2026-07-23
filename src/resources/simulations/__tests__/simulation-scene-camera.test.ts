import { readFileSync } from 'node:fs';
import path from 'node:path';

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import {
  captureOrbitOffset,
  createViewOffsetStore,
  resolveStayPutGoal,
  translateWithShip,
  ZERO_ORBIT_OFFSET,
} from '../scene/camera/stay-put';
import { perspectiveTargetForScreenPoint, SCENE_CAMERA_SHOTS } from '../scene/camera/camera-shots';

const CAMERA_DIR = path.join(process.cwd(), 'src/resources/simulations/scene/camera');

const frame = (px: number, py: number, pz: number, tx: number, ty: number, tz: number) => ({
  position: new THREE.Vector3(px, py, pz),
  target: new THREE.Vector3(tx, ty, tz),
});

describe('view offset store', () => {
  it('keeps captured offsets per view and never clears them on view switches', () => {
    const store = createViewOffsetStore();
    const chaseBase = frame(0, 100, 300, 0, 0, 0);
    const orbitBase = frame(300, 80, 0, 0, 0, 0);
    const customized = frame(40, 140, 360, 10, 0, -20);

    store.capture('chase', chaseBase, customized.position, customized.target);
    const before = store.get('chase');
    expect(before.radius !== 0 || before.theta !== 0 || before.phi !== 0).toBe(true);

    // 在其他视角活动后，chase 的偏移必须原样保留（无清零语义）
    store.capture('orbit', orbitBase, frame(320, 60, 40, 0, 0, 0).position, frame(320, 60, 40, 0, 0, 0).target);
    store.capture('free', orbitBase, orbitBase.position, orbitBase.target);
    expect(store.get('chase')).toEqual(before);
  });
});

describe('stay-put goal resolution', () => {
  it('returns the preset frame unchanged when the user has not customized', () => {
    const base = frame(0, 100, 300, 0, 0, 0);
    const goal = resolveStayPutGoal(base, ZERO_ORBIT_OFFSET);
    expect(goal.position.distanceTo(base.position)).toBeCloseTo(0, 6);
    expect(goal.target.distanceTo(base.target)).toBeCloseTo(0, 6);
  });

  it('round-trips: captured offset resolves back to the customized framing', () => {
    const base = frame(0, 120, 320, 0, 0, 0);
    const customized = frame(-60, 180, 260, 15, 4, -10);
    const offset = captureOrbitOffset(base, customized.position, customized.target);
    const goal = resolveStayPutGoal(base, offset);
    expect(goal.position.distanceTo(customized.position)).toBeCloseTo(0, 3);
    expect(goal.target.distanceTo(customized.target)).toBeCloseTo(0, 3);
  });
});

describe('translate with ship', () => {
  it('moves camera and target by the same ship delta, preserving relative framing', () => {
    const current = frame(0, 100, 300, 25, 0, -40);
    const delta = new THREE.Vector3(50, 0, -30);
    const moved = translateWithShip(current, delta);
    expect(moved.position.x).toBeCloseTo(50, 6);
    expect(moved.position.z).toBeCloseTo(270, 6);
    expect(moved.target.x).toBeCloseTo(75, 6);
    expect(moved.target.z).toBeCloseTo(-70, 6);
    expect(moved.position.clone().sub(moved.target).distanceTo(current.position.clone().sub(current.target))).toBeCloseTo(0, 6);
  });
});

describe('cinematic shot presets', () => {
  const ship = { shipX: 100, shipZ: -50, headingRad: Math.PI / 6, shipLength: 180 };
  const shots = SCENE_CAMERA_SHOTS;

  it('chase frames behind and above the ship relative to heading', () => {
    const shot = shots.chase.frame(ship);
    const forward = new THREE.Vector3(Math.sin(ship.headingRad), 0, Math.cos(ship.headingRad));
    const toCamera = shot.position.clone().sub(new THREE.Vector3(ship.shipX, 0, ship.shipZ));
    expect(toCamera.dot(forward)).toBeLessThan(0);
    expect(shot.position.y).toBeGreaterThan(0);
    expect(shot.target.distanceTo(new THREE.Vector3(ship.shipX, 0, ship.shipZ))).toBeLessThan(ship.shipLength);
  });

  it('top-down frames directly above the ship', () => {
    const shot = shots.topDown.frame(ship);
    expect(Math.abs(shot.position.x - ship.shipX)).toBeLessThan(ship.shipLength * 0.5);
    expect(Math.abs(shot.position.z - ship.shipZ)).toBeLessThan(ship.shipLength * 0.5);
    expect(shot.position.y).toBeGreaterThan(ship.shipLength);
  });

  it('retreat frames ahead of the ship looking back', () => {
    const shot = shots.retreat.frame(ship);
    const forward = new THREE.Vector3(Math.sin(ship.headingRad), 0, Math.cos(ship.headingRad));
    const toCamera = shot.position.clone().sub(new THREE.Vector3(ship.shipX, 0, ship.shipZ));
    expect(toCamera.dot(forward)).toBeGreaterThan(0);
  });

  it('perspectiveTargetForScreenPoint places the ship at the requested screen point', () => {
    const position = new THREE.Vector3(500, 300, 800);
    const anchor = new THREE.Vector3(0, 0, 0);
    const target = perspectiveTargetForScreenPoint({
      anchor,
      position,
      screenX: 0.62,
      screenY: 0.4,
      fovDeg: 60,
      aspect: 16 / 9,
    });
    const camera = new THREE.PerspectiveCamera(60, 16 / 9, 1, 50000);
    camera.position.copy(position);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    const projected = anchor.clone().project(camera);
    expect((projected.x + 1) / 2).toBeCloseTo(0.62, 2);
    expect((1 - projected.y) / 2).toBeCloseTo(0.4, 2);
  });
});

describe('sample experiment camera wiring', () => {
  it('replaces the legacy controller with the stay-put pipeline controller', () => {
    const destroyer = readFileSync(
      path.join(process.cwd(), 'src/resources/simulations/simulations/destroyer-simulation.tsx'), 'utf8'
    );
    expect(destroyer).toContain('<StayPutCameraController');
    expect(destroyer).not.toContain('UnifiedCameraController');
  });

  it('offers the shot list through the shared switcher views prop', () => {
    const switcher = readFileSync(
      path.join(process.cwd(), 'src/resources/simulations/components/camera-view-switcher.tsx'), 'utf8'
    );
    expect(switcher).toContain('views');
    const destroyer = readFileSync(
      path.join(process.cwd(), 'src/resources/simulations/simulations/destroyer-simulation.tsx'), 'utf8'
    );
    expect(destroyer).toContain('SCENE_CAMERA_SHOTS');
  });

  it('keeps no offset-reset semantics in the pipeline camera module', () => {
    for (const file of ['stay-put.ts', 'stay-put-camera-controller.tsx', 'camera-shots.ts']) {
      const source = readFileSync(path.join(CAMERA_DIR, file), 'utf8');
      expect(source).not.toContain('shouldResetPresetOffset');
    }
  });

  it('ends drag interaction on pointer up so offsets capture on the dominant drag path', () => {
    const controller = readFileSync(path.join(CAMERA_DIR, 'stay-put-camera-controller.tsx'), 'utf8');
    const pointerUpBlock = controller.slice(
      controller.indexOf('handlePointerUp'),
      controller.indexOf('handlePointerUp') + 200
    );
    expect(pointerUpBlock).toContain('interactingRef.current = false');
  });
});
