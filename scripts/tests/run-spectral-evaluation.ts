/**
 * #2105 频谱后端评估采集入口：同材质/镜头/船模/像素数的公平比较数据落盘。
 *
 * 运行（在真实浏览器页面 + ?qa=marine-performance 下，由人工/Playwright 触发）：
 *   npx tsx scripts/tests/run-spectral-evaluation.ts <report-json>
 * 本脚本只定型报告骨架与判定（纯函数侧）；浏览器测量字段由 #2103 探针补充后回填。
 */
import { writeFileSync } from 'node:fs';

import {
  evaluateSpectralBackends,
  type SpectralBackendMeasurement,
  type SpectralExperimentControls,
} from '@/resources/simulations/scene/water/spectral-evaluation';

const CONTROLS: SpectralExperimentControls = {
  vesselId: 'type055',
  cameraView: 'chase',
  drawingBufferWidth: 1920,
  drawingBufferHeight: 1080,
  environmentPresetId: 'open-sea',
  seaState: 4,
  foamEnabled: true,
  materialStack: 'shared-gerstner-material',
  fftResolution: 128,
  fftCascades: 1,
};

// 初始骨架：测量字段全 null（未测不冒充实测）；真实硬件运行后回填再评估。
const SKELETON: SpectralBackendMeasurement[] = [
  { backend: 'gerstner-analytic', significantWaveHeightMeters: null, repeatabilityDeltaMeters: null, frameP95Ms: null, firstLoadMs: null, cpuQueryStrategy: 'analytic-closed-form', visualQualityNotes: null },
  { backend: 'webgl-fft', significantWaveHeightMeters: null, repeatabilityDeltaMeters: null, frameP95Ms: null, firstLoadMs: null, cpuQueryStrategy: null, visualQualityNotes: null },
  { backend: 'webgpu-fft', significantWaveHeightMeters: null, repeatabilityDeltaMeters: null, frameP95Ms: null, firstLoadMs: null, cpuQueryStrategy: null, visualQualityNotes: null },
];

const report = evaluateSpectralBackends({
  controls: CONTROLS,
  measurements: SKELETON,
  unresolvedDifferences: [
    'FFT 候选的级联频带覆盖与解析波组的手调频带边界不同（差异不归因给后端）',
    'WebGPU 候选的着色器语言差异（WGSL/TSL）与现有 post 栈兼容性未验证',
  ],
  hardwareContext: null,
});

const out = process.argv[2] ?? 'artifacts/openspec/issue-2105-spectral/evidence/spectral-evaluation-report.json';
writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
console.log(`verdict: ${report.verdict}`);
console.log(`rationale: ${report.rationale}`);
console.log(`output: ${out}`);
