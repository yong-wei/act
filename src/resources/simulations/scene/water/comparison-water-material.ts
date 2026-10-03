/** 对比页唯一的水面着色定义。两种 API、两种波场共用全部片元光学。 */
import { Color, DataTexture, MeshBasicNodeMaterial, Vector2, Vector3, Matrix4, type Texture, type Node } from 'three/webgpu';
import {
  Fn, If, Discard, float, vec2, vec3, vec4, uniform, texture, positionLocal, positionWorld,
  cameraPosition, varyingProperty, mix, smoothstep, max, abs, normalize,
  dot, cross, reflect, pow, exp, dFdx, dFdy, screenUV, pmremTexture, mx_noise_float,
} from 'three/tsl';
import type { ComparisonOceanPipeline } from './comparison-ocean-pipeline';
import { MICRO_NORMAL_OCTAVES_BY_TIER, MICRO_COMPENSATED_ROUGHNESS_CAP, LOW_TIER_ROUGHNESS_FLOOR } from './micro-optics';
import { NEAR_FIELD_VISIBLE_WAVES } from './gerstner-water';
import { NEAR_FIELD_FADE_BAND_METERS } from './ocean-bands';
import type { HullExclusionBox } from './hull-exclusion';
import type { MarineShoreSegment } from '../environment/scene-layouts';
import { getEnvironmentPreset, DEFAULT_ENVIRONMENT_PRESET_ID } from '../environment/environment-presets';
import { COMPARISON_OVERHEAD_WAVE_SHADE, COMPARISON_SUN_DIRECTION } from './shared-water-optics';
import { sampleBilinearHistory, sampleBilinearPeriodic } from './comparison-texture-sampling';
import { SURFACE_FOAM_DRIFT, SURFACE_FOAM_RESOLUTION } from './comparison-surface-history';
import { SHIP_WAVE_DOMAIN_METERS, SHIP_WAVE_RESOLUTION } from './ship-wave-config';
import { SHIP_SURFACE_CELL_METERS } from './marine-surface-geometry';
import { MARINE_FOAM_PROFILES, MARINE_TRAIL_RESOLUTION, FINE_FOAM_BLEND_START_METERS, FINE_FOAM_BLEND_END_METERS, type MarineFoamProfile } from './marine-foam-profile';

export function createComparisonWaterMaterial(options: {
  pipeline: ComparisonOceanPipeline | null;
  domain: number;
  wakeResolution: number;
  neutral: boolean;
  tier: 'low' | 'medium' | 'high';
  foamNoise: Texture;
  environment: Texture;
  amplitudeScale: number;
  shore?: MarineShoreSegment;
  shores?: readonly MarineShoreSegment[];
  shoreFadeBandMeters?: number;
  worldSpace?: boolean;
  hullExclusions?: readonly HullExclusionBox[];
  sedimentPlume?: { x: number; z: number; radiusMeters: number; opacity: number } | null;
  colors?: { waterColor: string; deepColor: string; horizonColor: string };
  sunDirection?: Vector3;
  sunIllumination?: number;
  foamProfile?: MarineFoamProfile;
}) {
  const { pipeline, domain, neutral, tier, foamNoise, environment } = options;
  const time = uniform(0);
  const opticalOctaves = uniform(MICRO_NORMAL_OCTAVES_BY_TIER[tier].length);
  const shipPose = uniform(new Vector3());
  const origin = uniform(new Vector2());
  const foamOrigin = uniform(new Vector2());
  const wakeOrigin = uniform(new Vector2());
  const washOrigin = uniform(new Vector2());
  const trailOrigin = uniform(new Vector2());
  const foamProfile = options.foamProfile ?? MARINE_FOAM_PROFILES.destroyer;
  const trailDomain = uniform(foamProfile.trailDomainMeters);
  const trailBubbleStrength = uniform(foamProfile.bubbleOpticalStrength);
  const shores = options.shores ?? (options.shore ? [options.shore] : []);
  const shoreDepth = Math.min(30, ...shores.map(shore => shore.shoreDepthMeters));
  const shallowEnabled = uniform(0);
  const planarStrength = uniform(0);
  const planarMatrix = uniform(new Matrix4());
  const placeholder = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  placeholder.needsUpdate = true;
  const shallowTexture = texture(placeholder);
  const planarTexture = texture(placeholder);
  // TSL按初始纹理身份合并绑定；各个可变历史必须有独立占位，避免更新某场时读到另一场。
  const zeroTextures = Array.from({ length: 4 }, () => {
    const value = new DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1); value.needsUpdate = true; return value;
  });
  const wakeTexture = texture(zeroTextures[0]);
  const historyTexture = texture(zeroTextures[1]);
  const washTexture = texture(zeroTextures[2]);
  const trailTexture = texture(zeroTextures[3]);
  const historyEnabled = uniform(0);
  const foamDrift = uniform(new Vector2(...SURFACE_FOAM_DRIFT));
  const n = varyingProperty('vec3', 'oceanNormal');
  const height = varyingProperty('float', 'oceanHeight');
  const farSurface = varyingProperty('float', 'oceanFarSurface');
  const horizontal = varyingProperty('vec2', 'oceanHorizontal');
  const shoreDistance = (p: Node<'vec2'>) => {
    let distance: Node<'float'> = float(1e6);
    for (const shore of shores) {
      const start = vec2(...shore.from);
      const dx = shore.to[0] - shore.from[0];
      const dz = shore.to[1] - shore.from[1];
      const ab = vec2(dx, dz);
      const along = dot(p.sub(start), ab).div(Math.max(dx * dx + dz * dz, 1e-8)).clamp();
      distance = distance.min(p.sub(start.add(ab.mul(along))).length());
    }
    return distance;
  };
  const baseDisplace = Fn(([p]: [Node<'vec2'>]) => {
    if (pipeline) {
      const at = p.div(domain).add(0.5 / pipeline.resolution).fract();
      return vec3(p.x.add(sampleBilinearPeriodic(texture(pipeline.displacementXTexture), at, pipeline.resolution).r),
        sampleBilinearPeriodic(texture(pipeline.heightTexture), at, pipeline.resolution).r,
        p.y.add(sampleBilinearPeriodic(texture(pipeline.displacementZTexture), at, pipeline.resolution).r));
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
  const wakeHeight = Fn(([p]: [Node<'vec2'>]) => sampleBilinearHistory(wakeTexture,
    p.sub(wakeOrigin).div(SHIP_WAVE_DOMAIN_METERS).add(0.5 + 0.5 / SHIP_WAVE_RESOLUTION), SHIP_WAVE_RESOLUTION).r);
  const attenuate = (p: Node<'vec2'>, value: Node<'vec3'>) => {
    if (!options.worldSpace || neutral || !shores.length) return value;
    const t = shoreDistance(p).div(options.shoreFadeBandMeters ?? 400).clamp();
    const attenuation = float(0.15).add(t.mul(t).mul(float(3).sub(t.mul(2))).mul(0.85));
    return vec3(p.x, 0, p.y).add(value.sub(vec3(p.x, 0, p.y)).mul(attenuation));
  };
  const backgroundDisplace = Fn(([p]: [Node<'vec2'>]) => attenuate(p, baseDisplace(p)));
  const displace = Fn(([p]: [Node<'vec2'>]) => {
    const base = baseDisplace(p);
    // 船行波采样在世界空间，跟随船的只有压力源，不旋转旧波场。
    const wake = wakeHeight(p);
    const combined = base.add(vec3(0, wake, 0));
    return attenuate(p, combined);
  });
  const material = new MeshBasicNodeMaterial();
  material.positionNode = Fn(() => {
    farSurface.assign(0);
    const p = positionLocal.xz.add(origin);
    const cell = pipeline ? mix(float(SHIP_SURFACE_CELL_METERS), float(domain / pipeline.resolution),
      smoothstep(384, 512, max(abs(p.x.sub(wakeOrigin.x)), abs(p.y.sub(wakeOrigin.y))))) : float(0.5);
    const visibleDisplace = (at: Node<'vec2'>) => {
      const value = displace(at);
      if (!options.worldSpace) return value;
      const local = at.sub(origin);
      const fade = float(1).sub(smoothstep(domain / 2 - 100, domain / 2, max(abs(local.x), abs(local.y))));
      return vec3(at.x, 0, at.y).add(value.sub(vec3(at.x, 0, at.y)).mul(fade));
    };
    const center = visibleDisplace(p).toVar();
    const right = visibleDisplace(p.add(vec2(cell, 0))).toVar();
    const front = visibleDisplace(p.add(vec2(0, cell))).toVar();
    const left = visibleDisplace(p.sub(vec2(cell, 0))).toVar();
    const back = visibleDisplace(p.sub(vec2(0, cell))).toVar();
    // 中心差分与当前顶点对齐，避免单边差分把反光偏移半个网格。
    const normal = normalize(cross(front.sub(back), right.sub(left)));
    n.assign(normal.y.lessThan(0).select(normal.negate(), normal));
    height.assign(center.y);
    horizontal.assign(center.xz.sub(p));
    return center.sub(vec3(origin.x, 0, origin.y));
  })();
  const colors = options.colors ?? getEnvironmentPreset(DEFAULT_ENVIRONMENT_PRESET_ID).water;
  const colorNode = (value: string) => {
    const color = new Color(value);
    return vec3(color.r, color.g, color.b);
  };
  const waterColor = colorNode(colors.waterColor);
  const deepColor = colorNode(colors.deepColor);
  const horizonColor = colorNode(colors.horizonColor);
  const sun = vec3(options.sunDirection ?? COMPARISON_SUN_DIRECTION);
  const illumination = options.sunIllumination ?? 1;
  const noise = texture(foamNoise);
  const waterColorNode = Fn(() => {
    // 远海只填补近场网格之外；否则平均海平面会把所有负浪高截平。
    if (options.worldSpace) {
      const distance = max(abs(positionWorld.x.sub(origin.x)), abs(positionWorld.z.sub(origin.y)));
      If(farSurface.greaterThan(0.5).and(distance.lessThan(domain / 2)), () => { Discard(); });
    }
    const relative = positionWorld.xz.sub(shipPose.xy);
    const forward = vec2(shipPose.z.sin(), shipPose.z.cos());
    const local = vec2(dot(relative, forward), dot(relative, vec2(forward.y.negate(), forward.x)));
    for (const box of options.hullExclusions ?? []) {
      If(abs(local.x.sub(box.centerX)).lessThan(box.halfX).and(abs(local.y.sub(box.centerZ)).lessThan(box.halfZ)), () => { Discard(); });
    }
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
    for (const [index, octave] of MICRO_NORMAL_OCTAVES_BY_TIER[tier].entries()) {
      const direction = vec2(...octave.direction);
      const across = vec2(-octave.direction[1], octave.direction[0]);
      const wavelength = 2 * Math.PI / octave.waveNumber;
      const footprint = max(
        max(abs(dot(stepX, direction)), abs(dot(stepY, direction))),
        max(abs(dot(stepX, across)), abs(dot(stepY, across))).mul(0.65),
      ).max(1e-4);
      const weight = smoothstep(1.15, 2.6, float(wavelength).div(footprint)).mul(opticalOctaves.greaterThan(index).select(1, 0));
      const variance = (octave.slopeAmplitude * octave.waveNumber) ** 2;
      energy += variance;
      retained.addAssign(weight.mul(weight).mul(variance));
      // 有限组正弦波仍会形成整齐的交叉条纹；用连续噪声生成不规则的小波纹。
      // 世界坐标输运保持暂停/重放确定性，横向足迹也参与过滤。
      If(weight.greaterThan(0), () => {
        const at = vec2(
          dot(positionWorld.xz, direction).sub(time.mul(octave.speedScale * 1.2)),
          dot(positionWorld.xz, across).mul(0.65),
        ).div(wavelength).add(vec2(octave.phaseOffset, octave.phaseOffset * 1.618));
        slopes.addAssign(direction.mul(mx_noise_float(at)).mul(weight).mul(octave.slopeAmplitude * octave.waveNumber * 0.8));
      });
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
        .mul(Math.min(1, Math.max(0.05, (20 - shoreDepth) / 16))));
      absorption.assign(exp(mix(shoreDepth * 0.15, shoreDepth, t).max(0.2).mul(-0.55)));
      offset.assign(view.xz.mul(float(1).sub(absorption)).mul(0.35).mul(shallowMix));
    });
    const carried = positionWorld.xz.add(offset).sub(foamDrift.mul(time)).sub(horizontal);
    const detail = noise.sample(carried.div(pipeline ? 5 : 23)).a.mul(0.4)
      .add(noise.sample(carried.div(pipeline ? 13 : 71).add(vec2(0.37, 0.13))).a.mul(0.35))
      .add(noise.sample(carried.div(pipeline ? 37 : 149).add(vec2(0.71, 0.53))).a.mul(0.25));
    const coverage = float(0).toVar();
    const history = sampleBilinearHistory(historyTexture, positionWorld.xz.sub(foamOrigin).div(domain).add(0.5), SURFACE_FOAM_RESOLUTION);
    const wash = sampleBilinearHistory(washTexture, positionWorld.xz.sub(washOrigin).div(SHIP_WAVE_DOMAIN_METERS).add(0.5), SHIP_WAVE_RESOLUTION);
    const trail = sampleBilinearHistory(trailTexture, positionWorld.xz.sub(trailOrigin).div(trailDomain).add(0.5), MARINE_TRAIL_RESOLUTION);
    const fineWeight = float(1).sub(smoothstep(FINE_FOAM_BLEND_START_METERS, FINE_FOAM_BLEND_END_METERS,
      max(abs(positionWorld.x.sub(washOrigin.x)), abs(positionWorld.z.sub(washOrigin.y)))));
    If(historyEnabled.greaterThan(0.5), () => {
      // 新生白沫较密，残留泡沫逐渐破碎为斑驳薄层；位置来自输运场。
      const patches = smoothstep(0.22, 0.70, detail);
      // 洗流密度决定可见量，稀疏纹理只调节斑驳，不能抹去已有残留层。
      const washPatches = mix(0.35, 1, patches);
      const fineCoverage = wash.r.mul(washPatches).mul(0.65).add(wash.g.mul(0.28))
        .add(wash.b.mul(patches).mul(0.75)).add(wash.a.mul(0.28));
      const trailCoverage = trail.r.mul(washPatches).mul(0.65).add(trail.b.mul(patches).mul(0.75));
      coverage.assign(history.r.mul(patches).add(history.g.mul(0.25)).add(mix(trailCoverage, fineCoverage, fineWeight)).clamp());
    });
    const nv = dot(normal, view).max(1e-4);
    const nl = dot(normal, sun).max(0);
    const half = normalize(sun.add(view));
    const nh = dot(normal, half).max(0);
    const baseRoughness = max(
      max(opticalOctaves.equal(0).select(LOW_TIER_ROUGHNESS_FLOOR, 0.06), mix(0.06, 0.6, coverage)),
      mix(0.06, MICRO_COMPENSATED_ROUGHNESS_CAP, lost));
    // 像素内法线变化扩大高光瓣，避免低粗糙度把细节放大为鱼鳞状闪点。
    const normalDx = dFdx(normal), normalDy = dFdy(normal);
    const normalVariance = dot(normalDx, normalDx).add(dot(normalDy, normalDy)).mul(0.15);
    const roughness = pow(pow(baseRoughness, 4).add(normalVariance.mul(2).min(0.2)).min(1), 0.25);
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
    if (options.sedimentPlume) {
      const plume = options.sedimentPlume;
      const coverage = float(1).sub(smoothstep(0, plume.radiusMeters, positionWorld.xz.add(offset).sub(vec2(plume.x, plume.z)).length())).mul(plume.opacity);
      color.assign(mix(color, vec3(0.29, 0.24, 0.13).mul(light.mul(0.65).add(0.35)), coverage));
    }
    const foamLit = colorNode('#d7e4ea').mul(light.mul(0.65).add(0.35)).mul(illumination);
    // 水下气泡只产生较弱的水色散射；旧尾迹不会持续变成亮白涂层。
    const bubbles = historyEnabled.greaterThan(0.5).select(trail.g.mul(trailBubbleStrength).clamp(0, 0.18), 0);
    const bubbleLit = color.add(waterColor.mul(0.4)).add(vec3(0.025, 0.07, 0.055).mul(light.mul(0.65).add(0.35)).mul(illumination));
    color.assign(mix(color, bubbleLit, bubbles));
    color.assign(mix(color, foamLit, coverage.mul(0.85)));
    const overhead = smoothstep(0.04, 0.42, view.y.max(0));
    return color.mul(float(1).add(overhead.mul(height.mul(COMPARISON_OVERHEAD_WAVE_SHADE).clamp(-0.42, 0.42))));
  })();
  // 已在上面计算完整光学，不能再走 BasicMaterial 的环境乘色。
  material.fragmentNode = vec4(waterColorNode, 1);
  return {
    material, time, opticalOctaves, origin, foamOrigin, wakeOrigin, washOrigin, trailOrigin, trailDomain, trailBubbleStrength, shipPose, displace, backgroundDisplace, wakeHeight,
    wakeTexture, historyTexture, washTexture, trailTexture, historyEnabled, shallowEnabled, shallowTexture, planarTexture, planarStrength, planarMatrix,
    emptyTexture: placeholder,
    createFarMaterial() {
      const far = material.clone();
      far.positionNode = Fn(() => {
        farSurface.assign(1);
        n.assign(vec3(0, 1, 0)); height.assign(0); horizontal.assign(vec2(0));
        return positionLocal;
      })();
      return far;
    },
    createSurfaceProbeMaterial() {
      const probe = material.clone();
      probe.fragmentNode = vec4(positionWorld.y, n.x.negate().div(n.y.max(1e-4)), n.z.negate().div(n.y.max(1e-4)), 1);
      probe.toneMapped = false;
      return probe;
    },
    dispose() { material.dispose(); placeholder.dispose(); for (const value of zeroTextures) value.dispose(); },
  };
}
