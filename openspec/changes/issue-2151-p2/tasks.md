# Tasks: issue-2151-p2

## 1. 能力预检模块

- [ ] 1.1 新建 `src/resources/simulations/lib/simulation-capability.ts`：`probeGraphicsCapability`（离屏真实上下文探测，webgpu→webgl）、`probeModelCapability`（复用 runtime preload）、`classifyGraphicsFailure`（context-unavailable / device-lost / init-defect），结果缓存与显式覆盖保留
- [ ] 1.2 单测：分类表全分支、缓存行为、探测失败不抛出

## 2. MarineCanvas 三态与失败面板

- [ ] 2.1 合成三态 `preparing-model / preparing-graphics / runnable`，`data-marine-status` 暴露；准备文案区分模型与图形
- [ ] 2.2 失败面板：分类学生文案 + 支持环境说明 + 恢复建议 + `<details>` 诊断折叠（原始异常与 backend）；`role="alert"` 保留
- [ ] 2.3 `onDeviceLost` 归入 `device-lost` 分类并显示"进度已保留"提示；失败面板不遮挡侧栏关键按钮
- [ ] 2.4 单测：失败面板分类渲染、诊断折叠存在、三态属性

## 3. 开始门控与状态一致

- [ ] 3.1 共享控制区接入 `runtimeReady && graphicsReady` 门控：未就绪禁用开始并显示对应状态徽章（destroyer 既有 runtimeReady 接入门控；六船经共享面板统一）
- [ ] 3.2 断言测试：零采样运行不得产生步骤完成态（沿用既有提交约束）
- [ ] 3.3 保持性验证：Canvas 失败/设备丢失不触发步骤记录与草稿清空（记录在案，必要时补测试）

## 4. 布局、命名与语言

- [ ] 4.1 抽查修复"参数一/参数二"类可访问名称为"物理量（单位）"（共享面板 + destroyer/LNG 已知点）
- [ ] 4.2 LNG 航速读数双单位并列显示（kn 与 m/s）
- [ ] 4.3 学生视图隐藏 `ai_data`、`engineering-target` 等内部标识（移入诊断折叠/教师侧文案，覆盖仿真侧栏已知出现点）
- [ ] 4.4 1366×768 手动核对：任务目标、控制、曲线、提交可定位；失败提示不遮挡

## 5. 验证与交付

- [ ] 5.1 `rtk npm run typecheck` 零错误；仿真相关 vitest 全绿
- [ ] 5.2 dev 手动验收记录（PR 内）：正常流程、WebGL 不可用、device lost、1366×768 对照
- [ ] 5.3 复核"运行检查页"等静态说明与七船目录一致性措辞
- [ ] 5.4 `openspec validate issue-2151-p2 --strict` 通过后随实现同 PR 交付
