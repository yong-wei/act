# Change: Restore Simplified Chinese teacher diagnosis report content

## Why

Issue #1711：教师学情诊断报告出现语言回归风险。经核实（2026-08-29）：生成契约确实缺失语言约束——`diagnosis-generation-provider.ts` 的 system prompt 自 `0b5662739` 引入起从未要求输出语言，返回侧只有结构 schema、evidenceCutoff 与 evidenceRefs 三道校验，不检查语言；`diagnosis-report-delivery-view.tsx` 页面眉题硬编码英文 "Fixed governed report"。模型只要返回英文摘要或结论，就会被当作成功报告直接持久化并展示。生产现存报告（最新 2026-08-21）摘要为中文，说明中文目前是模型行为而非契约保证；该行为没有任何防回归能力。

## What changes

- 生成契约明确要求所有面向教师的自然语言字段（summary、findings[].title、findings[].summary、limitations）使用简体中文，技术值（evidenceRefs、枚举、版本号、时间戳）豁免。
- 模型返回后新增确定性语言校验：自然语言字段必须包含中文字符且中文占比不低于拉丁字母占比；校验失败按"模型行为缺陷"处理（同空输出先例），在既有 3 次尝试预算内自动重试，耗尽后任务失败并给出明确中文错误信息，英文结果不得作为成功报告持久化。
- 报告交付页眉题 "Fixed governed report" 恢复为简体中文文案。
- 新增回归测试：英文模型输出被拒绝且可重试、正常中文输出通过、交付页无英文眉题。

## Non-goals

- 不引入浏览器自动翻译，不改变诊断结论、证据覆盖规则和教师版权限边界。
- 不重新设计诊断报告版式，不改动服务端 PDF 工件与导出审计。
- 不要求机械翻译英文数据字段、枚举、证据标识等技术值。
- 不改变生成任务的身份、幂等、并发与授权语义（沿用 `orchestrate-teacher-diagnosis-generation` 既有契约）。

## Impact

- Specs：`teacher-diagnosis-generation-governance`（新增语言要求与校验重试语义）、`teacher-diagnosis-report-delivery`（新增交付面文案语言要求）。
- Code：`src/lib/diagnosis-generation-provider.ts`（prompt 语言指令 + 语言校验 + 新错误类型）、`src/lib/diagnosis-generation-worker.ts`（失败分类）、`src/features/teacher/diagnosis-report-delivery-view.tsx`（眉题中文）。
- Tests：语言校验单元测试、worker 失败分类断言、交付视图文案断言。
