## Context

Future platform surfaces will expose governed evidence rather than only page content. The status model must be consistent across students, teachers, and admins while respecting different role scopes.

## Goals / Non-Goals

Goals:

- Create one UI vocabulary for evidence confidence, source coverage, privacy scope, replay verification, protocol version, official/preview evaluation, readiness, and fallback reasons.
- Make low-confidence and missing-context states visible without overstating precision.
- Allow compact and detailed rendering variants.
- Keep status primitives display-only; evidence derivation, privacy policy, replay verification, learner-state, path, and ResourceNode algorithms remain owned by their feature domains.

Non-goals:

- No change to evidence, replay, learner-state, or path algorithms.
- No exposure of raw traces, hidden official evaluation internals, raw answers, or private memory.
- No dashboard redesign by itself.
- No domain-specific status derivation inside shared UI primitives.

## Decisions

### Treat status as cross-product language

Evidence and confidence states should look the same when they appear in simulation traces, Arena submissions, ResourceNode audits, learner-state cards, path explanations, Konling interventions, and governance dashboards.

### Display source and privacy together

Status components must show what evidence supports a claim and who is allowed to see it. This prevents teacher/admin views from accidentally implying access to private payloads.

### Accept governed status payloads

Shared status UI receives normalized status, source, confidence, and role-scope payloads from feature domains. It can map them to labels, tokens, details, and restricted markers, but cannot infer official evaluation, privacy access, learner state, ResourceNode readiness, or replay verification by itself.

## Risks

- Generic components can hide important domain differences. Each status must carry source capability and role scope.
- Compact chips can become decorative. Every compact state must have an accessible detail or tooltip path where needed.

## Verification

- Component/source tests for status-to-label mapping.
- Role-scope tests for restricted status details.
- Strict OpenSpec validation for this change.
