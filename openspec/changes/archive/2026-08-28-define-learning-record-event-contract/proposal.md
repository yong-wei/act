## Why

当前 `LearningEvent`、`EventDictionary`、`LearningEventBatch` 以及直接事件路由和 Redis worker 各自携带一部分语义。事件身份、课程范围、因果关系、去重和隐私授权没有由同一份版本化契约约束，客户端仍可影响部分作用域字段。后续统一 LearningFact 入口若没有稳定的事件边界，会把重复物化、身份越权和不可审计的兼容逻辑继续带入新链路。

## What Changes

- 建立以 discriminator、schema version、source/action version 为核心的 Learning Record 事件 schema registry。
- 统一 event、subject、tenant、course、session、authority、causation、dedupe 和 privacy classification 的信封语义。
- 将身份、租户、角色和授权作用域改为服务器派生并在入口校验；客户端只提供受限上下文提示。
- 为既有事件提供显式 legacy compatibility adapter 和迁移台账，不把所有内部函数调用自动事件化。
- 为每个 producer、consumer、worker、backfill、report 和测试建立闭合分母与特征基线，供后续 ingestion、projection 和 retirement 复用。

## Scope

范围包括事件协议、schema registry、入口校验、兼容适配器、事件字典投影及其单元/并发/隐私测试。它不实现 LearningFact 物化、current projection、生产数据迁移、部署或 selector 切换；这些由后续 proposal 依赖本契约完成。

## Dependencies and Coordination

- 依赖已提交的 `enforce-modular-domain-dependency-contracts`，遵循 Learning Record 的 application/ports/adapters 边界。
- 复用 canonical knowledge identity、learning-evidence-source-catalog、trusted-learning-fact-filter 和现有数据治理 spec，不复制其事实或可信过滤规则。
- 与 `migrate-personalization-recommendations-and-interventions` 及 active `ground-evidence-copilot` 对齐事件来源和隐私边界；不复制 Copilot 的 server-authorized context 合同。

## Success Criteria

- 所有受支持事件均可由 registry 解析到唯一 discriminator、版本、来源、动作、隐私级别和 authority。
- 服务器可从认证上下文派生 subject/tenant/role/scope，篡改客户端字段不能扩大作用域。
- 同一逻辑事件的 causation/dedupe 可稳定重放；版本未知、身份冲突和去重冲突 fail closed。
- legacy 事件仍能在明确适配器中解释，内部同事务调用不因契约而被迫写成事件。
- producer/consumer/worker/backfill/report/test 分母与不变量表可审计，且没有仅增加 facade 的空实现。
