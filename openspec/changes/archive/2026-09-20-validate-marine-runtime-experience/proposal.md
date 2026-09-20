# 补齐真实运行验收并修正性能采集与常开QA开销

## Why

原系列归档说明明确留下真实浏览器走查/硬件测试；当前探针可能选错首个canvas，过滤前台1秒以上卡顿，GPU计时未执行。055还在普通运行每帧遍历模型做QA。不能仅新增证据结构后再次归档。

## What Changes

- 将现有采集绑定实际R3F renderer，修正长帧/预热/后台口径及可用时的异步GPU计时。
- 门控普通运行不需要的逐帧QA遍历，实际落实画质降级、资源寿命和总预算。
- 在真实高精船模与教学图表同屏时完成七入口动态检查、性能/资源A/B并修复发现的有界问题。

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `marine-render-performance`: 实际运行采集和默认成本控制。
- `marine-fleet-rollout`: 实际入口的动态验收。

## Impact

现有quality/probe、相关模型观测和测试脚本；不新建质量或证据框架。基线fe951b7。[证据](../../../docs/research/2026-09-20-marine-series-completion-audit.md)。

## Non-goals

不全站重构、不全量Runtime导出/哈希、不改控制或评分。软件渲染或mock数值不能替代目标硬件；测试缺设备时明确未测，不把空报告视为完成。
