## Context

当前生成接口同步构造固定模板题并写入进程内 Map，返回字段却称 `ai_generated`。它适合作为低风险临时练习原型，不具备生成溯源、重启持久性、内容审核和目录发布能力。新设计必须在保留临时练习边界的同时建立独立候选流水线。

## Goals / Non-Goals

**Goals:**

- 对模板、AI 和人工候选使用真实、可验证的 generation kind。
- 建立持久候选、预检、人工审核、发布和退役状态机。
- 让已批准生成题通过现有 catalog/release 进入运行时并保留答题快照。

**Non-Goals:**

- 不允许运行时请求直接产生正式题或标准答案。
- 不让模型、规则或生成者批准自己的候选。
- 不在公开报告保存 prompt、原始模型响应、学生数据或密钥。

## Decisions

1. **候选与已发布题目分域。** 候选状态至少包括 draft、precheck-failed、awaiting-human-review、approved、rejected、published、retired；只有 published 才生成 catalog item。
2. **完整生成包络是不可变审计输入。** 保存 provider/model/config、prompt template version、知识来源 refs/hashes、生成参数、候选内容 hash 和父候选 revision；敏感原文进入受限存储，公开记录只保留摘要身份。
3. **自动预检不能批准。** 确定性检查和模型辅助审核只产生 findings/suggestions；独立人工 reviewer 决定答案、干扰项、目标/节点、难度、阶段和发布资格。
4. **发布生成新 catalog release。** 已批准候选经版本化 exporter 写入治理目录并产生 publication receipt；不得原地更新已被答题引用的内容。
5. **兼容迁移显式处理错误 source。** API 新增 `generationKind` 和版本；旧 `source` 在过渡期返回 truthful legacy discriminator 并发布弃用说明，禁止继续把模板称为 AI。

## Risks / Trade-offs

- [模型/提示配置泄露] → 分离私有生成记录与公开治理摘要，日志和报告只含哈希与 provider identity。
- [人工审核积压] → 按学习目标/阶段分片工作队列，但不降低批准门槛。
- [候选修订覆盖历史] → append-only revision 与 publication receipt，发布后修改必须创建新候选和新内容 hash。
- [生成题质量波动] → 先 shadow publication，按来源/模型统计拒绝和漂移，不自动进入高风险阶段。

## Migration Plan

1. 先纠正模板接口 discriminator 并保持低风险 practice 行为。
2. 引入候选持久化、状态机和预检，不接入运行时。
3. 增加人工审核与 catalog exporter，发布 shadow release。
4. 通过目录、答题快照和生产资格验证后，再按阶段授权生成题来源；回滚只停止新发布，不改写历史题目。

## Open Questions

- 首个真实 AI provider/model 不在规范中固定，由平台 AI 设置和发布策略选择并写入每个候选包络。
