## Context

Batch after batch reports that actions have no observable state. The final audit closes with a direct recommendation: do not patch zero-alert states page by page; create a cross-role status/live contract for submission, filtering, export, download, writeback, approval, configuration testing, and governance actions.

## Goals / Non-Goals

**Goals:**
- Provide one action-state envelope for UI and route-driven actions.
- Make success, pending, blocked, failed, and unsupported method states visible and accessible.
- Let vertical remediation changes consume the same contract.

**Non-Goals:**
- Do not implement every vertical workflow in this foundation change.
- Do not replace existing domain APIs unless they cannot expose action outcomes.

## Decisions

- Action state must be keyed by action identity, target object, source route, and result; message-only toasts are insufficient.
- Downloads must emit browser download events where applicable, and otherwise show an explicit unsupported or failed state.
- Method-boundary errors such as 405/404 must become product-readable status with recovery, not raw or silent failures.
- Status components must be testable through DOM roles and visible copy.

## Risks / Trade-offs

- Shared status components can become too generic. Mitigation: keep the contract generic but require domain-specific labels and recovery actions.
- Retrofitting existing pages may reveal missing API outcomes. Mitigation: vertical changes may add narrow adapters while preserving this shared state shape.
