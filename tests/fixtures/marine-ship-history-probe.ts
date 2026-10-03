import { createMarineRenderer, marineRendererIdentity } from '../../src/resources/simulations/scene/marine-renderer';
import { createComparisonOceanPipeline } from '../../src/resources/simulations/scene/water/comparison-ocean-pipeline';
import { createComparisonWaterMaterial } from '../../src/resources/simulations/scene/water/comparison-water-material';
import { createComparisonSurfaceHistory, type SurfaceHistoryPose, type MarineFoamEmitter } from '../../src/resources/simulations/scene/water/comparison-surface-history';
import { createMarineSurfaceGeometry } from '../../src/resources/simulations/scene/water/marine-surface-geometry';
import { fftOceanStaticSpectrum } from '../../src/resources/simulations/scene/water/fft-ocean';
import { createOceanGpuTransform } from '../../src/resources/simulations/scene/water/ocean-gpu-transform';
import { MARINE_FOAM_PROFILES, MARINE_TRAIL_RESOLUTION, type MarineFoamVessel } from '../../src/resources/simulations/scene/water/marine-foam-profile';
import { sampleBilinearHistory } from '../../src/resources/simulations/scene/water/comparison-texture-sampling';
import { DataTexture, FloatType, RGBAFormat, RenderTarget, Vector2, Scene, Mesh, OrthographicCamera, MeshBasicNodeMaterial, QuadMesh, EquirectangularReflectionMapping, SRGBColorSpace } from 'three/webgpu';
import { uniform, vec4 } from 'three/tsl';

export async function create(api: 'webgl' | 'webgpu', speed = 12, path: 'straight' | 'circle' = 'straight', vessel: MarineFoamVessel = 'destroyer', ambientWaves = false) {
  const dimensions = { destroyer: [180, 20], cruise: [323.6, 37.2], lng: [295, 45], container: [399.9, 61.5],
    icebreaker: [122.5, 22.3], dredger: [127.5, 23], drilling: [114, 89] };
  const [lengthMeters, beamMeters] = dimensions[vessel], foamProfile = MARINE_FOAM_PROFILES[vessel];
  const renderer = await createMarineRenderer(document.createElement('canvas'), api); renderer.setSize(128, 128);
  const zero = new DataTexture(new Float32Array(4), 1, 1, RGBAFormat, FloatType); zero.needsUpdate = true;
  const spectrum = fftOceanStaticSpectrum({ resolution: 16, domainMeters: 2048, windSpeedMps: 12, windDirectionRad: 0.2, seaState: 4, seed: 17 });
  const background = createComparisonOceanPipeline(renderer, spectrum, 2048);
  // 可控的64m波长、2m振幅背景，仅作为船侧激励输入，不新增船舶运动模型。
  const waveData = new Float32Array(256 * 256 * 4);
  if (ambientWaves) for (let z = 0; z < 256; z++) for (let x = 0; x < 256; x++) {
    waveData[(z * 256 + x) * 4] = 2 * Math.sin(2 * Math.PI * z * 8 / 64);
  }
  const ambientTexture = new DataTexture(waveData, 256, 256, RGBAFormat, FloatType); ambientTexture.needsUpdate = true;
  const sampledBackground = { ...background, resolution: ambientWaves ? 256 : background.resolution,
    heightTexture: ambientWaves ? ambientTexture : zero, displacementXTexture: zero, displacementZTexture: zero };
  const water = createComparisonWaterMaterial({ pipeline: sampledBackground,
    domain: 2048, wakeResolution: 512, neutral: true, tier: 'low', foamNoise: zero, environment: zero, amplitudeScale: 1, foamProfile });
  let poseOverride: SurfaceHistoryPose | null = null, jets: readonly MarineFoamEmitter[] = [];
  const poseAt = (t: number): SurfaceHistoryPose => poseOverride ?? (path === 'straight'
    ? { x: 0, z: speed * t, headingRad: 0, speedMps: speed }
    : { x: 300 * (Math.cos(speed * t / 300) - 1), z: 300 * Math.sin(speed * t / 300), headingRad: -speed * t / 300, speedMps: speed });
  const history = createComparisonSurfaceHistory(renderer, sampledBackground, water, 2048, poseAt, () => {},
    { foamEmitters: () => jets, lengthMeters, beamMeters, foamProfile });
  const geometry = createMarineSurfaceGeometry(2048, 256), probeMaterial = water.createSurfaceProbeMaterial();
  const scene = new Scene(), mesh = new Mesh(geometry, probeMaterial); mesh.position.y = -1; scene.add(mesh);
  const camera = new OrthographicCamera(-0.01, 0.01, 0.01, -0.01, 0.1, 200);
  camera.coordinateSystem = renderer.coordinateSystem; camera.up.set(0, 0, -1); camera.updateProjectionMatrix();
  const sampleTarget = new RenderTarget(1, 1, { type: FloatType }), point = uniform(new Vector2());
  const pointMaterial = new MeshBasicNodeMaterial(); pointMaterial.fragmentNode = vec4(water.wakeHeight(point), 0, 0, 1);
  pointMaterial.toneMapped = false; const quad = new QuadMesh(pointMaterial);
  const fineFoamMaterial = new MeshBasicNodeMaterial(); fineFoamMaterial.toneMapped = false;
  fineFoamMaterial.fragmentNode = sampleBilinearHistory(water.washTexture, point.sub(water.washOrigin).div(768).add(0.5), 512);
  const trailMaterial = new MeshBasicNodeMaterial(); trailMaterial.toneMapped = false;
  trailMaterial.fragmentNode = sampleBilinearHistory(water.trailTexture,
    point.sub(water.trailOrigin).div(water.trailDomain).add(0.5), MARINE_TRAIL_RESOLUTION);
  let time = 0;
  return {
    identity: () => marineRendererIdentity(renderer), stats: history.stats, read: history.readDiagnostics,
    setSources: history.setSources,
    setJets(value: readonly MarineFoamEmitter[]) { jets = value; },
    setSpeed(value: number) { speed = value; },
    setPose(value: SurfaceHistoryPose | null) { poseOverride = value; },
    reset() { history.reset(); time = 0; },
    advanceTo(end: number) {
      while (time < end - 1e-8) { time = Math.min(end, time + 4 / 60); history.advance(time); }
      water.origin.value.copy(water.wakeOrigin.value); mesh.position.set(water.origin.value.x, -1, water.origin.value.y);
    },
    async sample(x: number, z: number) {
      quad.material = pointMaterial;
      renderer.setRenderTarget(sampleTarget); point.value.set(x, z); quad.render(renderer);
      const field = (await renderer.readRenderTargetPixelsAsync(sampleTarget, 0, 0, 1, 1))[0];
      camera.position.set(x, 100, z); camera.lookAt(x, -1, z); renderer.render(scene, camera);
      const pixel = await renderer.readRenderTargetPixelsAsync(sampleTarget, 0, 0, 1, 1);
      renderer.setRenderTarget(null); return { field, visible: pixel[0] + 1, slope: [pixel[1], pixel[2]] };
    },
    async sampleFoam(x: number, z: number) {
      point.value.set(x, z); renderer.setRenderTarget(sampleTarget);
      quad.material = fineFoamMaterial; quad.render(renderer);
      const fine = Array.from(await renderer.readRenderTargetPixelsAsync(sampleTarget, 0, 0, 1, 1));
      quad.material = trailMaterial; quad.render(renderer);
      const trail = Array.from(await renderer.readRenderTargetPixelsAsync(sampleTarget, 0, 0, 1, 1));
      renderer.setRenderTarget(null); quad.material = pointMaterial; return { fine, trail };
    },
    async transformProbe() {
      const n = 16, data = new Float32Array(n * n * 4);
      for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
        data[(z * n + x) * 4] = 0.4 * Math.cos(2 * Math.PI * (2 * x + 3 * z) / n);
        data[(z * n + x) * 4 + 2] = 0.3 * Math.sin(2 * Math.PI * (x + 2 * z) / n);
      }
      const texture = new DataTexture(data, n, n, RGBAFormat, FloatType); texture.needsUpdate = true;
      const input = new RenderTarget(n, n, { type: FloatType }), spectral = input.clone(), output = input.clone();
      const { texture: original } = input; input.texture = texture;
      const transform = createOceanGpuTransform(renderer, n);
      transform.run(input, spectral, false); transform.run(spectral, output);
      const values = await renderer.readRenderTargetPixelsAsync(output, 0, 0, n, n);
      const flip = marineRendererIdentity(renderer).api === 'WebGLBackend';
      let maxError = 0;
      for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) for (let c = 0; c < 4; c++) {
        maxError = Math.max(maxError, Math.abs(values[((flip ? n - 1 - z : z) * n + x) * 4 + c] - data[(z * n + x) * 4 + c]));
      }
      const mode = await renderer.readRenderTargetPixelsAsync(spectral, 2, flip ? n - 1 - 3 : 3, 1, 1);
      renderer.setRenderTarget(null); input.texture = original;
      transform.dispose(); input.dispose(); spectral.dispose(); output.dispose(); texture.dispose();
      return { maxError, mode: Array.from(mode) };
    },
    dispose() { history.dispose(); background.dispose(); water.dispose(); zero.dispose(); ambientTexture.dispose(); sampleTarget.dispose(); geometry.dispose(); probeMaterial.dispose(); pointMaterial.dispose(); fineFoamMaterial.dispose(); trailMaterial.dispose(); renderer.dispose(); },
  };
}

/** 实际共享光学：稀疏噪声下，新生层消退后仍能看见已有洗流密度。 */
export async function persistentWashVisibility(api: 'webgl' | 'webgpu', channel: 'surface' | 'bubble' | 'blend' = 'surface') {
  const renderer = await createMarineRenderer(document.createElement('canvas'), api);
  renderer.setSize(32, 32);
  const zero = new DataTexture(new Float32Array(4), 1, 1, RGBAFormat, FloatType);
  const density = new DataTexture(new Float32Array(channel === 'bubble' ? [0, 0.5, 0, 0] : [0.5, 0, 0, 0]), 1, 1, RGBAFormat, FloatType);
  // 正式alpha纹理均值约0.138；常值排除视点及多尺度采样造成的偶然白斑。
  const noise = new DataTexture(new Uint8Array([255, 255, 255, 35]), 1, 1);
  const skyData = new Uint8Array(256 * 128 * 4);
  for (let i = 0; i < skyData.length; i += 4) skyData.set([60, 94, 145, 255], i);
  const sky = new DataTexture(skyData, 256, 128);
  sky.mapping = EquirectangularReflectionMapping; sky.colorSpace = SRGBColorSpace;
  for (const input of [zero, density, noise, sky]) input.needsUpdate = true;
  const water = createComparisonWaterMaterial({ pipeline: null, domain: 2048, wakeResolution: 512,
    neutral: false, tier: 'low', foamNoise: noise, environment: sky, amplitudeScale: 0 });
  water.historyEnabled.value = 1;
  const geometry = createMarineSurfaceGeometry(2048, 256), scene = new Scene();
  const mesh = new Mesh(geometry, water.material); mesh.position.y = -1; scene.add(mesh);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  camera.coordinateSystem = renderer.coordinateSystem; camera.up.set(0, 0, -1);
  const z = channel === 'bubble' ? -1000 : channel === 'blend' ? -300 : 0;
  camera.position.set(0, 100, z); camera.lookAt(0, -1, z); camera.updateProjectionMatrix();
  const target = new RenderTarget(1, 1, { type: FloatType });
  const read = async () => {
    renderer.setRenderTarget(target); renderer.render(scene, camera);
    const values = await renderer.readRenderTargetPixelsAsync(target, 0, 0, 1, 1);
    return Array.from(values).slice(0, 3);
  };
  try {
    water.washTexture.value = zero;
    const background = await read();
    if (channel === 'bubble') water.trailTexture.value = density;
    else water.washTexture.value = density;
    if (channel === 'blend') water.trailTexture.value = density;
    const wash = await read();
    water.washTexture.value = zero;
    water.trailTexture.value = zero;
    const cleared = await read();
    return { identity: marineRendererIdentity(renderer), background, wash, cleared,
      visibleIncrease: wash[0] - background[0] };
  } finally {
    renderer.setRenderTarget(null); geometry.dispose(); water.dispose();
    for (const input of [zero, density, noise, sky]) input.dispose();
    target.dispose(); renderer.dispose();
  }
}

declare global { interface Window { __shipHistoryFixture?: Awaited<ReturnType<typeof create>>; } }
