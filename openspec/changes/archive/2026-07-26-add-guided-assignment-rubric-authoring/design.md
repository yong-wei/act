## Context

The optional detailed rubric defined by `revise-assignment-rubric-contract` can contain multiple level guidelines. AI assistance may fill those guidelines, but it must not silently invent the underlying score structure, overwrite teacher work, or proceed without any usable grading context.

## Goals / Non-Goals

**Goals:**

- Generate one complete set of level scoring guidelines from teacher-provided context.
- Prefer the general scoring standard and provide an explicit recovery path when it is absent.
- Require confirmation before replacing any existing level guideline.
- Validate and apply generated output atomically to the current scoring-item revision.

**Non-Goals:**

- 不新增、删除、重命名、重排评价级别，也不修改级别分值。
- 不生成题目、参考答案、评分项名称、通用评分标准或发布状态。
- 不改变评分细则发布条件或分数算法。

## Decisions

### 1. 生成输入只包含当前评分项的最小上下文

请求绑定 assignment draft revision、question id、scoring-item id 和 level ids。生成依据优先为评分标准；缺失时对话框允许补充并保存评分标准，或显式忽略后使用评分项名称。两者均空时客户端与服务端都拒绝。

### 2. 生成结果覆盖整组评分准则

AI 返回每个当前 level id 对应的一条评分准则，服务端验证集合完整、没有未知或重复 id、字段长度受限。只有全部有效时一次性应用，避免部分级别新旧混合。

### 3. 已有内容触发覆盖确认

任一级别评分准则非空即视为已有内容。确认对话框明确说明将覆盖全部级别准则；取消不发送生成请求。生成期间 rubric 结构改变时，以修订冲突拒绝应用。

### 4. AI 结果仍是教师可编辑草稿

生成结果写入作业草稿普通字段，经过既有保存、冲突和发布校验；不会直接发布或触发评分。

## Risks / Trade-offs

- [生成期间评价级别改变] → 使用草稿修订和 level id 集合做乐观并发校验。
- [模型返回遗漏或多余级别] → schema 校验整组失败，不部分写入。
- [教师误以为 AI 结果已发布] → 结果保持普通草稿状态并沿用保存状态提示。
- [忽略评分标准导致依据偏弱] → 对话框明确说明将使用评分项名称，且必须由教师主动选择。

## Migration Plan

1. 在新版评分细则稳定后增加生成 API schema 和授权/限流。
2. 接入缺失评分标准对话框、覆盖确认和整组应用。
3. 以功能开关启用并收集失败原因，不改变没有该功能时的手工填写路径。
4. 回滚只移除 AI 入口，已生成并保存的评分准则仍是普通教师可编辑内容。

## Open Questions

- 无；模型供应商选择沿用平台现有 AI 配置，不在本 change 扩展。

