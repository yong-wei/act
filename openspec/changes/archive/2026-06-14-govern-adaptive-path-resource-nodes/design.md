## Context

The path center must show full routes across interactive lessons, knowledge cards, adaptive exercises, control workbench, simulations, Arena, external resources, reflection, checkpoints, and Konling. Existing ResourceNode types cover many platform resources but do not cleanly separate external resources, checkpoints, adaptive quizzes, and control workbench tasks in the way the accepted visual design requires.

## Goals / Non-Goals

**Goals:**

- Define a stable path node taxonomy and icon contract.
- Govern external resources before they can appear in paths.
- Make checkpoints first-class path nodes with separate visual and evidence behavior.
- Keep source ownership separate from renderable content.

**Non-Goals:**

- No external search crawler or recommendation engine.
- No final UI implementation.
- No change to authored course content ownership.

## Decisions

- Add explicit `external_resource`, `checkpoint`, `adaptive_quiz`, `control_workbench`, and `konling` path node semantics rather than overloading existing `quiz`, `project`, or `ai_intervention` values.
- Keep `sourceKind` and `sourceRef` authoritative. ResourceNode remains planning metadata and does not copy external content or teacher catalog fields.
- Represent evidence status separately from node availability. External links may be launchable while still marked `仅作参考`.
- Require icon metadata from a central contract so path comparison, active execution, and history pages show consistent symbols.

## Risks / Trade-offs

- A larger node vocabulary can fragment implementation. Mitigation: require registry tests and a central icon/display-name map.
- External resources can be low quality or unavailable. Mitigation: make audit eligibility and evidence-use status mandatory before a node becomes path-eligible.
- Checkpoints may be confused with quizzes. Mitigation: give checkpoints distinct shape, status, and completion semantics.
