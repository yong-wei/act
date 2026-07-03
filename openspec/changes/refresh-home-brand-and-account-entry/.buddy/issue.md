---
change_id: refresh-home-brand-and-account-entry
claim_branch: refresh-home-brand-and-account-entry
series: sitewide-navigation-unification
coupling_group: ui-shell-nav-2026-07
execution_mode: isolated
base_branch: integration
required_branch:
depends_on:
  - standardize-primary-navigation-order
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/refresh-home-brand-and-account-entry
risk: medium
area: ui-shell
---

## Goal

Update the homepage to the “深蓝智控” brand lockup and make its product links, personal-center action, and theme switch match the unified platform navigation semantics.

## Scope

- Generate the “深蓝智控” logo with image2.
- Store the generated logo and metadata in `public/assets/platform-brand/`.
- Consume the logo through a shared platform brand lockup/component or helper.
- Update homepage brand text and topbar actions.
- Verify homepage visual behavior across desktop/mobile and light/dark themes.

## Out of Scope

- Redesigning all module pages.
- Merging profile and dashboard.
- Changing Konling chat or dock internals.
- Creating a new brand asset directory outside platform-brand governance.

## Acceptance Checklist

- [ ] AC-1: Homepage shows the governed “深蓝智控” logo and Chinese platform description without legacy brand copy. Owner: independent reviewer.
  Evidence: homepage screenshot and source check for brand copy.
- [ ] AC-2: The logo is generated with image2, stored under `public/assets/platform-brand/` with metadata, and consumed through a shared brand lockup/component or helper. Owner: independent reviewer.
  Evidence: asset file, metadata file, generation prompt/model note, and shared component/helper source check.
- [ ] AC-3: Homepage topbar uses six product links plus “个人中心 + theme switch” rather than “进入驾驶舱”. Owner: independent reviewer.
  Evidence: source check and desktop/mobile visual evidence.

## Tasks

- [ ] Task 1: Generate and store the logo asset.
  Covers: AC-2
  Acceptance: The image2-generated “深蓝智控” logo and metadata live under `public/assets/platform-brand/`.
  Evidence: asset path, metadata JSON, and generation note.
  Reviewer Check: Confirm no page-local generated asset folder is introduced.
- [ ] Task 2: Update homepage brand and account action.
  Covers: AC-1, AC-2, AC-3
  Acceptance: Homepage topbar uses the shared brand lockup/component, six center module links, personal center action, and theme switch.
  Evidence: changed homepage code and screenshots.
  Reviewer Check: Confirm old English/AI-OBE copy and “进入驾驶舱” are removed from homepage topbar and brand usage is not page-local.
- [ ] Task 3: Validate visual QA.
  Covers: AC-1, AC-3
  Acceptance: Desktop and 320px mobile screenshots pass for supported themes without clipping or overlap.
  Evidence: product-design or OpenWolf screenshot artifacts.
  Reviewer Check: Confirm logo and subtitle remain readable.

## Agent Guardrails

- Use image2 for the logo asset.
- Store brand assets only in the governed platform brand directory.
- Do not alter the AppShell rail order except through the dependency change.
- Do not introduce decorative gradient-orb branding.
