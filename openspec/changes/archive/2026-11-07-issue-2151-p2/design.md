# Design: issue-2151-p2

## 1. 现状事实（侦察结论）

- `marine-canvas.tsx`（60 行）已有 WebGPU→WebGL 双回退、`RendererBoundary`、`onDeviceLost`；但失败分支直接透出原始异常字符串（`海面场景初始化失败：{raw}`），无分类、无建议、无诊断收纳；`api === null` 时仅"正在准备海面场景…"，不区分模型（WASM）与图形。
- 七船（destroyer + 六船同构）数值 `SimulationClock` 循环都在 `MarineCanvas` 的场景子组件内；Canvas 失败即数值停摆——现网"按钮显示运行、仿真时间 0.0s"即此脱节的表现。
- destroyer 场景已有 `runtimeReady`（`preloadVirtualSimulationRuntime`）状态但未接入开始门控；六船依赖 `use-vessel-experiment`，亦无图形就绪门控。
- 全仓无 WebGL/WASM 能力预检模块。

## 2. 方案

### 2.1 能力预检模块 `src/resources/simulations/lib/simulation-capability.ts`

- `probeGraphicsCapability()`：在离屏 canvas 上真实创建上下文（复用 `createMarineRenderer` 的探测路径），返回 `{ ok, backend: 'webgpu'|'webgl', reason? }`；结果模块级缓存；`?graphics=webgl|webgpu` 显式覆盖行为保留。
- `probeModelCapability()`：复用 `preloadVirtualSimulationRuntime()`，返回 `{ ok, reason? }`。
- 纯函数分类器 `classifyGraphicsFailure(error)`：`context-unavailable`（环境不支持）/ `device-lost`（运行中丢失）/ `init-defect`（代码缺陷），供 UI 与测试消费。

### 2.2 MarineCanvas 三态与失败 UI

- 三态：`preparing-model` / `preparing-graphics` / `runnable`（由 capability 结果 + 渲染器创建结果合成），`data-marine-status` 属性暴露给测试。
- 失败面板：学生文案（按分类）、支持环境说明（WebGL2 或 WebGPU、常见浏览器版本）、恢复建议（更换浏览器/启用硬件加速/联系教师）；`<details>` 折叠原始异常与 backend 标识（诊断用）；不显示开始相关引导。
- `onDeviceLost` 走 `device-lost` 分类：保留外层实验状态（步骤/草稿在 session 层，本就不随 Canvas 卸载丢失——补一条保持性测试），显示"进度已保留"。

### 2.3 开始门控与状态一致性

- 共享面板/控制区在 `runtimeReady && graphicsReady` 前：开始按钮 `disabled` + 状态徽章"模型准备中…/图形准备中…/不可运行（见说明）"。
- 仿真时钟与采样计数由既有场景状态驱动（不新增第二时间源）；提交校验沿用"未运行不能提交"，零采样运行不产生完成态（现状已约束，补断言测试）。

### 2.4 布局与语言最小面

- 失败面板绝对定位不遮挡侧栏关键按钮（`pointer-events` 区域隔离）。
- 抽查修正可访问名称：ControlPanel/参数滑杆的 `aria-label` 用"物理量（单位）"（首版覆盖共享面板与 destroyer/LNG 的已知"参数一/参数二"）；LNG 航速双单位显示（kn 与 m/s 等价并列）。
- 学生视图隐藏 `ai_data`、`engineering-target` 等内部标识（改到诊断折叠或教师侧文案）；首版覆盖仿真侧栏已知出现点。

### 2.5 明确边界

图形不可用：显示停止面板 + "进度已保留，请在支持 WebGL2/WebGPU 的浏览器继续"，不启动数值（数值在场景内，Canvas 失败即不挂载——与现状一致，但状态与文案诚实）。数值与渲染解耦留给 #2147。

## 3. 验证

- 单测：`classifyGraphicsFailure` 分类表；capability 结果缓存；失败面板渲染（分类文案/诊断折叠存在）；零采样不完成的既有约束断言。
- 手动验收（记录在 PR）：WebGL 正常流程（开始—曲线—暂停—提交）；`?graphics=webgl` + Chrome `--disable-webgl` 模拟不可用；DevTools 强制 device lost 场景；1366×768 视口对照截图。
- 回归：`rtk npm run typecheck`、仿真相关 vitest、七船页面 dev 冒烟。
