import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { deflateSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { HYSY981_THRUSTER_LAYOUT } from '../core/constants';
import { TYPE055_NANCHANG_101_V2, propulsorSceneAnchors } from '../model-packages/type055-nanchang-101-v2';
import { cruiseAdoraSceneVisual } from '../profiles/cruise-adora-scene';
import { containerMscSceneVisual } from '../profiles/container-msc-scene';
import { destroyer055SceneVisual } from '../profiles/destroyer-055-scene';
import { dredgerTianjingSceneVisual } from '../profiles/dredger-tianjing-scene';
import { drillingHysy981SceneVisual } from '../profiles/drilling-hysy981-scene';
import { icebreakerXuelongSceneVisual } from '../profiles/icebreaker-xuelong-scene';
import { lngChanghengSceneVisual } from '../profiles/lng-changheng-scene';
import {
  instanceKeepsCompositeDetail,
  instanceLodDistanceMeters,
  marineLayoutLevelTriangles,
  marineLayoutSedimentPlume,
} from '../scene/environment/scene-layout-objects';
import { MARINE_SCENE_LAYOUTS } from '../scene/environment/scene-layouts';
import { computeVisualWaterPose, resolveMarineVisualPose } from '../scene/frame/marine-frame';
import { FAR_FIELD_BAND_SPECS, NEAR_FIELD_BAND_SPECS, bandCellSize, bandLimitWaves, nearFieldEnvelope } from '../scene/water/ocean-bands';
import {
  FoamHistoryField,
  FOAM_HISTORY_BY_TIER,
  replayLocalizedWash,
  VESSEL_FOAM_RATE_PER_SECOND,
} from '../scene/water/foam-history';
import { FOAM_DOMAIN_METERS } from '../scene/water/foam-history-layer';
import {
  GERSTNER_WATER_BASE_Y,
  NEAR_FIELD_VISIBLE_WAVES,
  createNearFieldSurfaceQuery,
  gerstnerAmplitudeScale,
} from '../scene/water/gerstner-water';
import { syncSharedWaterOptics } from '../scene/water/shared-water-optics';
import type { SceneShipVisualProfile } from '../scene/types';

const FLEET: SceneShipVisualProfile[] = [
  destroyer055SceneVisual,
  lngChanghengSceneVisual,
  containerMscSceneVisual,
  icebreakerXuelongSceneVisual,
  cruiseAdoraSceneVisual,
  drillingHysy981SceneVisual,
  dredgerTianjingSceneVisual,
];

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([length, typeBuf, data, crc]);
}

function encodeGrayPng(width: number, height: number, gray: Uint8Array): Buffer {
  const raw = Buffer.alloc(height * (width + 1));
  for (let y = 0; y < height; y += 1) {
    raw[y * (width + 1)] = 0;
    raw.set(gray.subarray(y * width, (y + 1) * width), y * (width + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function densityImage(field: FoamHistoryField, spanMeters: number): Buffer {
  const size = 64;
  const gray = new Uint8Array(size * size);
  for (let j = 0; j < size; j += 1) {
    const z = (j + 0.5) * (spanMeters / size) - spanMeters / 2;
    for (let i = 0; i < size; i += 1) {
      const x = (i + 0.5) * (spanMeters / size) - spanMeters / 2;
      gray[j * size + i] = Math.round(Math.min(1, field.densityAt(x, z)) * 255);
    }
  }
  return encodeGrayPng(size, size, gray);
}

describe('fleet contact and named layouts (#2133)', () => {
  it('samples all seven waterlines from one near-field query', () => {
    const query = createNearFieldSurfaceQuery(gerstnerAmplitudeScale(4), 0, 0, 3.5);
    expect(FLEET).toHaveLength(7);
    const interior = [query.heightAt(0, 0), query.heightAt(80, -40), query.heightAt(-120, 60)];
    const edge = query.heightAt(1000, 1000);
    const interiorDeparture = Math.max(...interior.map((height) => Math.abs(height - GERSTNER_WATER_BASE_Y)));
    expect(nearFieldEnvelope(0, 0, NEAR_FIELD_BAND_SPECS.high.size)).toBe(1);
    expect(nearFieldEnvelope(NEAR_FIELD_BAND_SPECS.high.size / 2, 0, NEAR_FIELD_BAND_SPECS.high.size)).toBe(0);
    expect(interiorDeparture).toBeGreaterThan(0.05);
    expect(Math.abs(edge - GERSTNER_WATER_BASE_Y)).toBeLessThan(interiorDeparture * 0.25);
    expect(bandLimitWaves(NEAR_FIELD_VISIBLE_WAVES, bandCellSize(FAR_FIELD_BAND_SPECS.high))).toHaveLength(0);
    for (const ship of FLEET) {
      const width = Math.abs(ship.wakeAnchors.portShoulder[0] - ship.wakeAnchors.starboardShoulder[0]);
      const visual = computeVisualWaterPose(
        (x, z) => query.heightAt(x, z),
        { x: 0, z: 0, headingRad: 0 },
        { length: ship.shipLengthMeters, width },
      );
      expect(Number.isFinite(visual.heave)).toBe(true);
      expect(Number.isFinite(visual.pitch)).toBe(true);
      expect(Number.isFinite(visual.roll)).toBe(true);
      const bow = query.heightAt(0, ship.shipLengthMeters * 0.45);
      const stern = query.heightAt(0, -ship.shipLengthMeters * 0.45);
      expect(Number.isFinite(bow)).toBe(true);
      expect(Number.isFinite(stern)).toBe(true);
    }
    const cruiseWidth = Math.abs(
      cruiseAdoraSceneVisual.wakeAnchors.portShoulder[0]
      - cruiseAdoraSceneVisual.wakeAnchors.starboardShoulder[0],
    );
    const cruiseVisual = computeVisualWaterPose(
      (x, z) => query.heightAt(x, z),
      { x: 0, z: 0, headingRad: 0.2 },
      { length: cruiseAdoraSceneVisual.shipLengthMeters, width: cruiseWidth },
    );
    const cruisePose = resolveMarineVisualPose({
      ownership: { heave: 'visual-water', pitch: 'fixed', roll: 'telemetry' },
      visualWater: { ...cruiseVisual, roll: cruiseVisual.roll + 0.4 },
      telemetry: { roll: 0.21 },
    });
    expect(cruisePose.roll).toBe(0.21);
    expect(cruisePose.pitch).toBe(0);
    expect(cruisePose.heave).toBeCloseTo(cruiseVisual.heave);
  });

  it('reduces harbor and arctic detail when the camera retreats', () => {
    for (const id of ['harbor-entrance-channel', 'polar-ice-field'] as const) {
      const layout = MARINE_SCENE_LAYOUTS[id];
      const anchored = layout.objects.map((object) => [object.id, object.x, object.z]);
      expect(layout.objects.some((object) => object.detail === 'near' && object.scale > 1)).toBe(true);
      expect(layout.objects.some((object) => object.detail === 'far' && object.scale > 1)).toBe(true);
      expect(anchored).toEqual(layout.objects.map((object) => [object.id, object.x, object.z]));
    }
    expect(MARINE_SCENE_LAYOUTS['polar-ice-field'].iceCoverage).toBeGreaterThan(0);
    const plume = marineLayoutSedimentPlume('shallow-construction-site');
    expect(plume?.radiusMeters).toBeGreaterThan(1);
    expect(plume?.opacity).toBeGreaterThan(0);
    for (const kind of ['crane', 'ice-floe'] as const) {
      expect(marineLayoutLevelTriangles(kind, 'simplified')).toBeLessThan(
        marineLayoutLevelTriangles(kind, 'composite'),
      );
    }
    const crane = MARINE_SCENE_LAYOUTS['harbor-entrance-channel'].objects.find((object) => object.id === 'crane-1');
    expect(crane).toBeDefined();
    const lodDistance = instanceLodDistanceMeters(crane!);
    const retreated = Math.hypot(crane!.x, crane!.z);
    expect(instanceKeepsCompositeDetail(retreated, lodDistance, false)).toBe(false);
    expect(instanceKeepsCompositeDetail(0, lodDistance, false)).toBe(true);
  });

  it('records named-condition density images and foam step cost', () => {
    const field = new FoamHistoryField({
      spec: FOAM_HISTORY_BY_TIER.medium,
      domainMeters: FOAM_DOMAIN_METERS,
    });
    const anchors = propulsorSceneAnchors(
      TYPE055_NANCHANG_101_V2,
      destroyer055SceneVisual.shipLengthMeters,
    );
    expect(anchors.length).toBeGreaterThanOrEqual(2);
    const started = performance.now();
    const radius = 70;
    const peakNear = (x: number, z: number) => {
      let peak = 0;
      for (let dz = -12; dz <= 12; dz += 4) {
        for (let dx = -12; dx <= 12; dx += 4) {
          peak = Math.max(peak, field.densityAt(x + dx, z + dz));
        }
      }
      return peak;
    };
    let first: Array<readonly [number, number]> = [];
    let last: Array<readonly [number, number]> = [];
    for (let step = 0; step < 24; step += 1) {
      const heading = (step / 23) * (Math.PI / 2);
      const shipX = radius * Math.sin(heading);
      const shipZ = radius * (1 - Math.cos(heading));
      const cos = Math.cos(heading);
      const sin = Math.sin(heading);
      last = anchors.map(({ anchor }) => [
        shipX + anchor[0] * cos - anchor[2] * sin,
        shipZ + anchor[0] * sin + anchor[2] * cos,
      ] as const);
      if (step === 0) first = last;
      for (const [x, z] of last) field.deposit(x, z, 14, VESSEL_FOAM_RATE_PER_SECOND * 0.2);
      field.step(0.1, null);
    }
    for (let dwell = 0; dwell < 6; dwell += 1) {
      for (const [x, z] of last) field.deposit(x, z, 14, VESSEL_FOAM_RATE_PER_SECOND * 0.2);
      field.step(0.1, null);
    }
    const trail = last.map(([x, z]) => peakNear(x, z));
    for (let step = 0; step < 12; step += 1) field.step(0.1, null);
    const stepCostMs = performance.now() - started;
    for (const [index, [x, z]] of last.entries()) {
      const afterStop = peakNear(x, z);
      expect(afterStop).toBeGreaterThan(0.2);
      expect(afterStop).toBeLessThan(trail[index]);
    }
    for (const [x, z] of first) {
      expect(peakNear(x, z)).toBeGreaterThan(0.05);
    }
    const aheadX = last[0][0] + 90;
    const aheadZ = last[0][1] + 90;
    expect(field.densityAt(aheadX, aheadZ)).toBeLessThan(0.05);

    const station = new FoamHistoryField({
      spec: FOAM_HISTORY_BY_TIER.low,
      domainMeters: 512,
    });
    const propulsors = HYSY981_THRUSTER_LAYOUT.map(
      (thruster) => [thruster.positionX, thruster.positionY] as const,
    );
    replayLocalizedWash(station, propulsors, 3);
    const stationImage = densityImage(station, 160);
    const turnImage = densityImage(field, 220);
    expect(stationImage.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(turnImage.length).toBeGreaterThan(80);
    expect(stepCostMs).toBeGreaterThan(0);
    expect(stepCostMs).toBeLessThan(5_000);

    const evidenceDir = process.env.MARINE_RESPONSE_EVIDENCE_DIR;
    if (evidenceDir) {
      mkdirSync(evidenceDir, { recursive: true });
      writeFileSync(path.join(evidenceDir, 'destroyer-turn-stop.png'), turnImage);
      writeFileSync(path.join(evidenceDir, 'platform-station-keeping.png'), stationImage);
      writeFileSync(path.join(evidenceDir, 'stage-cost.json'), JSON.stringify({
        destroyerTurnStopMs: stepCostMs,
        mediumTierHz: FOAM_HISTORY_BY_TIER.medium.updateHz,
        propulsorCount: anchors.length,
        stationPropulsorCount: propulsors.length,
      }, null, 2));
    }
  });

  it('copies scene foam drift into the shared water material', () => {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uShallowFxEnabled: { value: 0 },
        uViewport: { value: new THREE.Vector2() },
        uFoamOrigin: { value: new THREE.Vector2() },
        uFoamDrift: { value: new THREE.Vector2() },
        uEnvEnabled: { value: 0 },
        envMap: { value: null },
        envMapIntensity: { value: 0 },
        envMapRotation: { value: new THREE.Matrix3() },
        uPlanarTex: { value: null },
        uPlanarMatrix: { value: new THREE.Matrix4() },
        uPlanarStrength: { value: 0 },
        uPlanarPlaneY: { value: 0 },
        uShallowBgTex: { value: null },
        uShallowBgEnabled: { value: 0 },
      },
    });
    const scene = new THREE.Scene();
    scene.userData.marineFoamField = { driftMetersPerSecond: [1.25, -0.5] as const };
    const gl = {
      getDrawingBufferSize(target: THREE.Vector2) {
        target.set(1280, 720);
        return target;
      },
    } as THREE.WebGLRenderer;
    syncSharedWaterOptics({
      material,
      scene,
      gl,
      disableEnvironment: true,
      shallowEnabled: false,
      envSpin: false,
      elapsedSeconds: 1,
    });
    expect(material.uniforms.uFoamDrift.value.x).toBeCloseTo(1.25);
    expect(material.uniforms.uFoamDrift.value.y).toBeCloseTo(-0.5);
    expect(material.uniforms.uViewport.value.x).toBe(1280);
  });
});
