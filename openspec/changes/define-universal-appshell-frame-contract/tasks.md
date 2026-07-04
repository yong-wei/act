## Tasks

- [ ] 1. Define the universal AppShell route contract.
  - Add spec language for mandatory left navigation, breadcrumbs, top bar, and top-right action order.
  - Make explicit that homepage is the only normal product route outside this shell.

- [ ] 2. Add route exception inventory.
  - Classify auth, print, visual-review, embed-only, and other unavoidable exceptions with owner, reason, and removal condition.
  - Ensure unclassified `src/app/**/page.tsx` routes fail governance tests.

- [ ] 3. Normalize AppShell header action ownership.
  - Introduce or formalize one shell-level header action component that owns the exact pair: theme switch first, role-aware Personal Center second.
  - Prevent route-local actions, assistant controls, return links, path management, filters, exports, and settings from appearing inside that pair.

- [ ] 4. Normalize route navigation metadata.
  - Ensure route metadata can express the canonical primary navigation sequence for student-facing and common product routes.
  - Ensure profile-family routes can use the same collapsible rail as primary modules.

- [ ] 5. Add static shell coverage tests.
  - Detect pages without AppShell-compatible coverage through page or ancestor layout.
  - Require every AppShell-compatible wrapper to be registered and to pass the header/sidebar/breadcrumb DOM contract.
  - Detect primary routes without breadcrumbs or without declared exceptions.

- [ ] 6. Validate the change.
  - Run `rtk openspec validate define-universal-appshell-frame-contract --strict`.
  - Run targeted route inventory and AppShell contract tests.
