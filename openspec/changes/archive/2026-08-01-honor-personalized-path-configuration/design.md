## Context

The planner receives structured controls from the adaptive-practice page, but its preference context combines request and historical resource preferences and most controls only influence ranking. The policy bundle independently builds each policy-family path, then diagnoses overlap without changing the bundle. Free-text intent is reduced to a fixed snapshot marker, and terminal-validation handling can silently increase a requested budget to 90 minutes.

Issue #1097 therefore requires a cross-layer change: request normalization in Konling, deterministic planning and option assembly, a student-safe result projection, and comparison UI rendering. The implementation must retain audited resources, objective boundaries, prerequisites, readiness, terminal validation, privacy, and teacher policy as higher-priority constraints.

## Goals / Non-Goals

**Goals:**

- Make every supported request-level configuration either affect candidate selection or produce a structured unmet reason.
- Give request-level resource preferences precedence over historical preferences for the current generation.
- Turn supported free-text statements into deterministic, auditable planning constraints.
- Prevent cosmetic policy options by selecting each later option against already retained differentiable learning resources.
- Preserve requested budgets and show a student-safe explanation when the minimum executable path is longer.
- Expose configuration fulfillment to both regression tests and students without leaking internal reason codes.

**Non-Goals:**

- Introducing a general LLM-based natural-language planner or changing authorization/resource-access boundaries.
- Relaxing mandatory prerequisites, readiness gates, terminal validation, evidence policy, or teacher policy to manufacture diversity.
- Rebuilding existing path persistence, policy-family definitions, or the general adaptive-practice visual layout.
- Requiring an exact option count when reviewed resources cannot support meaningful alternatives.

## Decisions

### Normalize request configuration into a fulfillment-aware planning preference

The Konling entrypoint will create a request-level planning preference that distinguishes explicit request values from fallbacks. Explicit resource types override stored learner modalities; stored values are used only when the request omits the field. Difficulty rhythm, checkpoint density, external-resource permission, resource types, and mapped free-text intent are passed to the planner as selection/assembly constraints with a fulfillment record.

The fulfillment record is structured by requested field and reports `applied` or `unmet` with a stable internal code and student-safe display text. Higher-priority feasibility constraints may cause `unmet`, but they may not silently turn the field into a mere score adjustment.

Alternative considered: retain the union of historical and request preferences and increase score weights. This cannot prove that a current explicit choice was respected and is rejected.

### Map free-text intent only to existing deterministic concepts

Free-text intent is normalized through a bounded parser that recognizes the existing controlled vocabulary: resource types, difficulty rhythm, checkpoint density, external-resource permission, and registered goal or graph target references. The parser produces typed constraints and mapping evidence; unrecognized text, conflicts, and unavailable targets produce fulfillment limitations rather than hidden prompt text or speculative behavior.

Alternative considered: call a general model to interpret arbitrary intent. That would add non-deterministic planning behavior without a governed evaluation contract and is excluded.

### Generate policy options with sequential differentiable-resource avoidance

The primary policy option is generated first. For each remaining policy family, the bundle passes the differentiable instructional resources retained by earlier options through a dedicated internal avoidance input. Mandatory prerequisite and terminal-validation nodes are not treated as avoidable. A candidate is retained only when it differs on at least one differentiable resource and still satisfies all higher-priority constraints.

If no such candidate is feasible, the bundle omits the option and records a specific diversity limitation. Bundle metrics are computed over retained options; they no longer serve only as a post-generation warning.

Alternative considered: independently generate all options and remove exact duplicates. That still permits high-overlap cosmetic paths and is rejected.

### Treat budget insufficiency as a fulfillment limitation

Terminal validation remains mandatory when the registered goal requires it. When the requested budget is below the minimum feasible duration, the planner does not replace it with an internal 90-minute value. It returns a blocked or limited generation result with the requested duration, minimum required duration, and a student-safe corrective action.

Alternative considered: silently raise the budget. This creates an untruthful personalization result and is rejected.

### Project fulfillment to the comparison UI

The runtime response and persisted path payload will carry a sanitized configuration-fulfillment summary. The adaptive-practice page will map it into existing comparison and limitation surfaces using student language, never raw internal codes. The same summary explains reduced option counts and unsupported free-text mappings.

## Risks / Trade-offs

- [Resource pools genuinely lack alternatives] → Return fewer options with a specific limitation; do not add unrelated or unaudited nodes.
- [Sequential avoidance makes a later policy infeasible] → Preserve the earlier option and record the omitted policy family rather than weakening feasibility constraints.
- [Keyword intent mapping has limited coverage] → Limit the promise to recognized controlled concepts and display unsupported intent clearly.
- [New response fields may affect legacy consumers] → Add fields compatibly, keep existing path-option fields intact, and verify existing runtime projections.
- [Budget behavior changes an existing implicit fallback] → Cover low-budget terminal-validation requests with regression tests and provide a corrective minimum-duration message.

## Migration Plan

No data migration or dependency change is required. Deploy the additive result fields with the planner and UI together; rollback consists of reverting the change because persisted payload readers remain tolerant of missing fulfillment data.

## Open Questions

None. The bounded intent vocabulary, option reduction behavior, constraint precedence, and budget behavior were confirmed during the Grill session.
