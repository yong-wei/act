# Tasks

- [x] 1. 指标纯函数模块 `adaptive-path-differentiation.ts`：7 项两两指标计算与达标判定（Jaccard/TVD/顺序/时长/检查点结构/核心节点差），单测覆盖边界与阈值
- [x] 1.1 批次装配接入两两计算并持久化 metadata.differentiation（含 highDifferentiation 门禁与共享先修节点剔除）；策略映射与 strategy 元数据落到可序列化选项（进行中任务 2 的元数据部分）
- [x] 2. 三策略语义装配：族→策略映射常量、偏好占比 <60% 补充轮、simulation-driven 仿真/Arena 支持分支、候选携带 strategy 观察字段（含 preferredTypeShare/weaknessResourceCount/comprehensiveTaskCount 与 portrait-v2 优势维度）；画像不可用标记 generic
- [x] 2.1 单变量对照测试：三族幸存 fixture 提取为共享模块（`__tests__/fixtures/alternative-core-fixture.ts`），对照测试启用并通过（偏好切换/薄弱锚定/优势维度切换/无画像 generic，5 断言）；同时修复配额补充轮两处接线缺陷（`__quota_support__` 未进插入管线、带已满足前置的偏好核心节点被排除）
- [x] 3. 资源→Runtime 对象键 resolver 与批次定稿读取验证（manifest 命中+期望校验值记录，失败/缺失如实状态），验证记录持久化至 metadata.objectKeyReadRecords；resolver/verifier 与故障注入单测见 `adaptive-path-oss-provenance.test.ts`
- [x] 3.1 读验证失败资源从覆盖/区分度统计剔除：`computeAdaptivePathBatchDifferentiation` 接受读取记录，state 非 verified 的对象键资源不进核心集统计，`unreadableObjectKeys` 审计清单持久化
- [x] 4. 批次两两指标计算、持久化与 `highDifferentiation` 门禁标记；响应返回指标：`candidateBatch.comparison` 学生安全摘要（每对 satisfiedCount+文案、highDifferentiation、资源读取状态计数）
- [x] 5. 候选比较呈现：strategy 五字段（含 generic 时画像依据剥离）经 student-safe 投影落地 konling 响应、批次快照投影与 center-contracts（path-rounds 不投影候选面，审计确认无需改）；练习页候选比较卡显示学习策略与通用标记；投影测试 6 项（含对象键/规则名不泄露断言）
- [x] 6. 受控画像 fixture 与单变量对照测试（薄弱点/偏好/优势三组）+ 故障注入测试：对照测试覆盖三组单变量切换；故障注入覆盖 verifier missing/forbidden/checksum-mismatch 如实记录、重复键验证去重、读取失败剔除统计
- [x] 7. 验收脚本产出证据包（`scripts/tests/adaptive-path-differentiation-evidence.ts`：三族指标、单变量对照、偏好切换差异、读取验证剔除、投影安全断言）
- [x] 8. 回归：typecheck、相关 vitest 套件、OpenSpec strict、验收脚本本地执行（typecheck EXIT=0；12 套件 570 测试通过；strict valid；验收脚本 PASS 产出 artifacts/openspec/issue-2033-oss/evidence/differentiation-evidence.json）
