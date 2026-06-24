## Context

Once a path is generated and selected, the path center must stop behaving like a single recommendation card. It must become a route map with execution state, node detail, data-governance writeback, and history. The handoff explicitly requires complete route visibility, current-node marking, time statistics, completed-node review/continue, skip warnings, and evidence timeline.

## Goals / Non-Goals

**Goals:**

- Render complete active path and current node.
- Render node details and governed launch actions.
- Support review, continue interaction, skip, return-to-skipped, and evidence inspection.
- Render path history and evidence in student-facing terms.
- Require visual QA against execution and history concepts.

**Non-Goals:**

- No teacher analytics implementation.
- No planner scoring algorithm changes beyond execution state requirements.
- No external resource crawler.

## Decisions

- Make full path map the primary execution surface; next action alone is insufficient.
- Treat completed-node continued interaction as new evidence but not a duplicate completion.
- Treat skipping unfinished resources as allowed deviation with explicit confirmation.
- Use student-facing evidence states: `已记录`, `待复核`, `可用于推荐`, `仅作参考`.

## Risks / Trade-offs

- Full paths can become visually dense. Mitigation: use grouped route map, responsive timeline, and node detail focus while keeping route context visible.
- Skip warnings may interrupt flow. Mitigation: warn only before unfinished-resource skip and use concise consequence text from the handoff.
- Evidence history may leak internal provenance. Mitigation: map raw event types to student-safe states and keep detailed diagnostics for authorized roles.
