## Context

The project has accumulated multiple UI systems because page-level development could introduce local palettes, headers, shells, module chrome, and status badges without a product-level gate. A commercial redesign needs governance that is strict enough to stop drift but staged enough to avoid blocking the migration on known legacy debt.

## Governance Layers

Automated gates should cover deterministic rules:

- No unapproved page-local color families in student-facing and workspace surfaces.
- No unregistered shell components for primary route frames.
- No missing student core destination or intent group coverage in central navigation.
- No unregistered interactive lesson module kind or private module chrome for migrated lessons.
- No duplicate status vocabularies for governed evidence, official evaluation, readiness, and fallback state.

Review gates should cover judgment-heavy rules:

- Whether a page reads as the commercial brand rather than generic AI/education UI.
- Whether visual hierarchy comes from instrument and product structure rather than decorative card repetition.
- Whether dense workspaces keep task controls visible and efficient.

## Visual Acceptance Matrix

Commercial UI changes should name the representative route matrix they affect and attach evidence for those routes. The default matrix is `/login?callbackUrl=%2Fprofile`, `/`, `/interactive-learning`, `/arena`, `/assessment/adaptive-practice`, `/profile`, `/interactive-learning/control-workbench`, one representative interactive course runtime, one teacher analytics surface, and one admin governance surface.

Each affected route should be checked at desktop and 320px mobile widths. The check is not only screenshot existence; it must verify first-viewport usefulness, navigation reachability, absence of text overlap, stable panel geometry, and coherent brand application.

## Accessibility and Text Fit

The governance layer should make contrast, visible focus, keyboard reachability, reduced-motion behavior, button text fit, and 320px text overlap explicit acceptance criteria. These checks are not cosmetic; they prevent premium visual work from reducing usability.

## Staging

Strict governance should be introduced in two levels:

1. Advisory mode during migration: report violations with allowlisted legacy paths.
2. Blocking mode after the related migration change completes: fail tests for new violations and unregistered exceptions.

The allowlist must be explicit, dated, and tied to a migration issue. It should not become a permanent escape hatch.

## Risks

- Purely automated visual governance can create false confidence. Keep visual review requirements for brand fit and hierarchy.
- If blocking mode starts before migrations finish, unrelated work may be blocked by old pages. Use staged enforcement.

## Verification

- Unit or script tests for token, shell, route, navigation, status, and module-registry checks.
- Review checklist updates for high-end visual quality and commercial hierarchy.
- Validation against representative old debt and a known compliant sample.
- Visual acceptance evidence for the default route matrix, accessibility, and text-fit requirements.
