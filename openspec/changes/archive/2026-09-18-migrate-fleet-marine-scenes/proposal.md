# 将全部七类海洋仿真迁入统一环境架构

## Why

共用部分组件仍可能保留不同水高/太阳/姿态接线。最终交付必须是七个实际入口使用同一栈，而不只是 055 演示页升级。

## What Changes

- 迁移七船型实际运行入口与课程嵌入消费者，只保留 profile/任务适配层。
- 保留已存在的相机、UI、播放、模型加载与教学能力。
- 清理已证实无调用的旧实现，完成全船型视觉/数值验收。

## Capabilities

### New Capabilities

- `marine-fleet-rollout`: 将全部七类海洋仿真迁入统一环境架构。

### Modified Capabilities

None. Existing shared visual-pipeline invariants remain in force.

## Impact

演进现有 `src/resources/simulations/scene/` 及必要的 profile/挂载适配；细节见 design。代码调查基线 `37a988f5928d73c2af7eabad57284a771c9d3519`。共同依据见[研究与技术裁决](../../../docs/research/2026-09-17-marine-environment.md)。

## Non-goals

本项不改 Rust/WASM 物理模型、控制器、评分、模型资产发布链或生产部署。不新增第二套通用仿真/状态框架。不在本项引入 WebGPU 强制迁移或全海域流体求解。
