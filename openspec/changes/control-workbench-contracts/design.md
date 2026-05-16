## Context

The current Arena layer already defines `ChallengeTask`, `ChallengeObject`, `MetricProfile`, `LeaderboardPolicy`, `ControllerMethod`, `WorkspaceMode`, and `ControllerArtifact`. It also has `ArenaWorkbenchContext` for task-bound workbench routing. The new comprehensive workbench plan needs broader concepts: free-explore sessions, hidden official targets, student nominal models, view plugins, layout presets, controller drafts, and preview/submission policies. These should not live inside the Arena evaluator or inside React components.

This change creates the first shared seam for parallel development:

```text
Arena branch              Shared contracts             Workbench branch
official tasks            session / target / signal     shell / views
evaluation API     <----> controller draft bridge <----> method panels
leaderboards              submission policy             presets
```

## Goals / Non-Goals

**Goals:**
- Establish `src/features/control-workbench/contracts/` as a client-safe, server-safe, React-free contract layer.
- Make `officialTarget` and `workingModel` separate first-class concepts.
- Define stable identifiers for view plugins, layout presets, method panels, and workbench signals.
- Define `ControllerDraft` as the editable workbench state and `ControllerArtifact` as the official submission artifact.
- Provide pure helper functions only where they clarify conversion from existing Arena data.

**Non-Goals:**
- No `/interactive-learning/control-workbench` route.
- No workbench shell, chart grid, method panel, or submission panel UI.
- No official evaluation changes and no `/api/arena/evaluate` rewrite.
- No Prisma model or persisted workbench-session storage.
- No black-box experiment generation, virtual preview execution, or hidden scenario evaluation.

## Decisions

- Keep contracts outside `src/features/arena`.
  Rationale: Arena is the official evaluation, submission, leaderboard, assignment, and evidence layer. The control workbench contract is consumed by Arena and UI code but should not be owned by evaluator modules.

- Split contracts into small files.
  Rationale: parallel branches can touch `signals.ts`, `views.ts`, or `artifact-bridge.ts` independently without constantly colliding in one large type file.

- Import only stable Arena domain types.
  Rationale: contracts may import types such as `ChallengeTask`, `ChallengeObject`, `MetricProfile`, `LeaderboardPolicy`, `ControllerMethod`, and `ControllerArtifact`; they must not import Prisma, server stores, API routes, React components, or chart implementations.

- Use `ControllerDraft` for editable workbench state.
  Rationale: a workbench draft can be dirty, partial, nominal-model-based, or template-based. It should not pretend to be an official `ControllerArtifact` until a bridge validates and converts it.

- Treat black-box official target as identifiable but not inspectable.
  Rationale: the workbench needs to know that an official black-box target exists, but frequency plots and design calculations must use a `NominalModelArtifact`, not hidden official dynamics.

## Risks / Trade-offs

- [Risk] The contract layer becomes too abstract before implementation.
  → Mitigation: include only the concepts listed in `docs/arenav3.1.md` section 3 and avoid speculative persistence or solver APIs.

- [Risk] Later changes bypass the contract and create local duplicates.
  → Mitigation: add tests and tasks that require later shell/preset work to import from `contracts/`.

- [Risk] Type-only helpers accidentally pull server-only code into client bundles.
  → Mitigation: enforce no imports from Prisma, persistence modules, API routes, or React in contract files.

- [Risk] Existing shell proposal overlaps with session-context naming.
  → Mitigation: this change becomes the prerequisite; the shell change should consume these contracts rather than define competing versions.
