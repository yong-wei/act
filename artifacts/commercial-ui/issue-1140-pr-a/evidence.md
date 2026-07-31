# Issue 1140 PR A Browser Evidence

## Revision

- Code and screenshot commit: `bcdfd262d65b04ca21dcd2011558bbf4fc781827`
- Captured at: `2026-07-31T11:52:53.7270329Z`
- Route: `/assessment/adaptive-practice?goal=control-correction&intent=contextual-recommendation&pathTime=90&pathRhythm=steady&pathResources=knowledge_card%2Cadaptive_quiz%2Csimulation&pathCheckpoint=standard`

## Screenshots

| Viewport | File | SHA-256 |
| --- | --- | --- |
| 1440px desktop | `fail-closed-generation-desktop-1440.png` | `6F85EC7E5FBB6DDA76336A489D46EA87761A03F703422BE94A2AEEDF87653F2A` |
| 320px mobile viewport (305x763 content bitmap after scrollbar) | `fail-closed-generation-mobile-320.png` | `EEF8B3DB5845F3DCDAF3D506DEED625CE694022EC636FC167E27D14113C36E73` |

## Browser Observation

The authenticated local student page rendered at both target widths. The mobile artifact is a single 320px viewport capture rather than a scrolling full-page composite, so sticky controls are not duplicated during capture. It remained fail-closed with the generation action disabled because the local historical student data could not produce a governed learner-safe summary. The server reported `Portrait v2 derivation must use a governed learner-safe summary.` No database state was changed and no successful browser generation request was fabricated.

These screenshots therefore prove the real responsive fail-closed state, not a successful end-to-end generation. Successful request identity behavior is covered by automated tests:

- rapid duplicate activation admits only one request;
- repeated running callbacks reuse the same request ID;
- an unexpected 500 or lost response retains the same request ID for retry;
- a definitive failure or success causes an explicit later generation to receive a new request ID.

## Verification

- `vitest` lifecycle and route tests: 14 passed.
- Targeted adaptive learning center UI contracts: 2 passed, 55 skipped.
- ESLint on changed source and tests: passed.
- OpenSpec strict validation: passed.
- `git diff --check bcdfd262^..HEAD`: passed after removing trailing blank lines from the OpenSpec requirement files.
- Full TypeScript check: blocked by existing integration-branch errors in `global-ai-sidebar.tsx`, missing Tiptap and Radix packages plus resulting implicit-any errors, and the missing `teacher-diagnosis` conversation-library entry. No error remains in the Issue 1140 changed files.
