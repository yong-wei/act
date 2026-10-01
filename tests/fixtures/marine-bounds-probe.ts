import {
  createMarineRenderer,
  marineRendererIdentity,
} from '../../src/resources/simulations/scene/marine-renderer';
import { createComparisonOceanPipeline } from '../../src/resources/simulations/scene/water/comparison-ocean-pipeline';
import { fftOceanStaticSpectrum, fftOceanSnapshot } from '../../src/resources/simulations/scene/water/fft-ocean';
import { createComparisonWaterMaterial } from '../../src/resources/simulations/scene/water/comparison-water-material';
import {
  DataTexture,
  FloatType,
  RGBAFormat,
  Scene,
  Mesh,
  PlaneGeometry,
  OrthographicCamera,
  RenderTarget,
} from 'three/webgpu';
export async function probe(api: 'webgl' | 'webgpu') {
  const r = await createMarineRenderer(document.createElement('canvas'), api);
  r.setSize(64, 64);
  const spectrum = fftOceanStaticSpectrum({ resolution: 8, domainMeters: 2048, windSpeedMps: 12, windDirectionRad: 0.2, seaState: 4, seed: 17 });
  const pipeline = createComparisonOceanPipeline(r, spectrum, 2048);
  pipeline.run(1.25);
  const field = await pipeline.readField();
  const reference = fftOceanSnapshot(spectrum, 2048, 1.25);
  const fftMaxError = Math.max(...field.heights.map((value, i) => Math.abs(value - reference.heights[i])));
  const tex = (value: number) => {
    const t = new DataTexture(
      new Float32Array([value, 0, 0, 1]),
      1,
      1,
      RGBAFormat,
      FloatType,
    );
    t.needsUpdate = true;
    return t;
  };
  const h = tex(-2),
    z = tex(0);
  const b = createComparisonWaterMaterial({
    pipeline: {
      ...pipeline,
      resolution: 1,
      heightTexture: h,
      displacementXTexture: z,
      displacementZTexture: z,
    },
    domain: 2048,
    wakeResolution: 1,
    neutral: true,
    tier: 'low',
    foamNoise: z,
    environment: z,
    amplitudeScale: 1,
    worldSpace: true,
  });
  const s = new Scene(),
    g = new PlaneGeometry(2048, 2048, 16, 16).rotateX(-Math.PI / 2),
    fg = new PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2);
  const near = new Mesh(g, b.material),
    far = new Mesh(fg, b.createFarMaterial());
  near.position.y = far.position.y = -1;
  s.add(near, far);
  const c = new OrthographicCamera(-1600, 1600, 1600, -1600, 0.1, 100);
  c.position.set(0, 20, 0);
  c.up.set(0, 0, -1);
  c.lookAt(0, 0, 0);
  c.updateMatrixWorld();
  const rt = new RenderTarget(64, 64);
  r.setRenderTarget(rt);
  async function shot() {
    r.render(s, c);
    return Array.from(await r.readRenderTargetPixelsAsync(rt, 0, 0, 64, 64));
  }
  const withFar = await shot();
  far.visible = false;
  const withoutFar = await shot();
  const at = (pixels: number[], x: number, y: number) =>
    pixels.slice((y * 64 + x) * 4, (y * 64 + x) * 4 + 4);
  const result = {
    identity: marineRendererIdentity(r),
    fftMaxError,
    centerWithFar: at(withFar, 32, 32),
    centerWithoutFar: at(withoutFar, 32, 32),
    outsideWithFar: at(withFar, 2, 32),
    outsideWithoutFar: at(withoutFar, 2, 32),
  };
  r.setRenderTarget(null);
  rt.dispose();
  g.dispose();
  fg.dispose();
  far.material.dispose();
  b.dispose();
  pipeline.dispose();
  h.dispose();
  z.dispose();
  r.dispose();
  return result;
}
