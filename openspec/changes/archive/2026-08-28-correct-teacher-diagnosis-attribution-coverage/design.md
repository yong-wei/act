# Design: Correct teacher diagnosis attribution coverage

## Context

`projectReportHistoryCard` 当前用 `findings.some((finding) => !finding.knowledgeNodeId)` 判定 `attributionLimited`。缺少知识节点的总体风险或成绩分布发现会注入覆盖受限原因，高置信完整覆盖报告也会显示“证据可用，但覆盖受限”。

## Goals / Non-Goals

**Goals:**

- 只对需要知识节点归因的发现检查 `knowledgeNodeId`。
- 非知识节点发现不得单独把报告标为受限。
- 完整覆盖且无声明限制时，可用性与覆盖事实一致。
- 真实知识归因缺失仍给出补映射恢复建议。

**Non-Goals:**

- 不要求模型为所有 finding 编造知识节点。
- 不修改历史报告事实或证据引用。
- 不降低知识进度发现的归因要求。

## Decisions

### 1. Knowledge-progress evidence requires node attribution

A finding requires knowledge-node attribution when at least one `evidenceRefs` item uses the `knowledge-progress:` source family. Missing `knowledgeNodeId` on those findings sets `attributionLimited`.

Overall-risk, score-distribution, and class-coverage findings that only cite assignment, assessment, competency, or risk sources do not require a knowledge node.

### 2. Projection-only correction

Keep the persisted report body unchanged. Recalculate `attributionLimited`, confidence reasons, availability, and limitation copy from the same snapshot.

## Risks / Trade-offs

- [Risk] 知识进度发现若未引用 `knowledge-progress:` 证据，将不会触发受限。→ 与现有 evidence-ref 合同一致；不得用标题关键词猜测。
