/** 持久船行波与表面泡沫。GPU 状态，两种 API 共用 TSL 和既有 IFFT。 */
import { FloatType, RGBAFormat, NearestFilter, RenderTarget, MeshBasicNodeMaterial, QuadMesh, Vector2, Vector4, type WebGPURenderer, type Node } from 'three/webgpu';
import { Fn, uv, uniform, texture, vec2, vec4, float, dot, exp, smoothstep, max, abs, mix } from 'three/tsl';
import { SimulationClock } from '@/lib/simulation/clock';
import { SIMULATION_FIXED_STEP_SECONDS, SIMULATION_MAX_SUB_STEPS } from '../../lib/simulation-timing';
import { sampleBilinearHistory } from './comparison-texture-sampling';
import { FOAM_HALF_LIFE_SECONDS } from './foam-history';
import type { ComparisonOceanPipeline } from './comparison-ocean-pipeline';
import type { createComparisonWaterMaterial } from './comparison-water-material';

export interface MarineFoamEmitter { x: number; z: number; headingRad: number; activity: number; }
export interface SurfaceHistoryPose { x: number; z: number; headingRad: number; speedMps: number; }
export const SHIP_PRESSURE_HEAD_METERS = 1.2;
export const SHIP_PRESSURE_LENGTH_SIGMA = 36;
export const SHIP_PRESSURE_BEAM_SIGMA = 9;
export const SURFACE_FOAM_RESOLUTION = 512;
export const SURFACE_FOAM_DRIFT = [0.65, 0.22] as const;
const FOAM_STEP_STRIDE = 4;
const FOAM_DT = SIMULATION_FIXED_STEP_SECONDS * FOAM_STEP_STRIDE;

export function createComparisonSurfaceHistory(
  renderer: WebGPURenderer,
  transform: ComparisonOceanPipeline,
  water: ReturnType<typeof createComparisonWaterMaterial>,
  domain: number,
  poseAt: (time: number) => SurfaceHistoryPose,
  updateBase: (time: number) => void,
  options: { followFoam?: boolean; lengthMeters?: number; beamMeters?: number; foamEmitters?: () => readonly MarineFoamEmitter[] } = {},
) {
  const n = transform.resolution;
  const lengthScale = (options.lengthMeters ?? 180) / 180;
  const beamScale = (options.beamMeters ?? 20) / 20;
  const foamOrigin = water.foamOrigin;
  const previousFoamOrigin = uniform(new Vector2());
  const foamN = SURFACE_FOAM_RESOLUTION;
  const target = (size: number) => new RenderTarget(size, size, {
    type: FloatType, format: RGBAFormat, minFilter: NearestFilter, magFilter: NearestFilter,
    depthBuffer: false, stencilBuffer: false,
  });
  const spectral = [target(n), target(n)];
  const foam = [target(foamN), target(foamN)];
  const wake = target(n);
  const waveInput = texture(spectral[0].texture);
  const foamInput = texture(foam[0].texture);
  const boat = uniform(new Vector4());
  const vesselSource = uniform(1);
  const emitters = Array.from({ length: options.foamEmitters ? 8 : 0 }, () => uniform(new Vector4()));
  const naturalSource = uniform(1);
  const pulse = uniform(new Vector4(0, 0, 8, 0));
  const material = (node: Node<'vec4'>) => {
    const mat = new MeshBasicNodeMaterial();
    mat.fragmentNode = node;
    mat.depthTest = mat.depthWrite = mat.toneMapped = false;
    return mat;
  };
  const clear = material(vec4(0));
  const dt = SIMULATION_FIXED_STEP_SECONDS;
  const waveStep = material(Fn(() => {
    const index = uv().mul(n).floor();
    const k = vec2(index.x.lessThan(n / 2).select(index.x, index.x.sub(n)),
      index.y.lessThan(n / 2).select(index.y, index.y.sub(n))).mul(2 * Math.PI / domain);
    const km = k.length();
    const omega2 = km.mul(9.81).max(1e-8);
    const omega = omega2.sqrt();
    const forward = vec2(boat.z.sin(), boat.z.cos());
    const along = dot(k, forward);
    const across = dot(k, vec2(forward.y, forward.x.negate()));
    // Fourier transform of an elliptical Gaussian pressure head, in the IFFT's N² convention.
    const shape = exp(along.mul(SHIP_PRESSURE_LENGTH_SIGMA * lengthScale).pow(2)
      .add(across.mul(SHIP_PRESSURE_BEAM_SIGMA * beamScale).pow(2)).mul(-0.5));
    const area = 2 * Math.PI * SHIP_PRESSURE_LENGTH_SIGMA * SHIP_PRESSURE_BEAM_SIGMA * lengthScale * beamScale * n * n / (domain * domain);
    const force = km.mul(-9.81 * SHIP_PRESSURE_HEAD_METERS * area).mul(shape)
      .mul(vesselSource).mul(smoothstep(0, 4, boat.w));
    const phase = dot(k, boat.xy).negate();
    const forcing = vec2(phase.cos(), phase.sin()).mul(force);
    const state = waveInput.sample(uv());
    const c = omega.mul(dt).cos();
    const s = omega.mul(dt).sin();
    const damping = exp(km.mul(km).mul(0.12).add(0.018).mul(-dt));
    const h = state.xy.mul(c).add(state.zw.mul(s.div(omega)))
      .add(forcing.mul(float(1).sub(c).div(omega2)));
    const v = state.zw.mul(c).sub(state.xy.mul(omega.mul(s))).add(forcing.mul(s.div(omega)));
    // Resolve only wavelengths represented by four geometry cells; DC and Nyquist stay zero.
    const band = km.greaterThan(0).and(km.lessThanEqual(2 * Math.PI / (4 * domain / n)));
    return band.select(vec4(h, v).mul(damping), vec4(0));
  })());
  const foamStep = material(Fn(() => {
    const local = uv().sub(0.5).mul(domain);
    const p = local.add(foamOrigin);
    const drift = vec2(...SURFACE_FOAM_DRIFT);
    const previousUV = uv().add(foamOrigin.sub(previousFoamOrigin).div(domain)).sub(drift.mul(FOAM_DT / domain));
    const bilinear = (at: Node<'vec2'>) => sampleBilinearHistory(foamInput, at, foamN);
    const history = bilinear(previousUV);
    const cellUV = 1 / foamN;
    const average = bilinear(previousUV.add(vec2(cellUV, 0))).add(bilinear(previousUV.sub(vec2(cellUV, 0))))
      .add(bilinear(previousUV.add(vec2(0, cellUV)))).add(bilinear(previousUV.sub(vec2(0, cellUV)))).mul(0.25);
    // 0.9 m²/s turbulent diffusion, explicit positive stencil after advection.
    const mixed = mix(history, average, 4 * 0.9 * FOAM_DT / ((domain / foamN) ** 2));
    const cell = domain / n;
    const right = water.displace(p.add(vec2(cell, 0)));
    const left = water.displace(p.sub(vec2(cell, 0)));
    const front = water.displace(p.add(vec2(0, cell)));
    const back = water.displace(p.sub(vec2(0, cell)));
    const dx = right.sub(left).div(2 * cell);
    const dz = front.sub(back).div(2 * cell);
    const compression = float(1).sub(dx.x.mul(dz.z).sub(dx.z.mul(dz.x)));
    const steepness = vec2(dx.y, dz.y).length();
    const breaking = max(smoothstep(0.07, 0.19, compression), smoothstep(0.13, 0.32, steepness))
      .mul(naturalSource);
    const forward = vec2(boat.z.sin(), boat.z.cos());
    const relative = p.sub(boat.xy);
    const along = dot(relative, forward);
    const across = dot(relative, vec2(forward.y, forward.x.negate()));
    const stern = exp(along.add(78 * lengthScale).div(14 * lengthScale).pow(2).add(across.div(10 * beamScale).pow(2)).mul(-0.5))
      .mul(vesselSource).mul(smoothstep(0, 6, boat.w));
    const pulseShape = exp(p.sub(pulse.xy).length().div(pulse.z).pow(2).mul(-0.5)).mul(pulse.w);
    const source = breaking.mul(0.75).add(stern.mul(1.8)).add(pulseShape).toVar();
    for (const emitter of emitters) {
      const direction = vec2(emitter.z.sin(), emitter.z.cos());
      const offset = p.sub(emitter.xy);
      const along = dot(offset, direction).add(8).div(14);
      const across = dot(offset, vec2(direction.y, direction.x.negate())).div(5);
      source.addAssign(exp(along.pow(2).add(across.pow(2)).mul(-0.5)).mul(emitter.w).mul(vesselSource).mul(2));
    }
    const retained = mixed.r.mul(Math.exp(-Math.LN2 * FOAM_DT / FOAM_HALF_LIFE_SECONDS));
    const density = float(1).sub(float(1).sub(retained).mul(exp(source.mul(-FOAM_DT))));
    const fresh = max(mixed.g.mul(Math.exp(-Math.LN2 * FOAM_DT / 1.8)), float(1).sub(exp(source.mul(-FOAM_DT * 2))));
    const edge = float(1).sub(smoothstep(domain / 2 - 80, domain / 2, max(abs(local.x), abs(local.y))));
    return vec4(density, fresh, 0, 1).mul(edge);
  })());
  const quad = new QuadMesh(clear);
  const draw = (mat: MeshBasicNodeMaterial, dest: RenderTarget) => {
    quad.material = mat; renderer.setRenderTarget(dest); quad.render(renderer);
  };
  const clock = new SimulationClock({ dt, maxSubSteps: SIMULATION_MAX_SUB_STEPS });
  let steps = 0; let requested = 0; let waveIndex = 0; let foamIndex = 0;
  let disposed = false; let reads = 0; let resolvedWaveStep = 0;
  const resolveWake = () => {
    if (resolvedWaveStep === steps) return;
    transform.inverse(spectral[waveIndex], wake);
    resolvedWaveStep = steps;
  };
  const reset = () => {
    const previous = renderer.getRenderTarget();
    try { for (const dest of [...spectral, ...foam, wake]) draw(clear, dest); }
    finally { renderer.setRenderTarget(previous); }
    foamOrigin.value.set(0, 0); previousFoamOrigin.value.set(0, 0);
    steps = 0; requested = 0; resolvedWaveStep = 0; waveIndex = foamIndex = 0; clock.reset();
    water.wakeTexture.value = wake.texture;
    water.historyTexture.value = foam[0].texture;
  };
  reset();
  return {
    stats: () => ({ time: steps * dt, requested, steps, readbacks: reads, foamOrigin: [foamOrigin.value.x, foamOrigin.value.y], vesselSource: vesselSource.value > 0, naturalSource: naturalSource.value > 0 }),
    setSources(vessel: boolean, natural: boolean) { vesselSource.value = Number(vessel); naturalSource.value = Number(natural); },
    injectFoam(x: number, z: number, radius = 16) { pulse.value.set(x, z, radius, 30); },
    advance(seconds: number) {
      if (disposed) return;
      if (seconds < requested - 1e-6) reset();
      const delta = Math.max(0, Math.floor(seconds / dt + 1e-6) - Math.floor(requested / dt + 1e-6)) * dt;
      requested = seconds;
      const previous = renderer.getRenderTarget();
      try {
        clock.advance(delta + (delta > 0 ? 1e-10 : 0), () => {
          const pose = poseAt((steps + 0.5) * dt);
          boat.value.set(pose.x, pose.z, pose.headingRad, pose.speedMps);
          const sources = options.foamEmitters?.() ?? [];
          emitters.forEach((uniform, index) => {
            const source = sources[index];
            uniform.value.set(source?.x ?? 0, source?.z ?? 0, source?.headingRad ?? 0, source?.activity ?? 0);
          });
          waveInput.value = spectral[waveIndex].texture;
          waveIndex = 1 - waveIndex;
          draw(waveStep, spectral[waveIndex]);
          steps += 1;
          if (steps % FOAM_STEP_STRIDE === 0) {
            resolveWake();
            updateBase(steps * dt);
            water.time.value = steps * dt;
            previousFoamOrigin.value.copy(foamOrigin.value);
            if (options.followFoam && Math.max(Math.abs(pose.x - foamOrigin.value.x), Math.abs(pose.z - foamOrigin.value.y)) > domain / 4) {
              const cell = domain / foamN;
              foamOrigin.value.set(Math.round(pose.x / cell) * cell, Math.round(pose.z / cell) * cell);
            }
            foamInput.value = foam[foamIndex].texture;
            foamIndex = 1 - foamIndex;
            draw(foamStep, foam[foamIndex]);
            water.historyTexture.value = foam[foamIndex].texture;
            pulse.value.w = 0;
          }
        });
        resolveWake();
        water.historyEnabled.value = 1;
      } finally { renderer.setRenderTarget(previous); }
    },
    reset,
    async readDiagnostics() {
      reads += 1;
      const [w, f] = await Promise.all([
        renderer.readRenderTargetPixelsAsync(wake, 0, 0, n, n),
        renderer.readRenderTargetPixelsAsync(foam[foamIndex], 0, 0, foamN, foamN),
      ]);
      const flip = renderer.backend.constructor.name === 'WebGLBackend';
      let minHeight = Infinity; let maxHeight = -Infinity; let energy = 0;
      for (let i = 0; i < w.length; i += 4) {
        minHeight = Math.min(minHeight, w[i]); maxHeight = Math.max(maxHeight, w[i]); energy += w[i] ** 2;
      }
      let mass = 0; let cx = 0; let cz = 0; let variance = 0;
      for (let j = 0; j < foamN; j++) for (let i = 0; i < foamN; i++) {
        const value = f[((flip ? foamN - 1 - j : j) * foamN + i) * 4];
        const x = ((i + 0.5) / foamN - 0.5) * domain;
        const z = ((j + 0.5) / foamN - 0.5) * domain;
        mass += value; cx += x * value; cz += z * value; variance += (x * x + z * z) * value;
      }
      cx /= Math.max(mass, 1e-12); cz /= Math.max(mass, 1e-12);
      const modes = [];
      for (const [x, z] of [[1, 2], [3, 5], [8, 4]]) {
        const value = await renderer.readRenderTargetPixelsAsync(spectral[waveIndex], x, flip ? n - 1 - z : z, 1, 1);
        modes.push({ x, z, heightRe: value[0], heightIm: value[1], velocityRe: value[2], velocityIm: value[3] });
      }
      return { time: steps * dt, minHeight, maxHeight, energy: energy / (n * n), foamMass: mass,
        foamCentroid: [cx + foamOrigin.value.x, cz + foamOrigin.value.y], foamVariance: variance / Math.max(mass, 1e-12) - cx * cx - cz * cz, modes };
    },
    dispose() {
      if (disposed) return; disposed = true;
      for (const dest of [...spectral, ...foam, wake]) dest.dispose();
      for (const mat of [clear, waveStep, foamStep]) mat.dispose();
    },
  };
}
export type ComparisonSurfaceHistory = ReturnType<typeof createComparisonSurfaceHistory>;
