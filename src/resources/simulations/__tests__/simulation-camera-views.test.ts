import { readFileSync } from 'node:fs';
import path from 'node:path';

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { orbitFrameAt, SCENE_CAMERA_SHOTS } from '../scene/camera/camera-shots';
import { captureOrbitOffset, createViewOffsetStore, resolveStayPutGoal } from '../scene/camera/stay-put';

const CAMERA_DIR = path.join(process.cwd(), 'src/resources/simulations/scene/camera');
const SWITCHER = path.join(process.cwd(), 'src/resources/simulations/components/camera-view-switcher.tsx');

const SHIP = { shipX: 0, shipZ: 0, headingRad: 0, shipLength: 100 };

describe('redefined cinematic shots', () => {
  it('chase frames directly astern at 45° elevation (1.8 slant lengths)', () => {
    const frame = SCENE_CAMERA_SHOTS.chase.frame(SHIP);
    const horizontal = 100 * 1.8 * Math.cos(Math.PI / 4);
    expect(frame.position.x).toBeCloseTo(0, 4);
    expect(frame.position.y).toBeCloseTo(100 * 1.8 * Math.sin(Math.PI / 4), 4);
    expect(frame.position.z).toBeCloseTo(-horizontal, 4);
    expect(frame.target.equals(new THREE.Vector3(0, 0, 0))).toBe(true);
  });

  it('tactical frames at right-rear 45° azimuth and 45° elevation (2.0 slant lengths)', () => {
    const frame = SCENE_CAMERA_SHOTS.tactical.frame(SHIP);
    const horizontal = 100 * 2.0 * Math.cos(Math.PI / 4);
    expect(frame.position.x).toBeCloseTo(-horizontal / Math.SQRT2, 4);
    expect(frame.position.y).toBeCloseTo(100 * 2.0 * Math.sin(Math.PI / 4), 4);
    expect(frame.position.z).toBeCloseTo(-horizontal / Math.SQRT2, 4);
  });

  it('exposes tactical instead of retreat', () => {
    expect('tactical' in SCENE_CAMERA_SHOTS).toBe(true);
    expect('retreat' in SCENE_CAMERA_SHOTS).toBe(false);
  });
});

describe('orbit auto-rotation helper', () => {
  it('places the camera on a 45° elevation circle of 2.2 lengths by azimuth', () => {
    const ship = new THREE.Vector3(0, 0, 0);
    const atZero = orbitFrameAt(ship, 0, 100);
    const horizontal = 100 * 2.2 * Math.cos(Math.PI / 4);
    expect(atZero.position.x).toBeCloseTo(horizontal, 4);
    expect(atZero.position.y).toBeCloseTo(100 * 2.2 * Math.sin(Math.PI / 4), 4);
    expect(atZero.position.z).toBeCloseTo(0, 4);
    const atQuarter = orbitFrameAt(ship, Math.PI / 2, 100);
    expect(atQuarter.position.x).toBeCloseTo(0, 4);
    expect(atQuarter.position.z).toBeCloseTo(horizontal, 4);
    expect(atQuarter.target.equals(ship)).toBe(true);
  });
});

describe('explicit view reset', () => {
  it('clears a captured offset only when the view is explicitly reset', () => {
    const store = createViewOffsetStore();
    const base = SCENE_CAMERA_SHOTS.chase.frame(SHIP);
    const customized = {
      position: base.position.clone().add(new THREE.Vector3(5, 3, 0)),
      target: base.target.clone(),
    };
    store.capture('chase', base, customized.position, customized.target);
    expect(resolveStayPutGoal(base, store.get('chase')).position.x).toBeCloseTo(5, 4);
    store.clear('chase');
    expect(resolveStayPutGoal(base, store.get('chase')).position.x).toBeCloseTo(base.position.x, 4);
    expect(resolveStayPutGoal(base, store.get('orbit')).position.x).toBeCloseTo(
      SCENE_CAMERA_SHOTS.orbit.frame(SHIP).position.x,
      4
    );
  });
});

describe('view popover and controller wiring', () => {
  it('fires onViewReset when the active view is re-selected and offers free view', () => {
    const source = readFileSync(SWITCHER, 'utf8');
    expect(source).toContain('onViewReset');
    expect(source).toContain('自由');
  });

  it('labels the tactical view and drops the retreat label', () => {
    const source = readFileSync(SWITCHER, 'utf8');
    expect(source).not.toContain('退却');
    const shots = readFileSync(path.join(CAMERA_DIR, 'camera-shots.ts'), 'utf8');
    expect(shots).toContain('战术');
    expect(shots).not.toContain('退却');
  });

  it('drives orbit auto-rotation and reset signals in the controller', () => {
    const controller = readFileSync(path.join(CAMERA_DIR, 'stay-put-camera-controller.tsx'), 'utf8');
    expect(controller).toContain('ORBIT_PERIOD_SECONDS');
    expect(controller).toContain('resetSignal');
    expect(controller).toContain('store.clear');
  });

  it('pauses orbit auto-rotation on the release frame until the drag offset is captured', () => {
    const controller = readFileSync(path.join(CAMERA_DIR, 'stay-put-camera-controller.tsx'), 'utf8');
    expect(controller).toContain('if (!hasUserOffset && !interactingRef.current && !pointerActiveRef.current && !wasInteractingRef.current)');
  });
});
