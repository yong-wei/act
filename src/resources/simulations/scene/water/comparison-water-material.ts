/** 对比页唯一的水面着色定义。两种 API、两种波场共用全部片元光学。 */
import { Color, DataTexture, MeshBasicNodeMaterial, Vector2, Matrix4, type Texture, type Node } from 'three/webgpu';
import {
  Fn, If, float, vec2, vec3, vec4, uniform, texture, positionLocal, positionWorld,
  cameraPosition, varyingProperty, mix, smoothstep, max, abs, normalize,
  dot, cross, reflect, pow, exp, dFdx, dFdy, screenUV, pmremTexture,
} from 'three/tsl';
import type { ComparisonOceanPipeline } from './comparison-ocean-pipeline';
import { MICRO_NORMAL_OCTAVES_BY_TIER, MICRO_COMPENSATED_ROUGHNESS_CAP, LOW_TIER_ROUGHNESS_FLOOR } from './micro-optics';
import { NEAR_FIELD_VISIBLE_WAVES } from './gerstner-water';
import { NEAR_FIELD_FADE_BAND_METERS } from './ocean-bands';
import type { MarineShoreSegment } from '../environment/scene-layouts';
import { getEnvironmentPreset, DEFAULT_ENVIRONMENT_PRESET_ID } from '../environment/environment-presets';
import { COMPARISON_OVERHEAD_WAVE_SHADE, COMPARISON_SUN_DIRECTION } from './shared-water-optics';
import { sampleBilinearHistory } from './comparison-texture-sampling';
import { SURFACE_FOAM_DRIFT, SURFACE_FOAM_RESOLUTION } from './comparison-surface-history';

export function createComparisonWaterMaterial(options: {
  pipeline: ComparisonOceanPipeline | null;
  domain: number;
  wakeResolution: number;
  neutral: boolean;
  tier: 'low' | 'medium' | 'high';
  foamNoise: Texture;
  environment: Texture;
  amplitudeScale: number;
  shore: MarineShoreSegment;
}) {
  const { pipeline, domain, neutral, tier, foamNoise, environment } = options;
  const time = uniform(0);
  const shallowEnabled = uniform(0);
  const planarStrength = uniform(0);
  const planarMatrix = uniform(new Matrix4());
  const placeholder = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  placeholder.needsUpdate = true;
  const shallowTexture = texture(placeholder);
  const planarTexture = texture(placeholder);
  const zeroTexture = new DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
  zeroTexture.needsUpdate = true;
  const wakeTexture = texture(zeroTexture);
  const historyTexture = texture(zeroTexture);
  const historyEnabled = uniform(0);
  const foamDrift = uniform(new Vector2(...SURFACE_FOAM_DRIFT));
  const n = varyingProperty('vec3', 'oceanNormal');
  const height = varyingProperty('float', 'oceanHeight');
  const horizontal = varyingProperty('vec2', 'oceanHorizontal');
  const shoreDistance = (p: Node<'vec2'>) => {
    const start = vec2(...options.shore.from);
    const dx = options.shore.to[0] - options.shore.from[0];
    const dz = options.shore.to[1] - options.shore.from[1];
    const ab = vec2(dx, dz);
    const along = dot(p.sub(start), ab).div(Math.max(dx * dx + dz * dz, 1e-8)).clamp();
    return p.sub(start.add(ab.mul(along))).length();
  };
  const baseDisplace = Fn(([p]: [Node<'vec2'>]) => {
    if (pipeline) {
      const at = p.div(domain).add(0.5 / pipeline.resolution).fract();
      return vec3(
        p.x.add(texture(pipeline.displacementXTexture, at, 0).r),
        texture(pipeline.heightTexture, at, 0).r,
        p.y.add(texture(pipeline.displacementZTexture, at, 0).r),
      );
    }
    const displacement = vec3(0).toVar();
    const envelope = float(1).sub(smoothstep(domain / 2 - NEAR_FIELD_FADE_BAND_METERS, domain / 2, max(abs(p.x), abs(p.y))));
    const shoreT = shoreDistance(p).div(400).clamp();
    const shore = neutral ? float(1)
      : float(0.15).add(shoreT.mul(shoreT).mul(float(3).sub(shoreT.mul(2))).mul(0.85));
    for (const wave of NEAR_FIELD_VISIBLE_WAVES) {
      const direction = new Vector2(...wave.direction).normalize();
      const k = 2 * Math.PI / wave.wavelength;
      const angle = dot(p, vec2(direction.x, direction.y)).mul(k)
        .sub(time.mul(wave.speed * Math.sqrt(9.8 / k) * k));
      const amplitude = wave.amplitude * options.amplitudeScale;
      displacement.addAssign(vec3(
        angle.cos().mul(wave.steepness * amplitude * direction.x),
        angle.sin().mul(amplitude),
        angle.cos().mul(wave.steepness * amplitude * direction.y),
      ));
    }
    return vec3(p.x, 0, p.y).add(displacement.mul(envelope).mul(shore));
  });
  const displace = Fn(([p]: [Node<'vec2'>]) => {
    const base = baseDisplace(p);
    // 船行波采样在世界空间，跟随船的只有压力源，不旋转旧波场。
    const wake = wakeTexture.sample(p.div(domain).add(0.5 / options.wakeResolution).fract()).r;
    return base.add(vec3(0, wake, 0));
  });
  const material = new MeshBasicNodeMaterial();
  material.positionNode = Fn(() => {
    const p = positionLocal.xz;
    const cell = pipeline ? domain / pipeline.resolution : 0.5;
    const center = displace(p).toVar();
    const right = displace(p.add(vec2(cell, 0))).toVar();
    const front = displace(p.add(vec2(0, cell))).toVar();
    const left = displace(p.sub(vec2(cell, 0))).toVar();
    const back = displace(p.sub(vec2(0, cell))).toVar();
    // 中心差分与当前顶点对齐，避免单边差分把反光偏移半个网格。
    const normal = normalize(cross(front.sub(back), right.sub(left)));
    n.assign(normal.y.lessThan(0).select(normal.negate(), normal));
    height.assign(center.y);
    horizontal.assign(center.xz.sub(p));
    return center;
  })();
  const colors = getEnvironmentPreset(DEFAULT_ENVIRONMENT_PRESET_ID).water;
  const colorNode = (value: string) => {
    const color = new Color(value);
    return vec3(color.r, color.g, color.b);
  };
  const waterColor = colorNode(colors.waterColor);
  const deepColor = colorNode(colors.deepColor);
  const horizonColor = colorNode(colors.horizonColor);
  const sun = vec3(COMPARISON_SUN_DIRECTION);
  const noise = texture(foamNoise);
  const waterColorNode = Fn(() => {
    if (neutral) {
      const ndl = dot(normalize(n), normalize(vec3(0.35, 1, 0.25))).clamp(0.4, 1);
      const shade = height.mul(0.09).add(0.58).clamp(0.32, 0.95);
      const color = mix(vec3(0.05, 0.20, 0.32), vec3(0.18, 0.48, 0.62), shade).mul(ndl);
      const fog = positionWorld.xz.sub(cameraPosition.xz).length().div(9000).clamp().mul(0.6);
      return mix(color, vec3(0.58, 0.66, 0.72), fog);
    }
    const view = normalize(cameraPosition.sub(positionWorld));
    const normal = normalize(n).toVar();
    const stepX = dFdx(positionWorld.xz);
    const stepY = dFdy(positionWorld.xz);
    const slopes = vec2(0).toVar();
    const retained = float(0).toVar();
    let energy = 0;
    for (const octave of MICRO_NORMAL_OCTAVES_BY_TIER[tier]) {
      const direction = vec2(...octave.direction);
      const footprint = max(abs(dot(stepX, direction)), abs(dot(stepY, direction))).max(1e-4);
      const weight = smoothstep(1.15, 2.6, float(2 * Math.PI / octave.waveNumber).div(footprint));
      const variance = (octave.slopeAmplitude * octave.waveNumber) ** 2;
      energy += variance;
      retained.addAssign(weight.mul(weight).mul(variance));
      const phase = dot(positionWorld.xz, direction).mul(octave.waveNumber)
        .sub(time.mul(octave.waveNumber * octave.speedScale * 1.2)).add(octave.phaseOffset);
      slopes.addAssign(direction.mul(phase.cos()).mul(weight).mul(octave.slopeAmplitude * octave.waveNumber * 0.4));
    }
    normal.assign(normalize(normal.add(vec3(slopes.x, 0, slopes.y))));
    const lost = energy > 0 ? float(1).sub(retained.div(energy)).clamp() : float(0);
    const light = dot(normal, sun).max(0);
    const shallowMix = float(0).toVar();
    const absorption = float(1).toVar();
    const offset = vec2(0).toVar();
    If(shallowEnabled.greaterThan(0.5), () => {
      const t = shoreDistance(positionWorld.xz).div(pipeline ? 500 : 400).clamp();
      shallowMix.assign(float(1).sub(smoothstep(0, 1, t))
        .mul(Math.min(1, Math.max(0.05, (20 - options.shore.shoreDepthMeters) / 16))));
      absorption.assign(exp(mix(options.shore.shoreDepthMeters * 0.15, options.shore.shoreDepthMeters, t).max(0.2).mul(-0.55)));
      offset.assign(view.xz.mul(float(1).sub(absorption)).mul(0.35).mul(shallowMix));
    });
    const carried = positionWorld.xz.add(offset).sub(foamDrift.mul(time)).sub(horizontal);
    const detail = noise.sample(carried.div(pipeline ? 5 : 23)).a.mul(0.4)
      .add(noise.sample(carried.div(pipeline ? 13 : 71).add(vec2(0.37, 0.13))).a.mul(0.35))
      .add(noise.sample(carried.div(pipeline ? 37 : 149).add(vec2(0.71, 0.53))).a.mul(0.25));
    const coverage = float(0).toVar();
    const history = sampleBilinearHistory(historyTexture, positionWorld.xz.div(domain).add(0.5), SURFACE_FOAM_RESOLUTION);
    If(historyEnabled.greaterThan(0.5), () => {
      // 新生白沫较密，残留泡沫逐渐破碎为斑驳薄层；位置来自输运场。
      coverage.assign(max(float(0),
        history.r.mul(smoothstep(0.18, 0.65, detail).mul(0.65).add(0.35)).add(history.g.mul(0.4)).clamp()));
    });
    const nv = dot(normal, view).max(1e-4);
    const nl = dot(normal, sun).max(0);
    const half = normalize(sun.add(view));
    const nh = dot(normal, half).max(0);
    const roughness = max(
      max(tier === 'low' ? LOW_TIER_ROUGHNESS_FLOOR : 0.06, mix(0.06, 0.6, coverage)),
      mix(0.06, MICRO_COMPENSATED_ROUGHNESS_CAP, lost));
    const a = roughness.mul(roughness).max(1e-4);
    const a2 = a.mul(a);
    const denominator = nh.mul(nh).mul(a2.sub(1)).add(1);
    const distribution = a2.div(denominator.mul(denominator).mul(Math.PI));
    const fresnel = float(0.02).add(pow(float(1).sub(dot(view, half).max(0)), 5).mul(0.98));
    const k = a.div(2);
    const gV = nv.div(nv.mul(float(1).sub(k)).add(k));
    const gL = nl.max(1e-4).div(nl.max(1e-4).mul(float(1).sub(k)).add(k));
    const specular = distribution.mul(fresnel).mul(gV).mul(gL).div(nv.mul(nl.max(1e-4)).mul(4).max(1e-4)).mul(nl);
    const viewFresnel = float(0.02).add(pow(float(1).sub(nv), 5).mul(0.98));
    const color = mix(deepColor, waterColor, light.mul(0.65).add(0.35)).toVar();
    If(shallowEnabled.greaterThan(0.5), () => {
      const shift = offset.div(40).clamp(-0.02, 0.02);
      const center = shallowTexture.sample(screenUV);
      const shifted = shallowTexture.sample(screenUV.add(shift));
      const picked = abs(shifted.a.sub(center.a)).greaterThan(0.2).select(center, shifted);
      const tint = picked.rgb.div(max(picked.r, max(picked.g, picked.b)).max(1e-3));
      const transmission = exp(picked.a.mul(30).max(0.2).mul(-0.55));
      const shallowColor = mix(mix(vec3(0.28, 0.52, 0.5), color, absorption), color.mul(tint), transmission);
      color.assign(mix(color, shallowColor, shallowMix));
    });
    const reflected = normalize(mix(reflect(view.negate(), normal), normal, pow(roughness, 4)));
    const reflection = pmremTexture(environment, reflected, roughness).rgb.toVar();
    If(planarStrength.greaterThan(0.001), () => {
      const mirrored = vec3(positionWorld.x, float(-2).sub(positionWorld.y), positionWorld.z);
      const projected = planarMatrix.mul(vec4(mirrored, 1));
      const planarUv = projected.xy.div(projected.w);
      const planarColor = planarTexture.sample(vec2(planarUv.x, float(1).sub(planarUv.y))).rgb;
      const fade = float(1).sub(smoothstep(120, 900, positionWorld.xz.sub(cameraPosition.xz).length()));
      reflection.assign(mix(reflection, planarColor, planarStrength.mul(fade).mul(viewFresnel)));
    });
    color.assign(mix(color, mix(horizonColor, reflection, 1), viewFresnel.mul(0.45)).add(specular));
    const foamLit = colorNode('#d7e4ea').mul(light.mul(0.65).add(0.35));
    color.assign(mix(color, foamLit, coverage.mul(0.85)));
    const overhead = smoothstep(0.04, 0.42, view.y.max(0));
    return color.mul(float(1).add(overhead.mul(height.mul(COMPARISON_OVERHEAD_WAVE_SHADE).clamp(-0.42, 0.42))));
  })();
  // 已在上面计算完整光学，不能再走 BasicMaterial 的环境乘色。
  material.fragmentNode = vec4(waterColorNode, 1);
  return {
    material, time, displace, wakeTexture, historyTexture, historyEnabled, shallowEnabled, shallowTexture, planarTexture, planarStrength, planarMatrix,
    emptyTexture: placeholder,
    createSurfaceProbeMaterial() {
      const probe = material.clone();
      probe.fragmentNode = vec4(positionWorld.y, n.x.negate().div(n.y.max(1e-4)), n.z.negate().div(n.y.max(1e-4)), 1);
      probe.toneMapped = false;
      return probe;
    },
    dispose() { material.dispose(); placeholder.dispose(); zeroTexture.dispose(); },
  };
}
