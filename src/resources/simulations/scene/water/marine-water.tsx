'use client';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useSceneEnvironment } from '../environment/environment-state';
import { MarinePlanarReflection } from '../environment/planar-reflection';
import { SharedOceanSurface, ShallowBackdrop, type ComparisonOceanProbe, type SharedOceanConfig } from './shared-ocean-surface';
import type { GerstnerWaterProps } from './gerstner-water';
import { createMarineSurfaceSampling } from './marine-surface-sampling';
import type { SurfaceHistoryPose, MarineFoamEmitter } from './comparison-surface-history';
import { MARINE_FOAM_PROFILES, type MarineFoamVessel } from './marine-foam-profile';

export function MarineWater(props: GerstnerWaterProps & { foamVessel: MarineFoamVessel; vesselLengthMeters?: number; vesselBeamMeters?: number; worldSpeedSampler: () => number; advancingSampler?: () => boolean; foamEmittersSampler?: () => readonly MarineFoamEmitter[] }) {
  const { preset, wakeVisible } = useSceneEnvironment();
  const scene = useThree(state => state.scene);
  const latest = useRef(props); latest.current = props;
  const hasFoamEmitters = Boolean(props.foamEmittersSampler);
  const surface = useRef<ComparisonOceanProbe | null>(null);
  const sampling = useMemo(() => createMarineSurfaceSampling(), []);
  const timing = useRef({ start: NaN, time: 0, previousTime: 0,
    previous: { x: 0, z: 0, headingRad: 0, speedMps: 0 } as SurfaceHistoryPose,
    current: { x: 0, z: 0, headingRad: 0, speedMps: 0 } as SurfaceHistoryPose });
  const config = useMemo<SharedOceanConfig>(() => ({
    foamEmitters: hasFoamEmitters ? pose => {
      const current = timing.current.current;
      const delta = pose.headingRad - current.headingRad;
      return (latest.current.foamEmittersSampler?.() ?? []).map(source => {
        const x = source.x - current.x, z = source.z - current.z;
        return { ...source, x: pose.x + x * Math.cos(delta) + z * Math.sin(delta),
          z: pose.z - x * Math.sin(delta) + z * Math.cos(delta), headingRad: source.headingRad + delta };
      });
    } : undefined,
    production: true, hullExclusions: latest.current.hullExclusionSampler?.() ?? undefined, sedimentPlume: props.sedimentPlume,
    spectrum: { domainMeters: 2048, windSpeedMps: 12, windDirectionRad: 0.2, seaState: props.seaState ?? 4, seed: 17 },
    skyTexture: preset.skyTexture, colors: preset.water,
    sunDirection: props.sunDirection, sunIllumination: props.sunIllumination,
    shores: props.shoreSegments,
    lengthMeters: props.vesselLengthMeters, beamMeters: props.vesselBeamMeters,
    foamProfile: MARINE_FOAM_PROFILES[props.foamVessel],
    positionSampler: () => latest.current.positionSampler?.() ?? latest.current.shipPosition ?? { x: 0, z: 0 },
    timeSampler: seconds => {
      const state = timing.current;
      const position = latest.current.positionSampler?.() ?? latest.current.shipPosition ?? { x: 0, z: 0 };
      if (!Number.isFinite(state.start)) {
        state.start = seconds;
        state.current = { ...position, headingRad: latest.current.shipHeadingSampler?.() ?? 0, speedMps: 0 };
        state.previous = state.current;
      }
      const time = Math.max(0, seconds - state.start);
      if (time > state.time) {
        state.previous = state.current; state.previousTime = state.time;
        const speed = latest.current.advancingSampler?.() === false ? 0 : latest.current.worldSpeedSampler();
        state.current = { ...position, headingRad: latest.current.shipHeadingSampler?.() ?? 0, speedMps: speed };
        state.time = time;
      }
      return time;
    },
    poseAt: time => {
      const { previous: a, current: b, previousTime, time: end } = timing.current;
      const t = Math.max(0, Math.min(1, (time - previousTime) / Math.max(end - previousTime, 1e-6)));
      const headingDelta = Math.atan2(Math.sin(b.headingRad - a.headingRad), Math.cos(b.headingRad - a.headingRad));
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, headingRad: a.headingRad + headingDelta * t, speedMps: b.speedMps };
    },
  }), [preset, hasFoamEmitters, props.foamVessel, props.sedimentPlume, props.seaState, props.shoreSegments, props.sunDirection, props.sunIllumination, props.vesselLengthMeters, props.vesselBeamMeters]);
  useEffect(() => {
    timing.current.start = NaN; timing.current.time = timing.current.previousTime = 0;
    sampling.reset();
  }, [props.resetToken, config, sampling]);
  useEffect(() => {
    scene.userData.marineSurfaceSampling = sampling;
    return () => {
      if (scene.userData.marineSurfaceSampling === sampling) delete scene.userData.marineSurfaceSampling;
      sampling.reset();
    };
  }, [scene, sampling]);
  useFrame(() => {
    if (!surface.current) return;
    surface.current.setSources(wakeVisible, true);
    const p = config.positionSampler!();
    void sampling.update(surface.current, p.x, p.z).catch(() => {});
  });
  return <>
    <ShallowBackdrop enabled={props.shallowEnabled !== false && !!props.shoreSegments?.length} shores={props.shoreSegments} />
    <MarinePlanarReflection planeY={-1} enabled={props.tier === 'high'} subjectPositionSampler={props.positionSampler} subjectHeadingSampler={props.shipHeadingSampler} />
    <SharedOceanSurface config={config} backend="fft" scene="feature-parity" tier={props.tier ?? 'medium'} resolution={256}
      shallowEnabled={props.shallowEnabled !== false && !!props.shoreSegments?.length} resetToken={props.resetToken ?? 0} surfaceRef={surface} />
  </>;
}
