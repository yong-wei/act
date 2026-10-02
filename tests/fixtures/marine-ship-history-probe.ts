import { createMarineRenderer, marineRendererIdentity } from '../../src/resources/simulations/scene/marine-renderer';
import { createComparisonOceanPipeline } from '../../src/resources/simulations/scene/water/comparison-ocean-pipeline';
import { createComparisonWaterMaterial } from '../../src/resources/simulations/scene/water/comparison-water-material';
import { createComparisonSurfaceHistory, type SurfaceHistoryPose, type MarineFoamEmitter } from '../../src/resources/simulations/scene/water/comparison-surface-history';
import { createMarineSurfaceGeometry } from '../../src/resources/simulations/scene/water/marine-surface-geometry';
import { fftOceanStaticSpectrum } from '../../src/resources/simulations/scene/water/fft-ocean';
import { createOceanGpuTransform } from '../../src/resources/simulations/scene/water/ocean-gpu-transform';
import { DataTexture, FloatType, RGBAFormat, RenderTarget, Vector2, Scene, Mesh, OrthographicCamera, MeshBasicNodeMaterial, QuadMesh } from 'three/webgpu';
import { uniform, vec4 } from 'three/tsl';

export async function create(api: 'webgl' | 'webgpu', speed = 12, path: 'straight' | 'circle' = 'straight') {
  const renderer = await createMarineRenderer(document.createElement('canvas'), api); renderer.setSize(128, 128);
  const zero = new DataTexture(new Float32Array(4), 1, 1, RGBAFormat, FloatType); zero.needsUpdate = true;
  const spectrum = fftOceanStaticSpectrum({ resolution: 16, domainMeters: 2048, windSpeedMps: 12, windDirectionRad: 0.2, seaState: 4, seed: 17 });
  const background = createComparisonOceanPipeline(renderer, spectrum, 2048);
  const water = createComparisonWaterMaterial({ pipeline: { ...background, heightTexture: zero, displacementXTexture: zero, displacementZTexture: zero },
    domain: 2048, wakeResolution: 512, neutral: true, tier: 'low', foamNoise: zero, environment: zero, amplitudeScale: 1 });
  let poseOverride: SurfaceHistoryPose | null = null, jets: readonly MarineFoamEmitter[] = [];
  const poseAt = (t: number): SurfaceHistoryPose => poseOverride ?? (path === 'straight'
    ? { x: 0, z: speed * t, headingRad: 0, speedMps: speed }
    : { x: 300 * (Math.cos(speed * t / 300) - 1), z: 300 * Math.sin(speed * t / 300), headingRad: -speed * t / 300, speedMps: speed });
  const history = createComparisonSurfaceHistory(renderer, background, water, 2048, poseAt, () => {}, { foamEmitters: () => jets });
  const geometry = createMarineSurfaceGeometry(2048, 256), probeMaterial = water.createSurfaceProbeMaterial();
  const scene = new Scene(), mesh = new Mesh(geometry, probeMaterial); mesh.position.y = -1; scene.add(mesh);
  const camera = new OrthographicCamera(-0.01, 0.01, 0.01, -0.01, 0.1, 200);
  camera.coordinateSystem = renderer.coordinateSystem; camera.up.set(0, 0, -1); camera.updateProjectionMatrix();
  const sampleTarget = new RenderTarget(1, 1, { type: FloatType }), point = uniform(new Vector2());
  const pointMaterial = new MeshBasicNodeMaterial(); pointMaterial.fragmentNode = vec4(water.wakeHeight(point), 0, 0, 1);
  pointMaterial.toneMapped = false; const quad = new QuadMesh(pointMaterial);
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
      renderer.setRenderTarget(sampleTarget); point.value.set(x, z); quad.render(renderer);
      const field = (await renderer.readRenderTargetPixelsAsync(sampleTarget, 0, 0, 1, 1))[0];
      camera.position.set(x, 100, z); camera.lookAt(x, -1, z); renderer.render(scene, camera);
      const pixel = await renderer.readRenderTargetPixelsAsync(sampleTarget, 0, 0, 1, 1);
      renderer.setRenderTarget(null); return { field, visible: pixel[0] + 1, slope: [pixel[1], pixel[2]] };
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
    dispose() { history.dispose(); background.dispose(); water.dispose(); zero.dispose(); sampleTarget.dispose(); geometry.dispose(); probeMaterial.dispose(); pointMaterial.dispose(); renderer.dispose(); },
  };
}

declare global { interface Window { __shipHistoryFixture?: Awaited<ReturnType<typeof create>>; } }
