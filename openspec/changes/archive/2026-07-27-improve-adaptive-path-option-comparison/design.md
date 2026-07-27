## Context

`/assessment/adaptive-practice` receives path options that already contain ordered `nodeIds`, `nodeSummaries`, readiness data, resource mix, effort, limitations, and policy diversity metadata. The comparison presentation reduces those options to a resource-type summary, while the selected-path timeline later reconstructs an ordered route. This change makes the selection-stage presentation consume the existing display-ready data without expanding the planner or persistence contract.

## Goals / Non-Goals

**Goals:**

- Make concrete resources and their execution order visible before path selection.
- Make meaningful cross-option overlap and uniqueness visible using stable node identity.
- Keep comparison compact, responsive, student-readable, and consistent with the current per-option action module.
- State limited resource diversity honestly when existing planner output reports it.

**Non-Goals:**

- Change candidate ranking, path generation, policy diversity thresholds, API payloads, persistence, or path execution behavior.
- Start resources before a path has been selected and owns the execution context.
- Treat generated starter examples as executable or comparable path options.

## Decisions

### Derive a preview from existing ordered node summaries

The display model will preserve an ordered node preview derived from `nodeIds` and matched `nodeSummaries`. The first four contiguous nodes render by default, and a native disclosure reveals the complete read-only sequence. Reusing node summaries maintains the planner's ordering and avoids a second client-side resource resolver.

### Compute comparison annotations from node IDs across the displayed bundle

The display builder will count every option's stable `nodeId`. A node present in all real options is labelled “所有方案均包含”; one present in exactly one option is labelled “本方案特有”. Node titles and resource types are not identifiers, so they are not used for this calculation.

### Keep path cards as the comparison unit

Each existing option module gains a consistently placed ordered preview. This preserves direct comparison, keeps content with its selection and explanation actions, and avoids a detached table that would be unusable on small screens.

### Use existing planner limitation data for the shared diversity warning

The UI will only render the “当前可用资源有限，推荐方案差异较小” message when existing, student-safe planner limitation or diversity data establishes the condition. It will not estimate diversity from the truncated preview because that could misrepresent hidden or locked nodes.

### Separate starter examples from generated comparisons

Static starter options remain available before generation but are explicitly rendered as examples. They will not receive node-difference annotations or be presented as the formal, selectable comparison set.

## Risks / Trade-offs

- [Long resource titles can make three cards uneven] → Use wrapping text, bounded preview count, and an explicit full-route disclosure.
- [Planner payloads from older records can omit node summaries] → Render a student-safe unavailable preview state rather than inventing titles or order.
- [A planner limitation may be technical] → Map only recognized, existing limitation states to student-facing copy; internal codes remain hidden.
- [All paths share most nodes] → Show annotations plus the shared limitation message so similarity is transparent rather than cosmetic.

## Migration Plan

The change is additive and client-side. Existing persisted paths retain their current payload shape; records lacking usable ordered summaries receive the existing generic comparison fields and a safe unavailable-route preview. Rollback is a revert of the display-model and comparison-surface changes.

## Open Questions

无。展示范围、顺序、差异标签、状态、静态示例与限制提示均已在访谈中确认。
