## Why

Path execution is not closed-loop if complex learning nodes finish without durable results. Adaptive tests, simulations, control workbench sessions, and Arena submissions must bind their outcome to the path node before dependent nodes advance or future recommendations use the activity.

## What Changes

- Extend path execution records to bind complex-node outcome references.
- Add result cards for adaptive assessment, simulation, control workbench, and Arena nodes.
- Block dependent path advancement when a required complex-node result is missing or only pending sync.
- Convert missing result bindings into student-facing `结果待同步` states and governance evidence.
- Preserve skip, return, review, and continued-interaction records without double-counting mastery.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `adaptive-learning-path-planning`: require complex-node outcome refs before advancing dependent path nodes.
- `simulation-arena-evidence-governance`: expose simulation, control workbench, and Arena outcome references usable by path execution.
- `adaptive-learning-center-ui`: render complex-node result cards and missing-result states.

## Impact

- Affects `LearningPathExecution`, path activity records, simulation/Arena/workbench evidence references, adaptive assessment outcomes, and `/assessment/adaptive-practice?intent=path-execution` and `evidence-review` surfaces.
- Expected visual sources: `03-active-path-execution.png` and `04-history-evidence-record.png`.
- Current mismatch evidence: `artifacts/product-design-audits/adaptive-learning-path-2026-06-16-current-audit/audit-notes.md`.
