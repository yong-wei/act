## Context

Learner and knowledge/data pages will become the place where the platform explains evidence, path choices, source quality, and next actions. They need one navigation and evidence language before the future learning-path loop lands.

## Goals / Non-Goals

**Goals:**

- Migrate student dashboard, profile, profile/growth, profile/evidence, adaptive practice, knowledge graph, and data center representative surfaces.
- Use route-ledger archetypes to distinguish learning atlas from knowledge/data map behavior.
- Prepare UI slots for path options, evidence basis, missing sources, confidence, privacy scope, and cited explanations.
- Preserve loading, empty, low-evidence, unauthenticated, and feature-flagged states.

**Non-Goals:**

- Implementing the three-style path planner itself.
- Recomputing learner-state or evidence truth in UI components.
- Migrating teacher or admin pages.

## Decisions

### Decision 1: Learner record and knowledge/data map share evidence semantics

Both page families should use the same confidence, missing-source, freshness, and privacy vocabulary, even when their visual density differs.

### Decision 2: Adaptive practice entry must be complete from every source

The earlier bug where adaptive practice displayed items only from profile entry shows that route entry context cannot be hidden in local state. Shell migration should preserve navigable empty/loading states from homepage, cockpit, and profile.

### Decision 3: Emoji and local palettes are migration failures

Migrated learner and knowledge/data pages should use platform icons, tokens, and status semantics rather than emoji or local Tailwind color families.

## Validation

- Browser evidence covers representative learner and knowledge/data routes in desktop and 320px mobile.
- Tests verify route entry to adaptive practice from homepage/cockpit/profile produces complete loading, empty, or item states.
- Governance checks reject emoji/local palette reintroduction on migrated surfaces.
- `rtk openspec validate migrate-learner-knowledge-data-surfaces --strict` passes.
