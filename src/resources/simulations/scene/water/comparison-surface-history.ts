import { marineBackendName } from '../marine-backend';
/** 世界空间的局部船行波与两层泡沫历史，两种 API 共用 GPU 节点。 */
import { FloatType, RGBAFormat, NearestFilter, RenderTarget, MeshBasicNodeMaterial, QuadMesh, Vector2, Vector4, type WebGPURenderer, type Node } from 'three/webgpu';
import { Fn, uv, uniform, texture, vec2, vec4, float, dot, exp, smoothstep, max, abs, mix } from 'three/tsl';
import { SimulationClock } from '@/lib/simulation/clock';
import { SIMULATION_FIXED_STEP_SECONDS, SIMULATION_MAX_SUB_STEPS } from '../../lib/simulation-timing';
import { sampleBilinearHistory } from './comparison-texture-sampling';
import { FOAM_HALF_LIFE_SECONDS } from './foam-history';
import { createOceanGpuTransform } from './ocean-gpu-transform';
import { SHIP_WAVE_DOMAIN_METERS, SHIP_WAVE_RESOLUTION, SHIP_WAVE_MIN_WAVELENGTH_METERS, SHIP_PRESSURE_SPEED_HEAD_SCALE, shipPressureShape } from './ship-wave-config';
import type { ComparisonOceanPipeline } from './comparison-ocean-pipeline';
import type { createComparisonWaterMaterial } from './comparison-water-material';

export interface MarineFoamEmitter { id?: string; x: number; z: number; headingRad: number; activity: number; diameterMeters?: number; depthMeters?: number; estimated?: boolean; }
export interface SurfaceHistoryPose { x: number; z: number; headingRad: number; speedMps: number; }
export const SURFACE_FOAM_RESOLUTION = 512;
export const SURFACE_FOAM_DRIFT = [0.65, 0.22] as const;
const FOAM_STEP_STRIDE = 4;
const FOAM_DT = SIMULATION_FIXED_STEP_SECONDS * FOAM_STEP_STRIDE;

export function createComparisonSurfaceHistory(
  renderer: WebGPURenderer, background: ComparisonOceanPipeline,
  water: ReturnType<typeof createComparisonWaterMaterial>, domain: number,
  poseAt: (time: number) => SurfaceHistoryPose, updateBase: (time: number) => void,
  options: { followFoam?: boolean; lengthMeters?: number; beamMeters?: number; foamEmitters?: (pose: SurfaceHistoryPose) => readonly MarineFoamEmitter[] } = {},
) {
  const n = SHIP_WAVE_RESOLUTION, localDomain = SHIP_WAVE_DOMAIN_METERS, cell = localDomain / n;
  const shape = shipPressureShape(options.lengthMeters ?? 180, options.beamMeters ?? 20);
  const transform = createOceanGpuTransform(renderer, n);
  const { foamOrigin, wakeOrigin, washOrigin } = water;
  const previousFoamOrigin = uniform(new Vector2()), shift = uniform(new Vector2());
  const foamN = SURFACE_FOAM_RESOLUTION;
  const target = (size: number) => new RenderTarget(size, size, {
    type: FloatType, format: RGBAFormat, minFilter: NearestFilter, magFilter: NearestFilter, depthBuffer: false, stencilBuffer: false,
  });
  const spectral = [target(n), target(n)], foam = [target(foamN), target(foamN)], wash = [target(n), target(n)];
  const wake = target(n), absorbed = target(n);
  const waveInput = texture(spectral[0].texture), foamInput = texture(foam[0].texture), washInput = texture(wash[0].texture);
  const boat = uniform(new Vector4()), vesselSource = uniform(1), naturalSource = uniform(1), pulse = uniform(new Vector4(0, 0, 8, 0));
  const emitters = Array.from({ length: 8 }, () => ({ pose: uniform(new Vector4()), geometry: uniform(new Vector2(3, 2)) }));
  const material = (node: Node<'vec4'>) => {
    const mat = new MeshBasicNodeMaterial(); mat.fragmentNode = node;
    mat.depthTest = mat.depthWrite = mat.toneMapped = false; return mat;
  };
  const clear = material(vec4(0)), dt = SIMULATION_FIXED_STEP_SECONDS;
  const waveStep = material(Fn(() => {
    const index = uv().mul(n).floor();
    const k = vec2(index.x.lessThan(n / 2).select(index.x, index.x.sub(n)),
      index.y.lessThan(n / 2).select(index.y, index.y.sub(n))).mul(2 * Math.PI / localDomain);
    const km = k.length(), omega2 = km.mul(9.81).max(1e-8), omega = omega2.sqrt();
    const forward = vec2(boat.z.sin(), boat.z.cos());
    const along = dot(k, forward), across = dot(k, vec2(forward.y, forward.x.negate()));
    const gaussian = exp(along.mul(shape.lengthSigma).pow(2).add(across.mul(shape.beamSigma).pow(2)).mul(-0.5));
    const area = 2 * Math.PI * shape.lengthSigma * shape.beamSigma * n * n / (localDomain * localDomain);
    // 动压随 U² 连续变化。艏、艉分离产生干涉；不使用固定角度的 V 形纹理。
    const head = boat.w.pow(2).mul(SHIP_PRESSURE_SPEED_HEAD_SCALE / (2 * 9.81)).min(1.5);
    const force = km.mul(-9.81 * area).mul(head).mul(gaussian).mul(vesselSource);
    const phase = dot(k, boat.xy.sub(wakeOrigin).add(localDomain / 2)).negate();
    const bowPhase = phase.sub(along.mul(shape.bowOffset)), sternPhase = phase.sub(along.mul(shape.sternOffset));
    const forcing = vec2(bowPhase.cos(), bowPhase.sin()).mul(0.9)
      .add(vec2(sternPhase.cos(), sternPhase.sin()).mul(0.65)).mul(force);
    const state = waveInput.sample(uv());
    const translation = dot(k, shift);
    const rotate = (v: Node<'vec2'>) => vec2(v.x.mul(translation.cos()).sub(v.y.mul(translation.sin())),
      v.x.mul(translation.sin()).add(v.y.mul(translation.cos())));
    const h0 = rotate(state.xy), v0 = rotate(state.zw);
    const c = omega.mul(dt).cos(), s = omega.mul(dt).sin();
    const damping = exp(km.pow(2).mul(0.04).add(0.012).mul(-dt));
    const h = h0.mul(c).add(v0.mul(s.div(omega))).add(forcing.mul(float(1).sub(c).div(omega2)));
    const v = v0.mul(c).sub(h0.mul(omega.mul(s))).add(forcing.mul(s.div(omega)));
    const band = km.greaterThan(0).and(km.lessThanEqual(2 * Math.PI / SHIP_WAVE_MIN_WAVELENGTH_METERS));
    return band.select(vec4(h, v).mul(damping), vec4(0));
  })());
  // 每个模拟秒吸收边缘的 h 和 v；正向变换回频域，不读回 CPU，也不只裁掉可见波浪。
  const absorb = material(texture(wake.texture).sample(uv()).mul(exp(smoothstep(256, localDomain / 2,
    max(abs(uv().x.sub(0.5)), abs(uv().y.sub(0.5))).mul(localDomain)).mul(-6))));
  const advect = (input: ReturnType<typeof texture>, at: Node<'vec2'>, size: number, fieldCell: number, diffusivity: number) => {
    const bilinear = (p: Node<'vec2'>) => sampleBilinearHistory(input, p, size);
    const history = bilinear(at), unit = 1 / size;
    const average = bilinear(at.add(vec2(unit, 0))).add(bilinear(at.sub(vec2(unit, 0))))
      .add(bilinear(at.add(vec2(0, unit)))).add(bilinear(at.sub(vec2(0, unit)))).mul(0.25);
    return mix(history, average, 4 * diffusivity * FOAM_DT / (fieldCell * fieldCell));
  };
  const foamStep = material(Fn(() => {
    const local = uv().sub(0.5).mul(domain), p = local.add(foamOrigin);
    const previousUV = uv().add(foamOrigin.sub(previousFoamOrigin).div(domain)).sub(vec2(...SURFACE_FOAM_DRIFT).mul(FOAM_DT / domain));
    const mixed = advect(foamInput, previousUV, foamN, domain / foamN, 0.9);
    const step = domain / background.resolution;
    const dx = water.backgroundDisplace(p.add(vec2(step, 0))).sub(water.backgroundDisplace(p.sub(vec2(step, 0)))).div(2 * step);
    const dz = water.backgroundDisplace(p.add(vec2(0, step))).sub(water.backgroundDisplace(p.sub(vec2(0, step)))).div(2 * step);
    const compression = float(1).sub(dx.x.mul(dz.z).sub(dx.z.mul(dz.x)));
    const breaking = max(smoothstep(0.07, 0.19, compression), smoothstep(0.13, 0.32, vec2(dx.y, dz.y).length())).mul(naturalSource);
    const source = breaking.mul(0.75).add(exp(p.sub(pulse.xy).length().div(pulse.z).pow(2).mul(-0.5)).mul(pulse.w));
    const retained = mixed.r.mul(Math.exp(-Math.LN2 * FOAM_DT / FOAM_HALF_LIFE_SECONDS));
    const density = float(1).sub(float(1).sub(retained).mul(exp(source.mul(-FOAM_DT))));
    const fresh = max(mixed.g.mul(Math.exp(-Math.LN2 * FOAM_DT / 1.8)), float(1).sub(exp(source.mul(-FOAM_DT * 2))));
    const edge = float(1).sub(smoothstep(domain / 2 - 80, domain / 2, max(abs(local.x), abs(local.y))));
    return vec4(density, fresh, 0, 0).mul(edge);
  })());
  const washStep = material(Fn(() => {
    const local = uv().sub(0.5).mul(localDomain), p = local.add(wakeOrigin);
    const drift = vec2(...SURFACE_FOAM_DRIFT).toVar(), source = float(0).toVar();
    for (const emitter of emitters) {
      const direction = vec2(emitter.pose.z.sin(), emitter.pose.z.cos());
      const relative = p.sub(emitter.pose.xy), diameter = emitter.geometry.x;
      const behind = dot(relative, direction).negate();
      const across = dot(relative, vec2(direction.y, direction.x.negate()));
      const width = diameter.mul(0.55).add(behind.max(0).mul(0.09));
      const plume = exp(behind.sub(diameter.mul(2)).div(diameter.mul(5)).pow(2)
        .add(across.div(width).pow(2)).mul(-0.5)).mul(smoothstep(diameter.negate(), 0, behind));
      const wet = emitter.geometry.y.add(diameter.mul(0.5)).div(diameter).clamp();
      // 深桨的表面可见性是混合/上涌的显示估计，不能把 981 的深水洗流压成全零。
      const surface = float(1).add(emitter.geometry.y.max(0).div(diameter)).pow(-1.5).mul(wet);
      const strength = plume.mul(emitter.pose.w).mul(surface).mul(vesselSource);
      source.addAssign(strength.mul(0.85)); drift.subAssign(direction.mul(strength).mul(3.5));
    }
    const previousUV = uv().add(wakeOrigin.sub(washOrigin).div(localDomain)).sub(drift.mul(FOAM_DT / localDomain));
    const mixed = advect(washInput, previousUV, n, cell, 1.5);
    const wx = water.wakeHeight(p.add(vec2(2, 0))).sub(water.wakeHeight(p.sub(vec2(2, 0)))).div(4);
    const wz = water.wakeHeight(p.add(vec2(0, 2))).sub(water.wakeHeight(p.sub(vec2(0, 2)))).div(4);
    const dx = water.displace(p.add(vec2(2, 0))).sub(water.displace(p.sub(vec2(2, 0)))).div(4);
    const dz = water.displace(p.add(vec2(0, 2))).sub(water.displace(p.sub(vec2(0, 2)))).div(4);
    const breaking = smoothstep(0.035, 0.16, vec2(wx, wz).length())
      .mul(smoothstep(0.14, 0.30, vec2(dx.y, dz.y).length())).mul(vesselSource).mul(0.65);
    const density = float(1).sub(float(1).sub(mixed.r.mul(Math.exp(-Math.LN2 * FOAM_DT / 8))).mul(exp(source.mul(-FOAM_DT))));
    const fresh = float(1).sub(float(1).sub(mixed.g.mul(Math.exp(-Math.LN2 * FOAM_DT / 1.2))).mul(exp(source.mul(-FOAM_DT * 2))));
    const crest = float(1).sub(float(1).sub(mixed.b.mul(Math.exp(-Math.LN2 * FOAM_DT / 12))).mul(exp(breaking.mul(-FOAM_DT))));
    const crestFresh = float(1).sub(float(1).sub(mixed.a.mul(Math.exp(-Math.LN2 * FOAM_DT / 1.6))).mul(exp(breaking.mul(-FOAM_DT * 2))));
    const edge = float(1).sub(smoothstep(localDomain / 2 - 40, localDomain / 2, max(abs(local.x), abs(local.y))));
    return vec4(density, fresh, crest, crestFresh).mul(edge);
  })());
  const quad = new QuadMesh(clear);
  const draw = (mat: MeshBasicNodeMaterial, dest: RenderTarget) => { quad.material = mat; renderer.setRenderTarget(dest); quad.render(renderer); };
  const clock = new SimulationClock({ dt, maxSubSteps: SIMULATION_MAX_SUB_STEPS });
  let steps = 0, requested = 0, waveIndex = 0, foamIndex = 0, washIndex = 0, resolvedWaveStep = 0;
  let disposed = false, reads = 0, waveStarted = false, washStarted = false, wavePasses = 0;
  let lastEmitters: readonly MarineFoamEmitter[] = [];
  const resolveWake = () => {
    if (!waveStarted || resolvedWaveStep === steps) return;
    transform.run(spectral[waveIndex], wake); resolvedWaveStep = steps;
  };
  const reset = () => {
    const previous = renderer.getRenderTarget();
    try { for (const dest of [...spectral, ...foam, ...wash, wake, absorbed]) draw(clear, dest); }
    finally { renderer.setRenderTarget(previous); }
    foamOrigin.value.set(0, 0); previousFoamOrigin.value.set(0, 0); wakeOrigin.value.set(0, 0); washOrigin.value.set(0, 0); shift.value.set(0, 0);
    steps = 0; requested = 0; resolvedWaveStep = 0; waveIndex = foamIndex = washIndex = 0; clock.reset();
    waveStarted = washStarted = false; wavePasses = 0; lastEmitters = [];
    water.wakeTexture.value = wake.texture; water.historyTexture.value = foam[0].texture; water.washTexture.value = wash[0].texture;
  };
  reset();
  return {
    stats: () => ({ time: steps * dt, requested, steps, readbacks: reads, foamOrigin: [foamOrigin.value.x, foamOrigin.value.y],
      wakeOrigin: [wakeOrigin.value.x, wakeOrigin.value.y], waveResolution: n, waveDomainMeters: localDomain, wavePasses,
      vesselSource: vesselSource.value > 0, naturalSource: naturalSource.value > 0 }),
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
          if (Math.max(Math.abs(pose.x - wakeOrigin.value.x), Math.abs(pose.z - wakeOrigin.value.y)) > 48) {
            const old = wakeOrigin.value.clone();
            wakeOrigin.value.set(Math.round(pose.x / 48) * 48, Math.round(pose.z / 48) * 48);
            shift.value.copy(wakeOrigin.value).sub(old);
          } else shift.value.set(0, 0);
          lastEmitters = options.foamEmitters?.(pose) ?? [];
          emitters.forEach((emitter, index) => {
            const source = lastEmitters[index];
            emitter.pose.value.set(source?.x ?? 0, source?.z ?? 0, source?.headingRad ?? 0, source?.activity ?? 0);
            emitter.geometry.value.set(source?.diameterMeters ?? 3, source?.depthMeters ?? 2);
          });
          waveStarted ||= vesselSource.value > 0 && Math.abs(pose.speedMps) > 0.01;
          washStarted ||= vesselSource.value > 0 && lastEmitters.some(source => source.activity > 0);
          if (waveStarted) {
            waveInput.value = spectral[waveIndex].texture; waveIndex = 1 - waveIndex;
            draw(waveStep, spectral[waveIndex]); wavePasses += 1;
          }
          steps += 1;
          if (waveStarted && steps % 60 === 0) {
            resolveWake(); draw(absorb, absorbed); transform.run(absorbed, spectral[waveIndex], false); resolvedWaveStep = 0;
          }
          if (steps % FOAM_STEP_STRIDE === 0) {
            resolveWake(); updateBase(steps * dt); water.time.value = steps * dt;
            previousFoamOrigin.value.copy(foamOrigin.value);
            if (options.followFoam && Math.max(Math.abs(pose.x - foamOrigin.value.x), Math.abs(pose.z - foamOrigin.value.y)) > domain / 4) {
              const foamCell = domain / foamN;
              foamOrigin.value.set(Math.round(pose.x / foamCell) * foamCell, Math.round(pose.z / foamCell) * foamCell);
            }
            foamInput.value = foam[foamIndex].texture; foamIndex = 1 - foamIndex; draw(foamStep, foam[foamIndex]);
            water.historyTexture.value = foam[foamIndex].texture; pulse.value.w = 0;
            if (washStarted || waveStarted) {
              washInput.value = wash[washIndex].texture; washIndex = 1 - washIndex; draw(washStep, wash[washIndex]);
              water.washTexture.value = wash[washIndex].texture;
              washOrigin.value.copy(wakeOrigin.value);
            }
          }
        });
        resolveWake(); water.historyEnabled.value = 1;
      } finally { renderer.setRenderTarget(previous); }
    },
    reset,
    async readDiagnostics() {
      reads += 1;
      const [w, f, local] = await Promise.all([
        renderer.readRenderTargetPixelsAsync(wake, 0, 0, n, n),
        renderer.readRenderTargetPixelsAsync(foam[foamIndex], 0, 0, foamN, foamN),
        renderer.readRenderTargetPixelsAsync(wash[washIndex], 0, 0, n, n),
      ]);
      const flip = marineBackendName(renderer.backend) === 'WebGLBackend';
      let minHeight = Infinity, maxHeight = -Infinity, energy = 0, mass = 0, cx = 0, cz = 0, variance = 0;
      let naturalFoamArea = 0, washFoamArea = 0, shipBreakingFoamArea = 0;
      for (let i = 0; i < w.length; i += 4) {
        minHeight = Math.min(minHeight, w[i]); maxHeight = Math.max(maxHeight, w[i]); energy += w[i] ** 2;
      }
      const accumulate = (values: ArrayLike<number>, size: number, width: number, origin: Vector2, isLocal: boolean) => {
        const area = (width / size) ** 2;
        for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
          const offset = ((flip ? size - 1 - j : j) * size + i) * 4;
          const primary = values[offset] * area, crest = isLocal ? values[offset + 2] * area : 0;
          if (isLocal) { washFoamArea += primary; shipBreakingFoamArea += crest; } else naturalFoamArea += primary;
          const value = primary + crest, x = ((i + 0.5) / size - 0.5) * width + origin.x, z = ((j + 0.5) / size - 0.5) * width + origin.y;
          mass += value; cx += x * value; cz += z * value; variance += (x * x + z * z) * value;
        }
      };
      accumulate(f, foamN, domain, foamOrigin.value, false); accumulate(local, n, localDomain, washOrigin.value, true);
      cx /= Math.max(mass, 1e-12); cz /= Math.max(mass, 1e-12);
      const modes = [];
      for (const [x, z] of [[1, 2], [3, 5], [8, 4]]) {
        const value = await renderer.readRenderTargetPixelsAsync(spectral[waveIndex], x, flip ? n - 1 - z : z, 1, 1);
        modes.push({ x, z, heightRe: value[0], heightIm: value[1], velocityRe: value[2], velocityIm: value[3] });
      }
      return { time: steps * dt, minHeight, maxHeight, energy: energy / (n * n), foamMass: mass / ((domain / foamN) ** 2),
        foamCentroid: [cx, cz], foamVariance: variance / Math.max(mass, 1e-12) - cx * cx - cz * cz,
        naturalFoamArea, washFoamArea, shipBreakingFoamArea, modes, emitters: lastEmitters };
    },
    dispose() {
      if (disposed) return; disposed = true; transform.dispose();
      for (const dest of [...spectral, ...foam, ...wash, wake, absorbed]) dest.dispose();
      for (const mat of [clear, waveStep, absorb, foamStep, washStep]) mat.dispose();
    },
  };
}
export type ComparisonSurfaceHistory = ReturnType<typeof createComparisonSurfaceHistory>;
