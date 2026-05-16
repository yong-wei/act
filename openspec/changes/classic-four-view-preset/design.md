## Context

The current multi-representation workbench already handles Arena context, challenge locking, white-box model injection, correction parameters, preview metrics, root-locus/Bode handle synchronization, and official submission. The unified shell should consume this behavior as a preset instead of reimplementing the numerical path.

## Goals / Non-Goals

**Goals:**
- Make white-box PID and serial-compensator tasks work through `/interactive-learning/control-workbench`.
- Preserve the existing four-chart behavior and official submission semantics.
- Keep the old multi-representation URL as a stable alias or wrapper.

**Non-Goals:**
- No redesign of the correction drawer beyond what already exists.
- No support for black-box, composite, MPC, or Odyssey presets.
- No free-form drag-and-drop layout in this change.

## Decisions

- Extract reusable model and view pieces incrementally.
  Rationale: the current `page-client.tsx` is already large, but a full refactor before proving the shell would be risky. The preset can first wrap existing components, then split files only where needed.

- Use existing artifact mapper for official submissions.
  Rationale: `buildArenaArtifactFromMultiRepresentationState` already encodes controller gain and effective PID/serial parameters. Reusing it preserves preview/official consistency.

- Preserve old route behavior.
  Rationale: existing course pages and embedded cruise classroom references still link to the old route.

## Risks / Trade-offs

- [Risk] The first preset may carry legacy component names.
  → Mitigation: isolate naming under a preset adapter and rename internals later only when tests are stable.

- [Risk] Both old and new routes may diverge.
  → Mitigation: make one route call the shared preset implementation and add source tests for shared imports.
