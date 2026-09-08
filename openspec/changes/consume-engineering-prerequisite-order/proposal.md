## Why

工程图谱已经提供同一权威快照下的 79 条明确 `prerequisite` 关系，但生产 `planLearningPath` 仅消费资源本地先修字段。图谱上的知识顺序因此没有进入实际路径生成。2026-09-08 用户授权重新设计相关功能，本变更保留工程关系的原始来源，取消先转写为 ACT_TEACHING REQUIRED 才能消费的旧方案。

## What Changes

- 从与教学资源绑定同一 snapshot 的已发布工程 Authority 读取明确、直接的 `prerequisite`，保留 relation ID、端点、snapshot 与工程来源。
- 在现有生产规划管线中，把每个未满足的前驱知识点解析为一组可替代的合格绑定资源，按当前请求排序选择一个代表，再递归处理先修。
- repair、assembly 与解释共同消费请求级派生 registry；不更改全局注册表，不把一个知识点的全部资源变成必修清单。
- 检测环、端点/身份缺失、前置资源缺失与预算不可行；返回真实限制，不输出违反先修的 ready 路径。
- 教学编排关系保留原始强度与来源，不伪造新的 ACT_TEACHING REQUIRED 发布记录。

## Capabilities

### Modified Capabilities

- `act-teaching-prerequisites`：明确工程学习顺序与教学编排的独立来源边界。
- `adaptive-learning-path-planning`：实际生产规划消费工程先修，并在资源替代、完成状态与预算下生成可解释顺序。

## Impact

主要涉及 `src/features/personalization/path-planning/` 及其服务端资源/工程输入适配。资源引用和全类型候选由 `redesign-graph-path-experience` 的统一合同提供，按实际成熟程度吸收 #2046。#2058 已进入基线，无需重新接入 r6。不修改上游 Bundle、不切换运行时指针、不执行生产发布。
