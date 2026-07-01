## Context

审计报告多处记录治理页能显示风险数量和清单，但无法从风险行进入处置。2026-06-30 管理员 operation-states 解决了若干操作状态和移动布局，但不能自动代表风险治理对象化工作流已经完成。

## Approach

风险治理对象应包含：

- risk identity: risk id, category, severity, source object and safe label.
- evidence action: view evidence or explain unavailable evidence.
- assignment: owner, priority, due state, status.
- disposition: mark resolved, ignored, needs action, or reopened.
- undo/reopen: reversible where data policy allows.
- audit trail: actor, time, previous state, new state, note, affected object.

URL intent 应能定位到可处置风险；无权限、缺对象或已处理风险应进入产品恢复状态。

## Boundaries

- 不重做用户批量导入、模板下载、配置测试、过滤导出或 no-match 合同。
- 不关闭管理员移动壳层和 status/live 聚合 finding，除非本风险治理页面有独立证据。
- 不把看板过滤或视觉状态当成风险处置完成。

## Validation Strategy

- Run `openspec validate audit-remediation-admin-risk-governance-workflow-closure --strict`.
- Add tests for risk evidence deep link, assign, resolve, undo/reopen, audit record, URL intent, missing risk, and loading recovery.
- Capture representative UI/DOM evidence for risk list, risk detail/assignment, resolved state, and audit trail.
