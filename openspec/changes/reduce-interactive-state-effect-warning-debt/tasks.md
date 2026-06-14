## 1. Scope

- [ ] 1.1 Extract warning diagnostics for interactive and shared runtime state/effect rule families.
- [ ] 1.2 Select a first remediation batch covering manifest runtime, one interactive unit family, and one shared classroom/lesson-engine component.

## 2. Remediation

- [ ] 2.1 Replace effect-driven parent synchronization with event-driven callbacks where the event source is known.
- [ ] 2.2 Replace prop-mirrored derived state with derived values, keyed remounts, or explicit identity-owned state.
- [ ] 2.3 Preserve same-identity learner draft, reveal, media, and teacher state.
- [ ] 2.4 Add tests around representative step changes and same-step rerenders.
- [ ] 2.5 Add representative progress, completion, scoring, release, analytics, or submission evidence regression tests for any refactored callback path.
- [ ] 2.6 Prove event emission count and timing do not introduce missing, duplicate, or stale reports in touched components.

## 3. Validation

- [ ] 3.1 Run focused unit tests for changed interactive/runtime files.
- [ ] 3.2 Run owned-surface React Doctor warning evidence and prove the targeted state/effect warnings decrease for touched files.
- [ ] 3.3 Run owned-surface error and Security gates and confirm zero selected diagnostics.
- [ ] 3.4 Run `rtk openspec validate reduce-interactive-state-effect-warning-debt --strict`.
