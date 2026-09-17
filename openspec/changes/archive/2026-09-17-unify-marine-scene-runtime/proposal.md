# 统一海洋场景运行契约与接线基座

## Why

共享场景模块已经存在，但局部/世界坐标、多个显示时钟、水线基准和姿态所有权仍不统一；必须先给后续海面与环境模块一套可复用的输入，且不另起仿真主干。

## What Changes

- 演进 scene/types、既有 Provider 和场景装配，统一逐帧只读快照、世界原点和时钟政策。
- 声明每个运动自由度的数据所有者及环境/布局/质量参数边界。
- 增加可注入时间和种子的既有 QA 入口；先挂 055 垂直切片并验证旧功能不变。

## Capabilities

### New Capabilities

- `marine-scene-runtime`: 统一海洋场景运行契约与接线基座。

### Modified Capabilities

- `simulation-scene-visual-pipeline`: 明确共享波场只拥有展示性运动自由度，数值所有权优先。

## Impact

演进现有 `src/resources/simulations/scene/` 及必要的 profile/挂载适配；细节见 design。代码调查基线 `37a988f5928d73c2af7eabad57284a771c9d3519`。共同依据见[研究与技术裁决](../../../docs/research/2026-09-17-marine-environment.md)。

## Non-goals

本项不改 Rust/WASM 物理模型、控制器、评分、模型资产发布链或生产部署。不新增第二套通用仿真/状态框架。不在本项引入 WebGPU 强制迁移或全海域流体求解。
