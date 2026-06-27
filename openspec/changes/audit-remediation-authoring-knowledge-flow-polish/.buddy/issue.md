---
change_id: audit-remediation-authoring-knowledge-flow-polish
claim_branch: audit-remediation-authoring-knowledge-flow-polish
series: product-design-audit-leftovers
coupling_group: product-design-audit-leftovers
execution_mode: isolated
base_branch: integration
required_branch:
depends_on: []
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/audit-remediation-authoring-knowledge-flow-polish
risk: medium
area: authoring-resources
---

## Goal

关闭课程流、知识节点、资源预览、播放列表和移动作者态流程中仍未完全收口的审计问题。

## Scope

- 补齐资源预览到加入阶段或课程流的近场动作。
- 让课程流构建器保存、播放、缺失对象、空标题校验和移动分步结构形成稳定产品状态。
- 补齐知识图谱/知识节点工具按钮命名、筛选密度和深链状态。

## Out of Scope

- Implementing unrelated active SAR/Source Pack/RAG changes.
- Closing audit findings not explicitly covered by validation evidence.
- Replacing existing shared status, ledger, or governance primitives with a parallel system.

## Acceptance Checklist

- [ ] AC-1: 未关闭作者态/知识流 finding 被映射到资源预览、知识节点、播放列表、图谱工具和移动构建器面。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.
- [ ] AC-2: 资源预览、知识节点和课程流动作保留上下文，并提供可执行下一步。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.
- [ ] AC-3: 播放列表/课程流保存和播放路由保留选中项，并对缺失对象提供产品恢复状态。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.
- [ ] AC-4: 知识与构建器控件具备稳定可访问名称和移动分步结构。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.
- [ ] AC-5: 验证和审计证据只关闭已证实 finding。 Owner: independent reviewer.
  Evidence: targeted tests, OpenSpec validation, audit report diff, and browser/DOM evidence where applicable.

## Tasks

- [ ] Task 1: Map remaining authoring/knowledge findings to resource preview, knowledge node, playlist builder, graph tool, and mobile builder surfaces.
  Covers: AC-1
  Acceptance: the implementation evidence demonstrates this task outcome without closing unrelated findings.
  Evidence: code/test/report diff or browser/DOM capture produced during apply.
  Reviewer Check: confirm the evidence satisfies AC-1 and no unchecked AC was self-approved by the implementation agent.
- [ ] Task 2: Implement context-preserving next actions and product recovery states.
  Covers: AC-2, AC-3
  Acceptance: the implementation evidence demonstrates this task outcome without closing unrelated findings.
  Evidence: code/test/report diff or browser/DOM capture produced during apply.
  Reviewer Check: confirm the evidence satisfies AC-2, AC-3 and no unchecked AC was self-approved by the implementation agent.
- [ ] Task 3: Improve accessible names, scalable selection, and mobile staged builder layout.
  Covers: AC-4
  Acceptance: the implementation evidence demonstrates this task outcome without closing unrelated findings.
  Evidence: code/test/report diff or browser/DOM capture produced during apply.
  Reviewer Check: confirm the evidence satisfies AC-4 and no unchecked AC was self-approved by the implementation agent.
- [ ] Task 4: Add tests for save/play persistence, missing object recovery, button names, and mobile builder structure.
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
