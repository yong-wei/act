# Tasks

- [x] 1. 指标纯函数模块 `adaptive-path-differentiation.ts`：7 项两两指标计算与达标判定（Jaccard/TVD/顺序/时长/检查点结构/核心节点差），单测覆盖边界与阈值
- [x] 1.1 批次装配接入两两计算并持久化 metadata.differentiation（含 highDifferentiation 门禁与共享先修节点剔除）；策略映射与 strategy 元数据落到可序列化选项（进行中任务 2 的元数据部分）
- [x] 2. 三策略语义装配：族→策略映射常量、偏好占比 <60% 补充轮、simulation-driven 仿真/Arena 支持分支、候选携带 strategy 观察字段（含 preferredTypeShare/weaknessResourceCount/comprehensiveTaskCount 与 portrait-v2 优势维度）；画像不可用标记 generic
- [ ] 2.1 单变量对照测试：小 registry 触发族重叠裁剪，需导出三族幸存 fixture（assemble-plan.test.ts 嵌套 buildAlternativeCoreFixtureRegistry）后启用（当前 it.skip）
- [x] 3. 资源→Runtime 对象键 resolver 与批次定稿读取验证（manifest 命中+期望校验值记录，失败/缺失如实状态），验证记录持久化至 metadata.objectKeyReadRecords；字节级网关读取与失败剔除的端到端验收随任务 7 落地
- [ ] 3.1 读验证失败资源从覆盖/区分度统计剔除的策略落地（当前记录状态，未影响统计）
- [ ] 4. 批次两两指标计算、持久化与 `highDifferentiation` 门禁标记；响应返回指标；不复制路径凑数
- [ ] 5. 候选比较呈现：策略、画像依据、核心节点/资源、Runtime 读取状态、两两差异摘要（经 student-safe 投影三处审计）
- [ ] 6. 受控画像 fixture 与单变量对照测试（薄弱点/偏好/优势三组）+ 故障注入测试
- [ ] 7. 验收脚本产出证据包（界面证据、对比表、三组指标、对照结果、读取记录、故障注入、一致性报告）
- [ ] 8. 回归：typecheck、相关 vitest 套件、OpenSpec strict、验收脚本本地执行
