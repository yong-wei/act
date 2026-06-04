## Context

The adaptive center spec already unifies learner state, mastery, path visualization, evidence explanation, adaptive practice, and Konling support. This change narrows that generic contract to the first complete goal: control-system correction.

## Goals / Non-Goals

**Goals:**

- Provide a complete student-facing state for `control-correction`.
- Preserve route intent from legacy and new adaptive-learning entries.
- Render path map, next action, readiness gate, evidence timeline, citation drawer, and Konling dock when data is available.
- Render actionable fallbacks when evidence, path, feature flags, or network state are incomplete.

**Non-Goals:**

- Rebuilding the platform navigation system.
- Implementing teacher reports.
- Redesigning unrelated adaptive practice behavior beyond compatible entry and fallback handling.

## Decisions

### Decision 1: The center is the primary student entry

Homepage, profile, cockpit, and recommendation entries should route students toward the adaptive center while preserving practice or review intent.

### Decision 2: Empty states are product states

Blank question lists or missing path data are unacceptable. The UI must show loading, fallback, retry, learner-state review, or adjacent actions.

### Decision 3: Data confidence is visible

Student-visible claims must show confidence and evidence limits instead of implying a precise diagnosis when data is weak.

## Validation

- Browser or Playwright tests SHALL verify entry from homepage/profile/cockpit/contextual recommendation.
- UI tests SHALL cover path-ready, loading, no-path, low-evidence, no-question, and feature-flag-disabled states.
- `rtk openspec validate specialize-adaptive-center-control-correction --strict` SHALL pass.
