/**
 * 海洋画面验收（#2136）。
 * 只判断调用方从场景、画布和采样器读到的测量值。
 * 不根据路由名称合成反射、泡沫或七船姿态，也不产生漂亮度总分。
 */

export interface PositionSpans {
  readonly xSpan: number;
  readonly ySpan: number;
  readonly zSpan: number;
}

export interface MarineSceneObservation {
  readonly drawingBufferWidth: number;
  readonly drawingBufferHeight: number;
  readonly farField: PositionSpans | null;
  readonly planarReflectionStrength: number | null;
  readonly foamFieldPresent: boolean;
  readonly waveHeights: readonly [number, number];
  readonly normalSlope: number;
  readonly pixelMean: number;
  readonly reflectionPixelMean: number | null;
  readonly reportedPitch: number | null;
  readonly contactPitch: number | null;
}

export interface MarineSceneRequirements {
  readonly reflectionRequired: boolean;
  readonly foamRequired: boolean;
}

export interface FleetConsumerObservation {
  readonly consumerId: string;
  readonly drawingBufferWidth: number;
  readonly drawingBufferHeight: number;
  readonly pixelMean: number;
  readonly waveDelta: number;
  readonly shipRadius: number;
  readonly shipX: number | null;
  readonly shipY: number | null;
  readonly shipZ: number | null;
  readonly shipYaw: number | null;
  readonly shipDelta: number;
  readonly resolvedRoll: number | null;
  readonly telemetryRoll: number | null;
}

export interface VisualDefect {
  readonly code:
    | 'vertical-far-field'
    | 'reflection-missing'
    | 'frozen-surface'
    | 'foam-disabled'
    | 'normal-disabled'
    | 'waterline-pitch'
    | 'canvas-empty'
    | 'canvas-blank'
    | 'fleet-gap';
  readonly location: string;
  readonly detail: string;
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
    readonly waveMotion: number;
    readonly normalSlope: number;
    readonly pixelMean: number;
    readonly planarReflectionStrength: number | null;
    readonly fleetCount: number;
  };
  readonly images: readonly VisualImageSummary[];
}

export const FLEET_CONSUMER_IDS = [
  'destroyer',
  'lng',
  'container',
  'icebreaker',
  'cruise',
  'drilling',
  'dredger',
] as const;

export function measurePositionSpans(positions: ArrayLike<number>): PositionSpans {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let index = 0; index + 2 < positions.length; index += 3) {
    const x = positions[index]!;
    const y = positions[index + 1]!;
    const z = positions[index + 2]!;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  if (!Number.isFinite(minX)) return { xSpan: 0, ySpan: 0, zSpan: 0 };
  return { xSpan: maxX - minX, ySpan: maxY - minY, zSpan: maxZ - minZ };
}

export function farFieldIsHorizontal(spans: PositionSpans): boolean {
  return spans.zSpan > 100 && spans.ySpan < spans.zSpan * 0.05;
}

function waveMotion(heights: readonly [number, number]): number {
  return Math.abs(heights[1] - heights[0]);
}

export function judgeMarineObservation(
  observation: MarineSceneObservation,
  requirements: MarineSceneRequirements,
): VisualAcceptanceReport {
  const defects: VisualDefect[] = [];
  if (observation.drawingBufferWidth <= 0 || observation.drawingBufferHeight <= 0) {
    defects.push({
      code: 'canvas-empty',
      location: 'canvas.drawingBuffer',
      detail: `${observation.drawingBufferWidth}x${observation.drawingBufferHeight}`,
    });
  } else if (observation.pixelMean < 0.02) {
    defects.push({
      code: 'canvas-blank',
      location: 'canvas.center',
      detail: `center pixel mean ${observation.pixelMean}`,
    });
  }
  const horizontal = observation.farField !== null && farFieldIsHorizontal(observation.farField);
  if (!observation.farField) {
    defects.push({
      code: 'vertical-far-field',
      location: 'far-field.mesh',
      detail: 'comparison far-field mesh is missing',
    });
  } else if (!horizontal) {
    defects.push({
      code: 'vertical-far-field',
      location: 'far-field.position',
      detail: `ySpan ${observation.farField.ySpan} zSpan ${observation.farField.zSpan}`,
    });
  }
  const reflectionAttached = observation.planarReflectionStrength !== null && observation.planarReflectionStrength > 0;
  const reflectionVisible = observation.reflectionPixelMean !== null && observation.reflectionPixelMean >= 0.02;
  if (requirements.reflectionRequired && (!reflectionAttached || !reflectionVisible)) {
    defects.push({
      code: 'reflection-missing',
      location: 'scene.marinePlanarReflection.pixels',
      detail: reflectionAttached
        ? `reflection target mean ${observation.reflectionPixelMean}`
        : 'planar reflection is not attached to the running scene',
    });
  }
  if (requirements.foamRequired && !observation.foamFieldPresent) {
    defects.push({
      code: 'foam-disabled',
      location: 'scene.marineFoamField',
      detail: 'foam field is not attached to the running scene',
    });
  }
  const motion = waveMotion(observation.waveHeights);
  if (!(motion > 1e-4)) {
    defects.push({
      code: 'frozen-surface',
      location: 'water.sampler',
      detail: `heights ${observation.waveHeights[0]} and ${observation.waveHeights[1]}`,
    });
  }
  if (motion > 1e-4 && observation.normalSlope <= 1e-6) {
    defects.push({
      code: 'normal-disabled',
      location: 'water.normalSlope',
      detail: 'the moving surface has no measurable slope',
    });
  }
  if (
    observation.reportedPitch !== null
    && observation.contactPitch !== null
    && Math.abs(observation.reportedPitch - observation.contactPitch) > 1e-3
  ) {
    defects.push({
      code: 'waterline-pitch',
      location: 'vessel.waterline',
      detail: `reported ${observation.reportedPitch} contact ${observation.contactPitch}`,
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
      waveMotion: motion,
      normalSlope: observation.normalSlope,
      pixelMean: observation.pixelMean,
      planarReflectionStrength: observation.planarReflectionStrength,
      fleetCount: 0,
    },
    images: [{
      id: 'canvas-center',
      width: observation.drawingBufferWidth,
      height: observation.drawingBufferHeight,
      mean: observation.pixelMean,
    }],
  };
}

export function judgeFleetObservations(
  observations: readonly FleetConsumerObservation[],
): VisualAcceptanceReport {
  const defects: VisualDefect[] = [];
  const seen = new Set(observations.map((item) => item.consumerId));
  for (const consumerId of FLEET_CONSUMER_IDS) {
    if (!seen.has(consumerId)) {
      defects.push({
        code: 'fleet-gap',
        location: `fleet.${consumerId}`,
        detail: 'active consumer did not report a drawing buffer',
      });
    }
  }
  for (const observation of observations) {
    if (observation.drawingBufferWidth <= 0 || observation.drawingBufferHeight <= 0) {
      defects.push({
        code: 'canvas-empty',
        location: `fleet.${observation.consumerId}.canvas`,
        detail: `${observation.drawingBufferWidth}x${observation.drawingBufferHeight}`,
      });
    }
    if (observation.pixelMean < 0.02) {
      defects.push({
        code: 'canvas-blank',
        location: `fleet.${observation.consumerId}.canvas`,
        detail: `center pixel mean ${observation.pixelMean}`,
      });
    }
    if (!(observation.shipRadius > 1) || observation.shipX === null || observation.shipYaw === null) {
      defects.push({
        code: 'fleet-gap',
        location: `fleet.${observation.consumerId}.hull`,
        detail: 'ship mesh transform was not measured',
      });
    }
    if (!(observation.shipDelta > 1e-4)) {
      defects.push({
        code: 'frozen-surface',
        location: `fleet.${observation.consumerId}.hull`,
        detail: `ship transform delta ${observation.shipDelta}`,
      });
    }
    if (!(observation.waveDelta > 0)) {
      defects.push({
        code: 'frozen-surface',
        location: `fleet.${observation.consumerId}.uTime`,
        detail: 'water time did not advance',
      });
    }
    if (observation.consumerId === 'cruise') {
      if (observation.telemetryRoll === null || observation.resolvedRoll === null) {
        defects.push({
          code: 'fleet-gap',
          location: 'fleet.cruise.roll',
          detail: 'cruise telemetry roll was not measured',
        });
      } else if (Math.abs(observation.resolvedRoll - observation.telemetryRoll) > 1e-3) {
        defects.push({
          code: 'fleet-gap',
          location: 'fleet.cruise.roll',
          detail: 'resolved roll left the telemetry value',
        });
      }
    }
  }
  return {
    passed: defects.length === 0 && observations.length >= FLEET_CONSUMER_IDS.length,
    defects,
    beautyScore: null,
    goldenRewritten: false,
    crossAlgorithmPixelScore: null,
    stillnessRewarded: false,
    metrics: {
      farFieldHorizontal: false,
      waveMotion: 0,
      normalSlope: 0,
      pixelMean: 0,
      planarReflectionStrength: null,
      fleetCount: observations.length,
    },
    images: [],
  };
}

export function commitGoldenUpdate(
  options: { readonly updateGolden: boolean; readonly reviewed: boolean },
): { readonly goldenRewritten: boolean } {
  if (!options.updateGolden) return { goldenRewritten: false };
  if (!options.reviewed) throw new Error('golden update requires an explicit review');
  return { goldenRewritten: true };
}
