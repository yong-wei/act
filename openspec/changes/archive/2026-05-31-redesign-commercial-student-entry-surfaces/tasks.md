## 1. Entry Surface Contract

- [x] 1.1 Define the student intent map for learn, practice, challenge, experiment, review, and account/profile surfaces.
- [x] 1.2 Inventory homepage, login/auth, dashboard, Interactive Learning, Arena, adaptive practice, and profile entry states.
- [x] 1.3 Identify legacy entry layouts and page-local shells that should be replaced rather than adapted.

## 2. Surface Migration

- [x] 2.1 Redesign homepage and student cockpit around the commercial product map and role-navigation contract.
- [x] 2.2 Redesign login, authentication callback, authentication error, and account/profile entry states so callback intent is visible and preserved.
- [x] 2.3 Redesign Interactive Learning entry so course, cross-domain, and component paths have clear commercial hierarchy.
- [x] 2.4 Redesign Arena hall and challenge cards around compact discovery, challenge state, and workbench entry.
- [x] 2.5 Redesign adaptive practice entry, loading, empty, and fallback states so route intent is preserved.
- [x] 2.6 Align profile/review access with account-level and evidence-review semantics.

## 3. Validation

- [x] 3.1 Add route smoke checks for `/`, `/login?callbackUrl=%2Fprofile`, `/dashboard`, `/interactive-learning`, `/arena`, `/assessment/adaptive-practice`, and `/profile`.
- [x] 3.2 Add browser checks at desktop and 320px mobile widths for navigation reachability, first-viewport content, login/auth states, and callback preservation.
- [x] 3.3 Validate with `rtk proxy openspec validate redesign-commercial-student-entry-surfaces --strict`.
