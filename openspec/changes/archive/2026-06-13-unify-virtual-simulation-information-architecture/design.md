## Context

The issue scope is information architecture, not simulation runtime redesign. The existing `/simulations/*` detail routes remain the real launch targets. The conflict sits at entry level: `/virtual-lab` exposes model deployment/status facts that can disagree with `/simulations`.

## Decisions

### 1. `/simulations` is the only student catalog

Student navigation, commercial entry surfaces, and simulation discovery continue to target `/simulations`. `/virtual-lab` becomes a compatibility redirect and is not rendered as a second catalog.

### 2. Catalog cards avoid deployment/status truth

The primary catalog may describe scenario identity, course fit, difficulty, tags, and launch actions. It must not show model file paths, deployment state, preparing/open counts, or task-chain status as student-facing availability truth.

### 3. Deep links are untouched

Existing concrete simulation routes under `/simulations/*` remain reachable. This change does not rework scene shells or numerical behavior.

## Risks

- Commercial UI governance treats changed app pages as primary route candidates. Since `/virtual-lab` is now redirect-only compatibility behavior, it must be explicitly exempted from primary-page ledger requirements.
- Removing status labels should not make the catalog less usable; the launch action remains visible on each scenario card.

## Verification

- Navigation tests prove student entries expose `/simulations` and exclude `/virtual-lab`.
- Source contract tests prove `/virtual-lab` redirects and `/simulations` does not expose model deployment/status strings.
- OpenSpec strict validation proves the change remains within the declared scope.
