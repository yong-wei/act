## Why

2026-09-03 知识问答仿真实验发现基线组结构契约通过率与综合通过率均为 0%，而内容通过率仍有 90%：当前基线没有接受与功能组相同的篇幅、结构与证据要求，指标存在明显地板效应，实验只能证明"启用契约后模型会遵循契约"，不能公平回答"专用运行时功能是否优于同等强度的普通提示"。同时，生成代码与评分器口径一旦同时更换，就无法区分回答行为变化与评分口径变化（Issue #1900）。

仓库内已有可继承的断点续跑盲审基建（#1820：唯一任务键、原子落盘、独占锁、fail-closed 聚合）与语义别名结构评分器（#1817），但缺少：三臂实验定义、模型回答快照、评分器版本回放与配对差值报告。专用意图/运行时能力目前在 generic-chat 下常开，对照组无法表达"仅关闭专用运行时"。

## What Changes

- 新建知识问答公平基线实验：`plain-baseline`（普通基线）、`enhanced-baseline`（强化提示基线）、`full-feature`（完整功能组）三臂共用同一题库、模型、采样参数、证据上下文与输出预算；强化基线仅缺少专用意图分类、逐单元引用映射、规范 fail-closed 门禁等运行时能力。
- 每臂每题的回答作为固定快照原子落盘、断点续跑；单一命令完整运行生成、评分、（live 时）盲审与汇总。
- 结构评分器支持口径版本：现行语义别名口径 `structure-alias.v1` 与旧式固定标题口径 `structure-strict-title.v0`；回放命令对已保存快照重新评分，不重新调用生成模型。
- 汇总输出每个指标的绝对值、百分点差、配对 95% CI（记录随机种子的确定性 bootstrap）与适用方向；综合指标同时给出分项；生成行为差值与评分器口径差值分开报告。
- 实验 manifest 记录生成修订、评分器修订、题库哈希、模型、采样参数、各臂 prompt 版本与完成状态；不完整运行 fail closed，不产出正式汇总。
- 从 #1820 盲审 store 抽出共享的运行目录内核（锁、原子写、清单漂移检查），盲审与新实验共用同一实现；盲审既有行为与测试基线不变。

## Capabilities

### New Capabilities

- `konling-fair-baseline-replay-evaluation`: 定义知识问答三臂公平实验的臂公平合同、固定回答快照与断点续跑、评分器口径回放、配对差值报告与 fail-closed 溯源合同。

### Modified Capabilities

（无。`konling-blind-audit-evaluation` 的行为合同不变；共享内核抽取是行为保持的重构，以其既有测试套件为门禁。）

## Impact

- 新增 `src/lib/konling-fair-experiment/`（类型、题库、三臂 prompt 组装、store、评分回放、指标、runner、聚合）与 `scripts/konling-fair-experiment/`（fixture / live / replay 入口）。
- `src/lib/konling-study-question-structure.ts` 增加可选评分口径参数，默认行为不变。
- `src/lib/konling-blind-audit/store.ts` 改为复用抽出的共享运行目录内核，导出面与行为不变。
- 产品回答逻辑不改：实验只在脚本侧组装 prompt 与配置，产品默认路径零行为变化。
