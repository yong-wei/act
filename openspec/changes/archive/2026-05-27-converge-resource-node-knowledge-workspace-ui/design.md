## Context

Current knowledge graph pages use their own dark visual system and resource panels. Future ResourceNode contracts require the same space to explain render/launch targets, prerequisites, knowledge coverage, eligibility, and audit warnings.

## Goals / Non-Goals

Goals:

- Provide one workspace with graph, list, detail, related resources, mapping warnings, and launch actions.
- Show ResourceNode source-of-record references without copying content ownership into the UI.
- Support student exploration and teacher/admin inspection through role-scoped detail.
- Preserve resource ownership boundaries when launching lessons, media, simulations, Arena tasks, widgets, or adaptive path nodes.

Non-goals:

- No ResourceNode backfill implementation.
- No knowledge graph algorithm rewrite.
- No teacher bulk resource management; that belongs to the governance workspace change.

## Decisions

### Graph and ResourceNode panels share one object model

The UI treats a knowledge node, card, media item, simulation, Arena task, quiz, lesson step, or AI intervention as a selectable resource object when it has a ResourceNode mapping.

### Audits are visible but not editable here

The workspace can show missing mapping, launcher, privacy, availability, and evidence instrumentation warnings. Editing policies and bulk remediation belong to teacher/admin governance surfaces.

### Launch through registered owners

Resource launch actions resolve through existing source-of-record and registry contracts. The knowledge workspace must not import lesson, widget, simulation, or Arena implementations directly when a `registryId`, ResourceNode source reference, or feature-owned launcher is available.

## Risks

- Mixing graph exploration and resource management can confuse students. Role-scoped affordances must keep student views action-oriented and teacher/admin views diagnostic.
- ResourceNode coverage will be partial during rollout. Empty and partial states must be explicit.

## Verification

- Tests for role-scoped ResourceNode detail visibility.
- Tests for partial coverage, missing mapping, and launch action rendering.
- Strict validation for this OpenSpec change.
