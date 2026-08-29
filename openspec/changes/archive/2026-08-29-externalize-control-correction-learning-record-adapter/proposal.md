## Why

通用 Learning Record、learner state 和 Personalization 代码仍携带控制校正课程的 goal、lesson、Arena task 等硬编码。这样通用事实模型被迫知道课程 ID，课程变更会污染平台层，且容易把“目标匹配”误当成 official score。控制校正证据需要进入明确的 course/plugin adapter，同时保留 Arena official authority 与 Personalization 既有插件接口。

## What Changes

- 将 control-correction 的 evidence mapping、goal/lesson/Arena identity 和课程资源关联移入显式 adapter/plugin。
- 通用 Learning Record 只处理稳定事实、来源、质量、scope 和 projection，不读取或硬编码课程 ID。
- 使用显式 `goalId=control-correction`/plugin resolution，禁止关键词猜测和模糊 lesson 匹配。
- 保留 Arena official authority；Arena submission/result 仍是正式评价来源，LearningFact 只保存可追溯的辅助学习证据。
- 保留 Personalization plugin interface，并将 adapter 输出限制为其所需的目标/掌握/证据特征。
- 完成 producer/consumer/caller characterization、一个真实 vertical slice、迁移后删除硬编码和并发/隐私/缺失插件验证。

## Scope

范围包括 generic Learning Record/learner-state/Personalization 中的 control-correction 识别、adapter contract、registry、调用方迁移和删除台账。它不改 Arena official scoring、不重写 Personalization 算法、不迁移生产数据、不部署或选择器切换。

## Dependencies and Coordination

- 依赖 `publish-learning-record-current-projections` 的 revision-bound projection/read-port contract。
- 依赖 `externalize-control-correction-personalization-plugin` 的 goal plugin、显式 goalId 和 Personalization ownership；不复制其实现或建立第二个 plugin registry。
- 与 `migrate-learning-record-consumers` 对齐 adapter 输出的角色最小字段和 Copilot/AI 隐私边界。

## Success Criteria

- 通用 Learning Record、snapshot、reducer 和 read port 中不存在 control-correction course/lesson/Arena 硬编码或关键词猜测。
- adapter 通过显式 goal/plugin/revision 解析课程映射；不存在、冲突或版本漂移时 fail closed。
- Arena official result 的 authority 不被 LearningFact、Personalization 或 adapter 覆盖；Personalization plugin contract 保持兼容。
- control-correction facts、projection 和 consumer 字段可追溯到 adapter revision/source identity，且公开投影不泄露课程私有数据。
- 所有旧常量/分支的 caller、producer、backfill、report 分母和删除证据闭合，不以 facade-only 宣称完成。
