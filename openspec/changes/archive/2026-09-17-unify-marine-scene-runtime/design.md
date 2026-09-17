# 统一海洋场景运行契约与接线基座 — 设计

基线：`37a988f5928d73c2af7eabad57284a771c9d3519`。共同依据与上游来源：[研究报告](../../../docs/research/2026-09-17-marine-environment.md)。所有性能/误差数值为待验证目标。

## 决策

沿用现有 `scene/` 与模型加载链，新增最小共同契约，不新增第二套状态管理器。建议快照包含 worldPose、renderOrigin、simulationTime、visualTime、advancing、playbackRate、环境参数、画质参数和语义执行器；字段命名可按仓库约定收敛，责任边界不可省略。

先生成一份 frame snapshot，再消费于水、船、尾迹、线、灯。原点只影响显示坐标；数值轨迹、world-space 环境物、历史尾迹不受影响。海浪相位必须补偿 origin；不能把跟船网格的局部位置当作波场坐标。

保留固定步长 SimulationClock/Rust-WASM。visualTime 独立于物理推进，但同帧唯一；默认暂停下环境可继续，推进/发射服从 advancing，回放与 QA 可以注入确定时间。reset/seek 对波场、泡沫和尾迹有同一 epoch；不能一个模块清空而另一个保留上轮历史。

姿态所有权按 heave/pitch/roll 分别为 telemetry、visual-water 或 fixed。邮轮横摇等数值自由度保持只读，不新增视觉同轴摇摆。基础海况和所有权不随 quality 改变；光照预设与教学扰动隔离。

环境配置分默认值、WeatherPreset、SceneLayout 的允许覆盖及渲染质量预算；质量只改表现成本。使用现有 modelToSceneMatrix、设计水线、语义节点，不做二次 bbox 缩放或坐标补偿。

## 边界

只提供装配基座、契约和兼容接线，不提前实现 FFT、完整光学或全舰迁移。不改未完成的船包接收/OSS 发布变更。为后续水面重定位保留旧采样行为适配，不在本项声称解决欠采样。

## 验证

确定性快照/时间/重置测试，world-local round trip、heading 适配和 DOF 所有权测试；055 启停/倍速/拖拽镜头/模型 LOD 不回归。基线记录当前新船包、画布像素数和真实硬件，不以软件 CI 验收性能。
