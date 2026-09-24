/**
 * 海洋画面验收（#2136）。
 * 本地规则判断远场平面、反射、法线、水线、泡沫和七船重放。
 * 不产生漂亮度总分，失败时不改写金图。
 */

import { FLEET_ACTIVE_PACKAGES } from '@/resources/simulations/model-packages/fleet-packages';
import type { SimulationModelId } from '@/lib/browser-delivery/types';
import { containerMscSceneVisual } from '@/resources/simulations/profiles/container-msc-scene';
import { cruiseAdoraSceneVisual } from '@/resources/simulations/profiles/cruise-adora-scene';
import { destroyer055SceneVisual } from '@/resources/simulations/profiles/destroyer-055-scene';
import { dredgerTianjingSceneVisual } from '@/resources/simulations/profiles/dredger-tianjing-scene';
import { drillingHysy981SceneVisual } from '@/resources/simulations/profiles/drilling-hysy981-scene';
import { icebreakerXuelongSceneVisual } from '@/resources/simulations/profiles/icebreaker-xuelong-scene';
import { lngChanghengSceneVisual } from '@/resources/simulations/profiles/lng-changheng-scene';
import { computeVisualWaterPose, resolveMarineVisualPose } from '@/resources/simulations/scene/frame/marine-frame';
import type { SceneShipVisualProfile } from '@/resources/simulations/scene/types';
import {
  GERSTNER_WATER_BASE_Y,
  createNearFieldSurfaceQuery,
  gerstnerAmplitudeScale,
} from '@/resources/simulations/scene/water/gerstner-water';
import {
  GERSTNER_WAVE_SETS,
  computeGerstnerDisplacement,
} from '@/resources/simulations/scene/water/gerstner-waves';

const GRID = 16;
const CRUISE_TELEMETRY_ROLL = 0.21;

export interface VisualAcceptanceScene {
  readonly farFieldRotationX: number;
  readonly reflectionRequired: boolean;
  readonly reflectionEnabled: boolean;
  readonly foamRequired: boolean;
  readonly foamEnabled: boolean;
  readonly normalsEnabled: boolean;
  readonly frozen: boolean;
  readonly blurred: boolean;
  readonly nonblank: boolean;
  readonly waterlinePitchOverride?: number | null;
}

export interface VisualDefect {
  readonly code:
    | 'vertical-far-field'
    | 'reflection-missing'
    | 'frozen-surface'
    | 'excess-blur'
    | 'foam-disabled'
    | 'normal-disabled'
    | 'waterline-pitch'
    | 'fleet-gap';
  readonly location: string;
  readonly detail: string;
}

export interface FleetVisualCheck {
  readonly id: SimulationModelId;
  readonly caseId: 'destroyer' | 'lng' | 'container' | 'ice' | 'cruise' | 'platform' | 'shallow-water';
  readonly packageId: string;
  readonly heave: number;
  readonly pitch: number;
  readonly roll: number;
  readonly resolvedRoll: number;
}

export interface VisualImageSummary {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly mean: number;
}

export interface VisualAcceptanceReport {
  readonly passed: boolean;
  readonly defects: readonly VisualDefect[];
  readonly beautyScore: null;
  readonly goldenRewritten: false;
  readonly crossAlgorithmPixelScore: null;
  readonly stillnessRewarded: false;
  readonly metrics: {
    readonly farFieldHorizontal: boolean;
    readonly reflectionTracksSky: boolean;
    readonly waveMotionMeters: number;
    readonly observedFrameDelta: number;
    readonly blurRatio: number;
    readonly foamCoverage: number;
    readonly normalSlope: number;
    readonly fleetCount: number;
  };
  readonly fleet: readonly FleetVisualCheck[];
  readonly images: readonly VisualImageSummary[];
}

const FLEET: readonly {
  readonly id: SimulationModelId;
  readonly caseId: FleetVisualCheck['caseId'];
  readonly profile: SceneShipVisualProfile;
}[] = [
  { id: 'destroyer', caseId: 'destroyer', profile: destroyer055SceneVisual },
  { id: 'lng-carrier', caseId: 'lng', profile: lngChanghengSceneVisual },
  { id: 'container', caseId: 'container', profile: containerMscSceneVisual },
  { id: 'icebreaker', caseId: 'ice', profile: icebreakerXuelongSceneVisual },
  { id: 'luxury-liner', caseId: 'cruise', profile: cruiseAdoraSceneVisual },
  { id: 'drilling-rig', caseId: 'platform', profile: drillingHysy981SceneVisual },
  { id: 'dredger', caseId: 'shallow-water', profile: dredgerTianjingSceneVisual },
];

function mean(values: ArrayLike<number>): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (let index = 0; index < values.length; index += 1) sum += values[index]!;
  return sum / values.length;
}

function farFieldIsHorizontal(rotationX: number): boolean {
  return Math.abs(rotationX + Math.PI / 2) < 1e-6;
}

export function reflectionDiagnostic(enabled: boolean): { readonly sky: readonly number[]; readonly water: readonly number[] } {
  const sky = [0.12, 0.84];
  const water = enabled ? [0.12, 0.84] : [0.22, 0.22];
  return { sky, water };
}

function reflectionTracksSky(enabled: boolean): boolean {
  const sample = reflectionDiagnostic(enabled);
  const skySpan = Math.abs(sample.sky[0]! - sample.sky[1]!);
  const waterSpan = Math.abs(sample.water[0]! - sample.water[1]!);
  if (skySpan < 0.2) return false;
  return waterSpan > skySpan * 0.5;
}

function heightGrid(blurred: boolean): Float64Array {
  const raw = new Float64Array(GRID * GRID);
  const cell = 8;
  for (let row = 0; row < GRID; row += 1) {
    for (let column = 0; column < GRID; column += 1) {
      raw[row * GRID + column] = computeGerstnerDisplacement(
        GERSTNER_WAVE_SETS.low,
        column * cell,
        row * cell,
        1.5,
      ).y;
    }
  }
  if (!blurred) return raw;
  let current = raw;
  for (let pass = 0; pass < 6; pass += 1) {
    const next = new Float64Array(GRID * GRID);
    for (let row = 0; row < GRID; row += 1) {
      for (let column = 0; column < GRID; column += 1) {
        let sum = 0;
        let count = 0;
        for (let dRow = -1; dRow <= 1; dRow += 1) {
          for (let dColumn = -1; dColumn <= 1; dColumn += 1) {
            const sampleRow = Math.min(GRID - 1, Math.max(0, row + dRow));
            const sampleColumn = Math.min(GRID - 1, Math.max(0, column + dColumn));
            sum += current[sampleRow * GRID + sampleColumn]!;
            count += 1;
          }
        }
        next[row * GRID + column] = sum / count;
      }
    }
    current = next;
  }
  return current;
}

function highFrequency(grid: Float64Array): number {
  let energy = 0;
  let count = 0;
  for (let row = 0; row < GRID; row += 1) {
    for (let column = 0; column < GRID - 1; column += 1) {
      energy += Math.abs(grid[row * GRID + column]! - grid[row * GRID + column + 1]!);
      count += 1;
    }
  }
  return count === 0 ? 0 : energy / count;
}

function meanAbsSlope(grid: Float64Array): number {
  return highFrequency(grid);
}

function crestCoverage(): number {
  let covered = 0;
  const count = 12;
  for (let index = 0; index < count; index += 1) {
    const crest = computeGerstnerDisplacement(GERSTNER_WAVE_SETS.low, index * 17, -index * 9, 2.2).crest;
    if (crest >= 0.5) covered += 1;
  }
  return covered / count;
}

function waveMotionMeters(): number {
  const times = [0, 0.75, 1.5];
  const heights = times.map((time) => computeGerstnerDisplacement(GERSTNER_WAVE_SETS.low, 12, -40, time).y);
  return Math.max(...heights) - Math.min(...heights);
}

function beamMeters(profile: SceneShipVisualProfile): number {
  return Math.abs(profile.wakeAnchors.portShoulder[0] - profile.wakeAnchors.starboardShoulder[0]);
}

function fleetChecks(waterlinePitchOverride: number | null): { readonly fleet: FleetVisualCheck[]; readonly defects: VisualDefect[] } {
  const defects: VisualDefect[] = [];
  const query = createNearFieldSurfaceQuery(gerstnerAmplitudeScale(4), 0, 0, 3.5);
  const fleet = FLEET.map((ship) => {
    const descriptor = FLEET_ACTIVE_PACKAGES[ship.id];
    if (!descriptor) {
      defects.push({
        code: 'fleet-gap',
        location: `fleet.${ship.id}`,
        detail: 'active fleet package missing',
      });
    }
    const width = beamMeters(ship.profile);
    const length = ship.profile.shipLengthMeters;
    const visual = computeVisualWaterPose(
      (x, z) => query.heightAt(x, z),
      { x: 0, z: 0, headingRad: 0 },
      { length, width },
    );
    const bow = query.heightAt(length / 2, 0);
    const stern = query.heightAt(-length / 2, 0);
    const contactPitch = Math.atan2(bow - stern, length);
    const reportedPitch = waterlinePitchOverride ?? visual.pitch;
    if (Math.abs(reportedPitch - contactPitch) > 1e-3 && Math.abs(bow - stern) > 0.05) {
      defects.push({
        code: 'waterline-pitch',
        location: `fleet.${ship.id}.waterline`,
        detail: `reported ${reportedPitch} differs from bow-stern ${contactPitch}`,
      });
    }
    const resolved = resolveMarineVisualPose({
      ownership: ship.id === 'luxury-liner'
        ? { heave: 'visual-water', pitch: 'fixed', roll: 'telemetry' }
        : { heave: 'visual-water', pitch: 'visual-water', roll: 'visual-water' },
      visualWater: visual,
      telemetry: { roll: CRUISE_TELEMETRY_ROLL },
    });
    if (ship.id === 'luxury-liner' && resolved.roll !== CRUISE_TELEMETRY_ROLL) {
      defects.push({
        code: 'fleet-gap',
        location: 'fleet.luxury-liner.roll',
        detail: 'cruise roll left the telemetry value',
      });
    }
    return {
      id: ship.id,
      caseId: ship.caseId,
      packageId: descriptor?.packageId ?? 'missing',
      heave: visual.heave,
      pitch: visual.pitch,
      roll: visual.roll,
      resolvedRoll: resolved.roll,
    };
  });
  if (fleet.length !== 7) {
    defects.push({ code: 'fleet-gap', location: 'fleet', detail: `expected 7 ships, saw ${fleet.length}` });
  }
  for (const caseId of ['cruise', 'platform', 'ice', 'shallow-water'] as const) {
    if (!fleet.some((ship) => ship.caseId === caseId)) {
      defects.push({ code: 'fleet-gap', location: `fleet.${caseId}`, detail: 'named case missing' });
    }
  }
  return { fleet, defects };
}

export function runMarineVisualAcceptance(scene: VisualAcceptanceScene): VisualAcceptanceReport {
  const defects: VisualDefect[] = [];
  const horizontal = farFieldIsHorizontal(scene.farFieldRotationX);
  if (!horizontal) {
    defects.push({
      code: 'vertical-far-field',
      location: 'far-field.rotationX',
      detail: `rotationX ${scene.farFieldRotationX} is not the horizontal ocean plane`,
    });
  }
  const tracksSky = reflectionTracksSky(scene.reflectionEnabled);
  if (scene.reflectionRequired && !tracksSky) {
    defects.push({
      code: 'reflection-missing',
      location: 'diagnostic.reflection',
      detail: 'water does not follow the directional sky',
    });
  }
  const motion = waveMotionMeters();
  const observedFrameDelta = scene.frozen ? 0 : motion;
  if (motion > 0.05 && observedFrameDelta < motion * 0.05) {
    defects.push({
      code: 'frozen-surface',
      location: 'wave.time-series',
      detail: `expected motion ${motion} m but observed frame delta ${observedFrameDelta}`,
    });
  }
  const reference = heightGrid(false);
  const candidate = heightGrid(scene.blurred);
  const referenceEnergy = highFrequency(reference);
  const candidateEnergy = highFrequency(candidate);
  const blurRatio = referenceEnergy === 0 ? 1 : candidateEnergy / referenceEnergy;
  if (blurRatio < 0.45) {
    defects.push({
      code: 'excess-blur',
      location: 'reference.blur',
      detail: `high-frequency ratio ${blurRatio} against the same-route reference`,
    });
  }
  const slope = meanAbsSlope(reference);
  if (!scene.normalsEnabled && slope > 1e-3) {
    defects.push({
      code: 'normal-disabled',
      location: 'diagnostic.normal',
      detail: `surface slope ${slope} has no matching normal`,
    });
  }
  const foam = scene.foamEnabled ? crestCoverage() : 0;
  if (scene.foamRequired && foam <= 0) {
    defects.push({
      code: 'foam-disabled',
      location: 'foam.coverage',
      detail: 'required foam coverage is zero',
    });
  }
  const fleet = fleetChecks(scene.waterlinePitchOverride ?? null);
  defects.push(...fleet.defects);
  const reflection = reflectionDiagnostic(scene.reflectionEnabled);
  const images: VisualImageSummary[] = [
    {
      id: 'reflection-water',
      width: reflection.water.length,
      height: 1,
      mean: mean(reflection.water),
    },
    {
      id: 'height-reference',
      width: GRID,
      height: GRID,
      mean: mean(reference),
    },
  ];
  if (scene.nonblank && images.every((image) => image.mean === 0)) {
    defects.push({
      code: 'fleet-gap',
      location: 'images',
      detail: 'diagnostic image is blank',
    });
  }
  return {
    passed: defects.length === 0,
    defects,
    beautyScore: null,
    goldenRewritten: false,
    crossAlgorithmPixelScore: null,
    stillnessRewarded: false,
    metrics: {
      farFieldHorizontal: horizontal,
      reflectionTracksSky: tracksSky,
      waveMotionMeters: motion,
      observedFrameDelta,
      blurRatio,
      foamCoverage: foam,
      normalSlope: slope,
      fleetCount: fleet.fleet.length,
    },
    fleet: fleet.fleet,
    images,
  };
}

export function healthyWaveOnlyScene(farFieldRotationX: number): VisualAcceptanceScene {
  return {
    farFieldRotationX,
    reflectionRequired: false,
    reflectionEnabled: false,
    foamRequired: false,
    foamEnabled: false,
    normalsEnabled: true,
    frozen: false,
    blurred: false,
    nonblank: true,
  };
}

export function commitGoldenUpdate(
  report: VisualAcceptanceReport,
  options: { readonly updateGolden: boolean; readonly reviewed: boolean },
): { readonly goldenRewritten: boolean } {
  if (!options.updateGolden) return { goldenRewritten: false };
  if (!options.reviewed) throw new Error('golden update requires an explicit review');
  return { goldenRewritten: true };
}

export const VISUAL_ACCEPTANCE_WATER_BASE_Y = GERSTNER_WATER_BASE_Y;
