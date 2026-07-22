# Arena V2 任务 11：Control Odyssey 与高级工作台边界

> 面向执行代理：Control Odyssey 原系统和高级方法工作台通过适配器接入 Arena，不把所有能力塞进多表征联动 UI。

## 目标

让 Control Odyssey、复合校正、MPC、优化 PID 等任务能够通过 Arena 统一任务、提交、评测和榜单链路接入，同时保持各自工作台边界清晰。

## 依赖

- 任务 06 评测协议已可分发不同方法。
- 任务 07 榜单基于真实提交。

## 触及文件

```text
src/features/arena/workspace-routing.ts
src/resources/interactive-learning/control-odyssey/index.tsx
src/app/actions/control-odyssey.ts
src/features/arena/evaluation/*
src/features/arena/workbenches/block-diagram/*
src/features/arena/workbenches/predictive-control/*
src/features/arena/submissions/controller-artifact-builder.ts
src/features/arena/__tests__/arena-whitebox-evaluation.test.ts
src/features/arena/__tests__/arena-controller-artifact.test.ts
```

## 执行步骤

- [ ] Control Odyssey 页面解析 `arenaTask` 后显示 Arena 挑战条，并限制当前任务对应的 level、tier 或 controller 范围。
- [ ] 原 `submitGameScore` 继续服务 Odyssey 原积分和游戏化系统，不写 Arena 榜单。
- [ ] Odyssey 提交到 Arena 时走 `/api/arena/evaluate` 或 Arena 评测适配器。
- [ ] Odyssey 指标映射：

```text
settlingTime：调节时间；
overshoot：偏离峰值；
steadyStateError：终点误差；
controlEnergy：操作强度。
```

- [ ] 复合校正不塞入多表征工作台，建立或使用 `block-diagram` 工作台边界。第一版参数结构：

```text
prefilterGain
forwardGain
localFeedbackGain
disturbanceCompensation
```

- [ ] MPC 第一版只开放参数化模板：

```text
template = bounded-linear-mpc
predictionHorizon
controlHorizon
outputWeight
controlWeight
terminalWeight
inputLimit
sampleTime
```

- [ ] 优化 PID 第一版只开放权重化模板：

```text
template = bounded-optimized-pid
speedWeight
energyWeight
robustnessWeight
overshootWeight
searchBudget
```

- [ ] 任意代码控制器保持 fail closed：没有外部沙箱验证时不得开放正式评测。
- [ ] `workspace-routing.ts` 根据 task 和 capability 分发到多表征、Odyssey、框图、预测控制、黑箱辨识等入口。

## 验证命令

```bash
rtk npm run test:unit -- src/features/arena/__tests__/arena-whitebox-evaluation.test.ts src/features/arena/__tests__/arena-controller-artifact.test.ts
rtk npm run lint
```

若触及 Odyssey 页面或 action，增加现有 Odyssey 定向测试或页面 smoke。

## 验收条件

- 从 Arena 的 Odyssey 任务进入 Control Odyssey 后，页面知道自己处于 Arena challenge mode。
- Odyssey 原积分、商店、等级、原榜单不受 Arena 提交影响。
- Odyssey 完成结果可作为 Arena submission 进入统一榜单。
- 复合校正、MPC、优化 PID 有明确工作台入口和 artifact 模板。
- 代码控制器在无沙箱时保持不可正式评测。
- 多表征联动工作台不承载不适合它的高级方法。

