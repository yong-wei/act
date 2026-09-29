'use client';

import FFTOceanComparisonClient from './comparison-client';
import type { ComparisonBackend, ComparisonSceneId, ComparisonFftResolution, ComparisonLod } from './comparison-lab';

/** 两个入口只选择数据后端，场景、交互、光学和 QA 全部共用。 */
export default function WebGpuComparisonClient(props: {
  backend: ComparisonBackend;
  scene: ComparisonSceneId;
  resolution?: ComparisonFftResolution;
  lod?: ComparisonLod | null;
  failAsset?: boolean;
}) {
  return <FFTOceanComparisonClient {...props} api="webgpu" />;
}
