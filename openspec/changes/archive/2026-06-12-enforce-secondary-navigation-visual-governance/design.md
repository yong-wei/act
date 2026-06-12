## Overview

This change converts the UI review findings into durable gates. The goal is not to add another screenshot checklist; the gate must prove the shell, navigation, role scope, and local-tool boundaries that define the new platform UI.

The gate should support advisory mode while migration changes are active, then become blocking for routes that have been migrated or have no active exception. Blocking mode for the full matrix depends on completion of `fix-app-shell-collapsed-navigation-contract`, `migrate-student-secondary-routes-to-unified-shell`, `migrate-knowledge-map-to-unified-shell-panels`, and `restrict-data-center-to-operations-roles`.

## Governance Model

### Route Matrix

Maintain a representative matrix for:

- `/arena`
- `/interactive-learning/control-workbench`
- `/interactive-learning`
- `/interactive-learning/courses`
- `/interactive-learning/chapter-components`
- `/interactive-learning/cross-domain-exploration`
- `/assessment/adaptive-practice`
- `/knowledge`
- `/data-center` as teacher and administrator

The matrix should record shell type, route archetype, role scope, expected navigation layers, collapse behavior, local panels, theme support, and mobile behavior.

### Checks

- Non-home primary routes must declare AppShell, approved workspace shell, or a temporary exception with owner and removal condition.
- Collapsed navigation must prove actual rail width, content width expansion, visible icon-only state, accessible labels, and active route state.
- Route DOM evidence must not contain page-local `UnifiedTopBar` or local sidebar patterns after migration unless the route has an approved adapter exception.
- Interactive Learning first-hop destination evidence must prove students do not leave the unified shell when opening chapter components or cross-domain exploration from the entry page.
- Student role navigation and student route evidence must not contain `/data-center`.
- Knowledge graph side panels must be marked as local graph tools, not platform navigation.
- Data center evidence must include teacher and administrator states, and must not include student entry visibility.

## Evidence

Prefer fast DOM and screenshot manifest checks over brittle full-page visual diff. Evidence should include route, role, theme, viewport, shell state, expected navigation items, forbidden navigation items, and result.

## Rollout

1. Start in advisory mode for routes still owned by migration changes.
2. Make migrated routes blocking as each upstream change completes.
3. Enable full matrix blocking mode only after shell collapse, student secondary routes, knowledge graph, and data-center role restrictions are complete.
4. Remove temporary exceptions when all representative routes conform to the unified shell and navigation model.

## Risks

- If the gate only checks markers, it will repeat the current collapse failure. It must measure or infer layout behavior.
- If route exceptions are broad, they will preserve the same fragmentation the UI redesign is trying to eliminate.
