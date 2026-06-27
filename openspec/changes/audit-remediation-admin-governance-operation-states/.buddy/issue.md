---
change_id: audit-remediation-admin-governance-operation-states
claim_branch: audit-remediation-admin-governance-operation-states
series: product-design-audit-leftovers
coupling_group: product-design-audit-leftovers
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/audit-remediation-admin-governance-operation-states
risk: high
area: admin-governance
---

## Goal

关闭管理员导入、用户搜索、配置、模型测试、治理处置和导出下载中的操作状态与移动治理问题。

## Scope

- 补齐批量导入预览、确认、失败行下载、批次治理和回滚/不可回滚说明。
- 统一用户 no-match、角色分页、API/UI 过滤口径和移动卡片化展示。
- 补齐配置保存、模型测试、治理 risk resolve、统计导出的状态与审计摘要。

## Out of Scope

- Implementing unrelated active SAR/Source Pack/RAG changes.
- Closing audit findings not explicitly covered by validation evidence.
- Replacing existing shared status, ledger, or governance primitives with a parallel system.

## Acceptance Checklist

- [ ] AC-1: 未关闭管理员 finding 被映射到 operation ledger、用户筛选、配置、模型测试、治理处置和导出面。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.
- [ ] AC-2: 管理员导入、导出、配置、模型测试和治理动作展示 durable status 与 audit summary。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.
- [ ] AC-3: 用户搜索、角色筛选、分页和 no-match 行为在 URL、UI 与 API 之间保持一致。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.
- [ ] AC-4: 审计覆盖的管理员移动页面不发生文档级横向溢出，并保留主操作可达。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.
- [ ] AC-5: 验证证据包含单元/API 测试和移动 DOM 或截图检查。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.

## Tasks

- [ ] Task 1: Map admin unclosed findings to operation ledger, user search/filter, configuration, model test, governance resolve, and export surfaces.
  Covers: AC-1
  Acceptance: the implementation evidence demonstrates this task outcome without closing unrelated findings.
  Evidence: code/test/report diff or browser/DOM capture produced during apply.
  Reviewer Check: confirm the evidence satisfies AC-1 and no unchecked AC was self-approved by the implementation agent.
- [ ] Task 2: Implement durable operation states and API/UI result contract alignment.
  Covers: AC-2, AC-3
  Acceptance: the implementation evidence demonstrates this task outcome without closing unrelated findings.
  Evidence: code/test/report diff or browser/DOM capture produced during apply.
  Reviewer Check: confirm the evidence satisfies AC-2, AC-3 and no unchecked AC was self-approved by the implementation agent.
- [ ] Task 3: Refactor audited mobile admin tables into task-usable layouts without document overflow.
  Covers: AC-4
  Acceptance: the implementation evidence demonstrates this task outcome without closing unrelated findings.
  Evidence: code/test/report diff or browser/DOM capture produced during apply.
  Reviewer Check: confirm the evidence satisfies AC-4 and no unchecked AC was self-approved by the implementation agent.
- [ ] Task 4: Add tests for import preview/batch status, no-match API/UI, config/model test states, governance resolve/export, and mobile widths.
  Covers: AC-2, AC-3, AC-4, AC-5
  Acceptance: the implementation evidence demonstrates this task outcome without closing unrelated findings.
  Evidence: code/test/report diff or browser/DOM capture produced during apply.
  Reviewer Check: confirm the evidence satisfies AC-2, AC-3, AC-4, AC-5 and no unchecked AC was self-approved by the implementation agent.
- [ ] Task 5: Update audit report with closure ids and evidence.
  Covers: AC-5
  Acceptance: the implementation evidence demonstrates this task outcome without closing unrelated findings.
  Evidence: code/test/report diff or browser/DOM capture produced during apply.
  Reviewer Check: confirm the evidence satisfies AC-5 and no unchecked AC was self-approved by the implementation agent.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
