import { DataTexture, FloatType, NearestFilter, RGBAFormat, RenderTarget, MeshBasicNodeMaterial, QuadMesh, type Node, type WebGPURenderer } from 'three/webgpu';
import { Fn, float, vec2, vec4, uv, texture, uniform } from 'three/tsl';

/** 两个复数通道共用一次二维变换，供背景位移与局部 h/v 场使用。 */
export function createOceanGpuTransform(renderer: WebGPURenderer, n: number) {
  const bits = Math.round(Math.log2(n));
  if (2 ** bits !== n) throw new Error('Ocean FFT resolution must be a power of two');
  const placeholder = new DataTexture(new Float32Array(4), 1, 1, RGBAFormat, FloatType);
  placeholder.needsUpdate = true;
  const target = () => new RenderTarget(n, n, { type: FloatType, format: RGBAFormat,
    minFilter: NearestFilter, magFilter: NearestFilter, depthBuffer: false, stencilBuffer: false });
  const ping = target(), pong = target();
  const input = texture(placeholder), horizontal = uniform(1), span = uniform(2), sign = uniform(1), scale = uniform(1);
  const material = (output: Node) => {
    const result = new MeshBasicNodeMaterial();
    result.fragmentNode = output; result.depthTest = result.depthWrite = result.toneMapped = false;
    return result;
  };
  const permute = material(Fn(() => {
    const index = horizontal.greaterThan(0.5).select(uv().x, uv().y).mul(n).floor();
    const reversed = float(0).toVar();
    for (let b = 0; b < bits; b++) reversed.assign(reversed.mul(2).add(index.div(2 ** b).floor().mod(2)));
    const p = reversed.add(0.5).div(n);
    return input.sample(horizontal.greaterThan(0.5).select(vec2(p, uv().y), vec2(uv().x, p)));
  })());
  const butterfly = material(Fn(() => {
    const index = horizontal.greaterThan(0.5).select(uv().x, uv().y).mul(n).floor();
    const half = span.mul(0.5), even = index.mod(span).lessThan(half);
    const partner = even.select(index.add(half), index.sub(half)).add(0.5).div(n);
    const self = input.sample(uv());
    const other = input.sample(horizontal.greaterThan(0.5).select(vec2(partner, uv().y), vec2(uv().x, partner)));
    const oddInput = even.select<'vec4'>(other, self), evenInput = even.select<'vec4'>(self, other);
    const angle = index.mod(half).mul(2 * Math.PI).div(span).mul(sign);
    const rotate = (v: Node<'vec2'>) => vec2(v.x.mul(angle.cos()).sub(v.y.mul(angle.sin())),
      v.x.mul(angle.sin()).add(v.y.mul(angle.cos())));
    const twiddle = vec4(rotate(oddInput.xy), rotate(oddInput.zw));
    return even.select(evenInput.add(twiddle), evenInput.sub(twiddle));
  })());
  const output = material(input.sample(uv()).mul(scale));
  const quad = new QuadMesh(permute);
  const pass = (mat: MeshBasicNodeMaterial, dest: RenderTarget, from: RenderTarget) => {
    input.value = from.texture; quad.material = mat; renderer.setRenderTarget(dest); quad.render(renderer);
  };
  return {
    run(from: RenderTarget, dest: RenderTarget, inverse = true) {
      sign.value = inverse ? 1 : -1; scale.value = inverse ? 1 / (n * n) : 1;
      let source = from;
      for (const axis of [1, 0]) {
        horizontal.value = axis;
        let sink = source === ping ? pong : ping;
        pass(permute, sink, source); source = sink;
        for (let stage = 0; stage < bits; stage++) {
          span.value = 2 ** (stage + 1); sink = source === ping ? pong : ping;
          pass(butterfly, sink, source); source = sink;
        }
      }
      pass(output, dest, source);
    },
    dispose() { placeholder.dispose(); ping.dispose(); pong.dispose(); permute.dispose(); butterfly.dispose(); output.dispose(); },
  };
}
