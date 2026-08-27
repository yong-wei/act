## Why

当前 StudentCompetencySnapshot、PortraitV2、feature cache、teacher insights 和页面聚合同时承担 snapshot 与 read model 角色。不同路径可能直接扫描 raw events，watermark、revision、input digest 和 current pointer 的语义也不统一。投影失败时若没有保留上一条合格 current，学生、教师和 AI 会把 stale、unknown 当成新鲜零值或重新聚合出不一致结果。

## What Changes

- 明确 `LearningFact` 是事实真源，immutable snapshot 与角色化 current read model 分离。
- 为每次候选投影绑定 processing/state watermark、revision、generation、input digest、qualification、coverage、freshness 和 confidence。
- 通过带 fence 的原子 current-pointer publish，禁止半成品覆盖上一条合格 current；并定义 stale/conflict/unavailable 语义。
- 学生画像、风险、教师看板和 AI/Personalization 只从 LearningFact 派生的受治理 projection/read port 读取，不直接聚合 raw events。
- 公开投影执行角色最小字段、小样本抑制和隐私分类，失败保留上一条 current 并显式标 stale。

## Scope

范围包括 projection envelope、qualification/current pointer、snapshot/read-model boundary、失败和冲突处理、read-port contract 及测试/台账。它不迁移生产数据、不启用 selector、不删除旧 projection；消费者迁移由第四项处理，旧实现 retirement 由第六项处理。

## Dependencies and Coordination

- 依赖 `unify-learning-fact-ingestion-and-projection-trigger` 的 canonical trigger、dedupe、generation 和 processing/state watermark 语义。
- 复用 canonical knowledge identity、trusted-learning-fact-filter、evidence-driven-personalization、student-evidence-status、adaptive-learner-state-service 与 feature-cache specs。
- 保留 `ground-evidence-copilot` 的 server-authorized context 和 advisory-only writeback；本 change 只提供其可消费的安全投影，不复制其权限合同。

## Success Criteria

- snapshot、current read model 和历史事实各有清晰 owner、输入、版本和保留策略。
- current pointer 只在候选 projection 的 watermark/revision/digest/quality 满足 fence 时原子切换。
- 投影失败、输入不足、stale 或 conflict 不会覆盖上一条合格 current，也不会被渲染成已知零值。
- portrait/risk/teacher/AI/Personalization 的每个公开字段可追溯到 LearningFact 和 projection revision；页面无需 raw event 聚合。
- 角色、独立学习者小样本和隐私测试、并发 publish/crash 测试以及 migration ledger 闭合。
