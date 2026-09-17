# 增加可信海域、港湾、作业区与极地环境预设

## Why

仅换天空颜色无法给船模提供工程尺度和空间层次；不同船型需要有节制的真实环境物，但不能复制渲染栈或改变教学任务。

## What Changes

- 分离天气预设与世界场景布局，使用允许覆盖的统一配置。
- 近景真实几何、远景 LOD/实例化/受限 impostor，世界锚定。
- 按场景提供岸线/水深、极地冰和施工浑浊表达，保持视觉边界。

## Capabilities

### New Capabilities

- `marine-scene-environments`: 增加可信海域、港湾、作业区与极地环境预设。

### Modified Capabilities

None. Existing shared visual-pipeline invariants remain in force.

## Impact

演进现有 `src/resources/simulations/scene/` 及必要的 profile/挂载适配；细节见 design。代码调查基线 `37a988f5928d73c2af7eabad57284a771c9d3519`。共同依据见[研究与技术裁决](../../../docs/research/2026-09-17-marine-environment.md)。

## Non-goals

本项不改 Rust/WASM 物理模型、控制器、评分、模型资产发布链或生产部署。不新增第二套通用仿真/状态框架。不在本项引入 WebGPU 强制迁移或全海域流体求解。
