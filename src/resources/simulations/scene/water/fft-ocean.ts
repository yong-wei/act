/**
 * WebGL FFT 海洋波场（#2121 实验）：频谱定义、CPU 参照与船体稀疏水高查询。
 *
 * 纯模块（GPU 管线见 fft-ocean-surface.tsx）：
 * - 频谱：实验方向谱（PM 型单峰，与 #2105 experimentalDirectionalSpectrum 同族）
 *   映射到 k 网格，深水色散 ω=√(g|k|) 做时间演化；确定性种子（同初态可复现）。
 * - CPU 参照：ifft2d（行/列 radix-2）与**逐点逆 DFT**（独立参照——验证 GPU/
 *   快速路径时不得用同一实现充当独立证据）。
 * - 船体查询：逐点逆 DFT 直接求任意世界点高度（无整纹理读回）。
 *
 * 实验代码：不接入生产默认海洋后端（采用需单独 change）。
 */

export interface ComplexGrid {
  /** 交错复数（re, im），长度 resolution²×2。 */
  readonly data: Float32Array;
  /** 逐 bin 深水色散角频率（rad/s，GPU 演化 pass 共用同一值）。 */
  readonly omegas: Float32Array;
  readonly resolution: number;
}

/** DFT 频率箱索引 → 波数（标准 DFT 约定：n ≤ N/2 为正频，其余为负频）。 */
export function binWaveNumber(index: number, resolution: number, domainMeters: number): number {
  const folded = index <= resolution / 2 ? index : index - resolution;
  return (2 * Math.PI * folded) / domainMeters;
}

/** 深水色散角频率（rad/s）。 */
export function dispersionOmega(waveNumberMagnitude: number): number {
  return Math.sqrt(9.81 * Math.max(waveNumberMagnitude, 1e-9));
}

/** 确定性伪随机（[0,1)）。 */
function seededRandom(seed: number): () => number {
  let state = (seed * 2654435761) >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

export interface FFTOceanSpectrumInput {
  /** k 网格分辨率（2 的幂）。 */
  readonly resolution: number;
  /** 域边长（米）。 */
  readonly domainMeters: number;
  /** 风速（米/秒）与风向（弧度）。 */
  readonly windSpeedMps: number;
  readonly windDirectionRad: number;
  /** 海况 1-6 → 能量缩放。 */
  readonly seaState: number;
  readonly seed: number;
}

/**
 * 生成**静态**复振幅谱（时间无关；演化相位由消费者按 ωt 施加）。
 * 网格约定：index (n, m) → k = 2π(n - N/2)/L, 2π(m - N/2)/L。
 */
export function fftOceanStaticSpectrum(input: FFTOceanSpectrumInput): ComplexGrid {
  const { resolution: n, domainMeters: domain } = input;
  const data = new Float32Array(n * n * 2);
  const omegas = new Float32Array(n * n);
  const random = seededRandom(input.seed);
  // 峰值频率（Hz）：0.8g/U 是角频率（rad/s）——除以 2π 换算（12m/s → ~0.104Hz，
  // 峰值周期 ~9.6s，与 Gerstner 主波段同量级）。
  const peakFrequency = Math.min(0.45, (0.8 * 9.81) / Math.max(input.windSpeedMps, 1) / (2 * Math.PI));
  const bandHz = 0.12;
  // 标定：ss4 风速 12 → Hs ≈ 1.3m（与教学海况同量级；×40 于初始标定）。
  const energyScale = Math.pow(Math.max(input.seaState, 1), 1.6) * 14;
  for (let m = 0; m < n; m += 1) {
    const kz = binWaveNumber(m, n, domain);
    for (let ix = 0; ix < n; ix += 1) {
      const kx = binWaveNumber(ix, n, domain);
      const kMagnitude = Math.hypot(kx, kz);
      if (kMagnitude < 1e-6) continue; // 直流项无波
      // 频率（深水）→ PM 型单峰能量。
      // 深水关系 ω=√(gk) → Hz = ω/(2π)（除法在根号外）。
      const frequencyHz = Math.sqrt(9.81 * kMagnitude) / (2 * Math.PI);
      const frequencyFactor = Math.exp(-Math.pow((frequencyHz - peakFrequency) / bandHz, 2));
      // 方向扩散：风向对齐能量最大。
      const waveDirection = Math.atan2(kz, kx);
      let directionDelta = Math.abs(waveDirection - input.windDirectionRad);
      directionDelta = Math.min(directionDelta, Math.PI * 2 - directionDelta);
      const directionSpread = Math.pow(Math.cos(Math.min(directionDelta, Math.PI / 2)), 6);
      const amplitude =
        energyScale * frequencyFactor * directionSpread * (0.7 + 0.6 * random());
      // 随机相位（确定性）。
      const phase = random() * Math.PI * 2;
      const index = (m * n + ix) * 2;
      data[index] = amplitude * Math.cos(phase);
      data[index + 1] = amplitude * Math.sin(phase);
      omegas[m * n + ix] = dispersionOmega(kMagnitude);
    }
  }
  return { data, omegas, resolution: n };
}

/** 一维迭代 radix-2 FFT（自然序输出；length 为 2 的幂；交错复数，
 * stride = 复元素的 float 槽距【相邻复元素 = 2 个 float】；不做归一化——
 * 调用方按需除以 length）。 */
function fft1d(data: Float32Array, offset: number, length: number, stride: number, inverse: boolean): void {
  for (let i = 0, j = 0; i < length; i += 1) {
    if (i < j) {
      const a = offset + i * stride;
      const b = offset + j * stride;
      const re = data[a];
      const im = data[a + 1];
      data[a] = data[b];
      data[a + 1] = data[b + 1];
      data[b] = re;
      data[b + 1] = im;
    }
    let bit = length >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j |= bit;
  }
  for (let len = 2; len <= length; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < length; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < len / 2; k += 1) {
        const even = offset + (i + k) * stride;
        const odd = offset + (i + k + len / 2) * stride;
        const tRe = curRe * data[odd] - curIm * data[odd + 1];
        const tIm = curRe * data[odd + 1] + curIm * data[odd];
        data[odd] = data[even] - tRe;
        data[odd + 1] = data[even + 1] - tIm;
        data[even] += tRe;
        data[even + 1] += tIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

/** 就地归一化（除以 length，交错复数）。 */
function normalizeComplexRange(data: Float32Array, offset: number, length: number): void {
  for (let i = 0; i < length; i += 1) {
    data[offset + i * 2] /= length;
    data[offset + i * 2 + 1] /= length;
  }
}

export interface FFTOceanSnapshot {
  /** 高度网格（row-major，长度 resolution²）。 */
  readonly heights: Float32Array;
  readonly resolution: number;
}

/**
 * CPU 参照海面：静态谱 + 时间演化相位 → 2D IFFT 高度网格。
 * 行/列分离 radix-2（GPU Stockham 蝶形的快速对照）。
 */
export function fftOceanSnapshot(
  spectrum: ComplexGrid,
  domainMeters: number,
  timeSeconds: number,
): FFTOceanSnapshot {
  const n = spectrum.resolution;
  // 演化相位 e^{iωt} 逐 bin 施加（复制，不改静态谱）。
  const evolved = new Float32Array(spectrum.data);
  for (let m = 0; m < n; m += 1) {
    const kz = binWaveNumber(m, n, domainMeters);
    for (let ix = 0; ix < n; ix += 1) {
      const kx = binWaveNumber(ix, n, domainMeters);
      const omega = dispersionOmega(Math.hypot(kx, kz));
      const angle = omega * timeSeconds;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const index = (m * n + ix) * 2;
      const re = evolved[index] * cos - evolved[index + 1] * sin;
      const im = evolved[index] * sin + evolved[index + 1] * cos;
      evolved[index] = re;
      evolved[index + 1] = im;
    }
  }
  // 2D IFFT：行（stride=1 复数, 长度 n）再列（stride=n）。
  for (let row = 0; row < n; row += 1) {
    const rowFloat = row * n * 2;
    fft1d(evolved, rowFloat, n, 2, true);
    normalizeComplexRange(evolved, rowFloat, n);
  }
  for (let col = 0; col < n; col += 1) {
    // 列的复元素 float 槽距为 2n——先抽到连续缓冲再变换。
    const column = new Float32Array(n * 2);
    for (let r = 0; r < n; r += 1) {
      column[r * 2] = evolved[(r * n + col) * 2];
      column[r * 2 + 1] = evolved[(r * n + col) * 2 + 1];
    }
    fft1d(column, 0, n, 2, true);
    normalizeComplexRange(column, 0, n);
    for (let r = 0; r < n; r += 1) {
      evolved[(r * n + col) * 2] = column[r * 2];
      evolved[(r * n + col) * 2 + 1] = column[r * 2 + 1];
    }
  }
  const heights = new Float32Array(n * n);
  for (let i = 0; i < heights.length; i += 1) heights[i] = evolved[i * 2];
  return { heights, resolution: n };
}

/**
 * 船体稀疏水高查询（独立参照/运行查询）：逐点逆 DFT——
 * h(x,z,t) = (1/N²)·Σ Re[H(k)·e^{i(ωt + k·x)}]。
 * 无整纹理读回；单点 O(N²)。
 */
export function fftOceanHeightAt(
  spectrum: ComplexGrid,
  domainMeters: number,
  timeSeconds: number,
  worldX: number,
  worldZ: number,
): number {
  const n = spectrum.resolution;
  let sum = 0;
  for (let m = 0; m < n; m += 1) {
    const kz = binWaveNumber(m, n, domainMeters);
    for (let ix = 0; ix < n; ix += 1) {
      const kx = binWaveNumber(ix, n, domainMeters);
      const omega = dispersionOmega(Math.hypot(kx, kz));
      const phase = omega * timeSeconds + kx * worldX + kz * worldZ;
      const index = (m * n + ix) * 2;
      sum += spectrum.data[index] * Math.cos(phase) - spectrum.data[index + 1] * Math.sin(phase);
    }
  }
  return sum / (n * n);
}

/** 有效波高 Hs = 4·std(h)（空间统计）。 */
export function significantWaveHeight(heights: Float32Array): number {
  let mean = 0;
  for (const h of heights) mean += h;
  mean /= heights.length;
  let variance = 0;
  for (const h of heights) variance += (h - mean) ** 2;
  return 4 * Math.sqrt(variance / heights.length);
}


/**
 * GPU pass 序列的纯 TS 镜像（#2121）：与 fft-ocean-surface 的着色器逐 pass 同
 * 公式（演化 → 每轴位反转置换 → span 递增蝶形【twiddle 乘奇位输入：偶位输出
 * = even + t，奇位输出 = even − t】→ 单次 /N²）。为 GPU 公式提供可测试验证
 * （与 fftOceanSnapshot/逐点逆 DFT 两独立路径互证）。
 */
export function fftOceanGpuStages(
  spectrum: ComplexGrid,
  timeSeconds: number,
): FFTOceanSnapshot {
  const n = spectrum.resolution;
  const data = new Float32Array(n * n * 2);
  for (let i = 0; i < n * n; i += 1) {
    const angle = spectrum.omegas[i] * timeSeconds;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    data[i * 2] = spectrum.data[i * 2] * c - spectrum.data[i * 2 + 1] * s;
    data[i * 2 + 1] = spectrum.data[i * 2] * s + spectrum.data[i * 2 + 1] * c;
  }
  const stages = Math.round(Math.log2(n));
  const reverseBits = (value: number, bits: number) => {
    let result = 0;
    for (let b = 0; b < bits; b += 1) {
      result = (result << 1) | (value & 1);
      value >>= 1;
    }
    return result;
  };
  const scratch = new Float32Array(n * n * 2);
  const permuteAxis = (horizontal: boolean) => {
    for (let m = 0; m < n; m += 1) {
      for (let ix = 0; ix < n; ix += 1) {
        const sourceAxis = reverseBits(horizontal ? ix : m, stages);
        const source = horizontal ? m * n + sourceAxis : sourceAxis * n + ix;
        const target = m * n + ix;
        scratch[target * 2] = data[source * 2];
        scratch[target * 2 + 1] = data[source * 2 + 1];
      }
    }
    data.set(scratch);
  };
  permuteAxis(true);
  for (let pass = 0; pass < stages * 2; pass += 1) {
    const horizontal = pass < stages;
    if (pass === stages) permuteAxis(false);
    const span = Math.pow(2, (pass % stages) + 1);
    const half = span / 2;
    for (let m = 0; m < n; m += 1) {
      for (let ix = 0; ix < n; ix += 1) {
        const axisN = horizontal ? ix : m;
        const fixed = horizontal ? m : ix;
        const isEven = axisN % span < half;
        const partnerAxis = isEven ? axisN + half : axisN - half;
        const self = m * n + ix;
        const partner = horizontal ? fixed * n + partnerAxis : partnerAxis * n + fixed;
        const aRe = data[self * 2];
        const aIm = data[self * 2 + 1];
        const bRe = data[partner * 2];
        const bIm = data[partner * 2 + 1];
        const j = axisN % half;
        const angle = (2 * Math.PI * j) / span;
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        if (isEven) {
          const tRe = bRe * c - bIm * s;
          const tIm = bRe * s + bIm * c;
          scratch[self * 2] = aRe + tRe;
          scratch[self * 2 + 1] = aIm + tIm;
        } else {
          const tRe = aRe * c - aIm * s;
          const tIm = aRe * s + aIm * c;
          scratch[self * 2] = bRe - tRe;
          scratch[self * 2 + 1] = bIm - tIm;
        }
      }
    }
    data.set(scratch);
  }
  const heights = new Float32Array(n * n);
  for (let i = 0; i < heights.length; i += 1) heights[i] = data[i * 2] / (n * n);
  return { heights, resolution: n };
}
