## Why

Issue #1262 发现未配置质量治理的 `LearningFact` 会通过隐式满权重进入学习者画像、能力向量和个性化推荐。学习记录可以保留为审计和活动上下文，但没有明确质量声明时不能被当作能力证据。

## What Changes

- **BREAKING** 将缺少完整画像贡献治理声明的学习事实按零画像权重处理。
- 为事件物化的未识别来源写入可审计的上下文事实治理声明。
- 为已审核文档评分和正式 Arena 写入补齐明确的画像贡献资格。
- 使推荐中的连续学习、最近活动和事实证据统计排除未治理或零权重事实。
- 不回填或推断历史未治理学习事实的质量资格。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `learning-fact-quality-weight`：未治理学习事实不得以隐式权重参与能力画像。
- `evidence-driven-personalization`：个性化推荐的直接学习事实输入必须限于可贡献画像的受治理事实。

## P1 整改

治理字段完整与具备个性化资格是两个不同概念。具有 `profileWeight: 0` 或 `skipProfileContribution: true` 的事实仅保留为可审计的上下文，且不得影响推荐活动、证据覆盖、最近活动、连续学习、学习者状态偏好或 feature cache 活动。

## Impact

涉及学习事实质量解析与物化、文档评分和 Arena 写入、能力向量、Portrait V2、推荐引擎及其 Vitest 覆盖；不涉及 Prisma 模式变更或历史数据迁移。
