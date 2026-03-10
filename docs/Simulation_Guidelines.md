# 仿真规范说明（统一框架）

本规范用于指导后续新增或改造仿真互动环节，统一时间步进、模型接口与控制器调用方式，保证可比的性能表现与可维护性。

## 1. 统一目标
- 统一时间步长与推进策略，避免不同模块数值不一致。
- 线性系统统一采用 Tustin 离散化；非线性系统走统一积分器。
- 控制器与对象模型解耦，便于复用与升级。
- 统一记录指标与轨迹，便于后续评估与对比。

## 2. 统一内核与基础类型
统一仿真内核位于 `src/lib/simulation/`：
- `SimulationClock`：固定步长时钟 + accumulator。
- `TransferFunctionModel` / `StateSpaceModel` / `NonlinearModel`：统一模型类型。
- `discretizeTransferFunctionTustin` / `discretizeStateSpaceTustin`：线性离散化。
- `createLinearPlant` / `createNonlinearPlant`：统一对象封装。

类型入口：`src/lib/simulation/types.ts`。

## 3. 时间步进规范
统一采用固定步长推进，推荐参数：
- `dt = 1 / 60`
- `maxSubSteps = 6`

示例（requestAnimationFrame 驱动）：
```ts
const clockRef = useRef(new SimulationClock({ dt: 1 / 60, maxSubSteps: 6 }));
const lastTimeRef = useRef(0);

const loop = (timestamp: number) => {
  if (lastTimeRef.current === 0) lastTimeRef.current = timestamp;
  const frameDelta = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
  lastTimeRef.current = timestamp;

  clockRef.current.advance(frameDelta, (dt) => {
    // 这里是固定步长逻辑
    stepSimulation(dt);
  });

  requestAnimationFrame(loop);
};
```

注意事项：
- 禁止 `setInterval` 或直接使用可变 `delta` 作为仿真步长。
- 暂停/重置时需调用 `clockRef.current.reset()` 清空 accumulator。

## 4. 线性模型调用规范（Tustin）
优先使用传递函数或状态空间统一建模。

传递函数示例：
```ts
const model: TransferFunctionModel = {
  type: 'transfer_function',
  numerator: [K],
  denominator: [T, 1],
  delay: 0.2,
  params: { K, T },
};
const plant = createLinearPlant(model, { dt: 1 / 60 });
const output = plant.step(u);
```

状态空间示例：
```ts
const model: StateSpaceModel = { type: 'state_space', A, B, C, D, delay: 0.1 };
const plant = createLinearPlant(model, { dt: 1 / 60 });
```

要求：
- 线性模型离散化统一使用 Tustin（内部自动处理）。
- 延时统一用 `delay` 字段（秒）。

## 5. 非线性模型调用规范
非线性模型需提供状态导数函数；输出函数可选。

```ts
const model: NonlinearModel = {
  type: 'nonlinear',
  stateSize: 2,
  inputSize: 1,
  outputSize: 1,
  derivatives: (x, u) => [x[1], -0.5 * x[1] - x[0] + u[0]],
  output: (x) => [x[0]],
};
const plant = createNonlinearPlant(model, { dt: 1 / 60, solver: 'runge_kutta_4' });
```

要求：
- 积分器统一使用 `euler` 或 `runge_kutta_4`。
- 时间推进仍由 `SimulationClock` 统一控制。

## 6. 控制器接口规范
控制器应与对象模型解耦，输入/输出明确，推荐统一函数签名：
```ts
type ControllerStep = (state: {
  t: number;
  y: number;
  r: number;
  e: number;
  dt: number;
}) => number;
```

建议：
- 控制器输出 `u` 后再做限幅/滤波，避免在控制器内部耦合对象细节。
- 所有控制器输出应基于固定步长 `dt`。

## 7. 指标与轨迹记录
- 记录间隔建议 `recordInterval = 0.05s`。
- 统一记录：`time / inputs / outputs / states`。
- 输出指标建议包含：超调、稳态误差、调节时间、能耗积分等。

## 8. 模块选择与复用
- 教学互动（非 3D）：优先使用 `useControlSystem` Hook。
- 复杂船舶/物理 3D：使用 `createSimulationEngine` + `SimulationClock` 驱动。
- 控制商店/控制器统一放在 `src/resources/` 内按业务域组织。

## 9. 禁止项
- 禁止使用可变 `delta` 直接作为步长。
- 禁止在控制器中直接访问对象内部状态（需经统一接口）。
- 禁止绕过 `SimulationClock` 自行累积时间。

## 10. 规范入口
规范入口：`docs/Simulation_Guidelines.md`。
