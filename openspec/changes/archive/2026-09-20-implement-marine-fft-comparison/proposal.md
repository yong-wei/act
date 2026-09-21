# 补齐可运行FFT海面及真实同场景比较

## Why

#2105归档的是评估框架；任务2/3/4仍未完成，报告全部未测，run-spectral-evaluation.ts只写空模板。需要完成原计划实验本身，而非继续增加证据完备性判断。

## What Changes

- 实际运行的WebGL GPU FFT海面和适用的WebGPU FFT候选，保留Gerstner基线。
- 同船模/镜头/光照/材质/像素负载下可切换并实际运行的实验入口。
- 真正采集画质、频谱统计、查询与性能结果及浏览器/许可信息，给出有依据的采用建议。

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `marine-spectral-evaluation`: 可运行候选、真实比较与结果消费。

## Impact

沿用已有spectral-evaluation数据结构与QA/性能入口；实验后端与生产默认隔离。基线fe951b7。详见[审计](../../../docs/research/2026-09-20-marine-series-completion-audit.md)。

## Non-goals

不自动切换生产renderer，不强迫FFT胜出，不把空报告的keep-current-path当成实验完成；不新建第四套评估/证据框架。
