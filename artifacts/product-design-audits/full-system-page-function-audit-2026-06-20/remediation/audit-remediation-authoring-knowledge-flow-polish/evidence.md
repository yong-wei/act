# audit-remediation-authoring-knowledge-flow-polish Evidence

Date: 2026-06-30

Change: `audit-remediation-authoring-knowledge-flow-polish`

## Scope

This change closes the authoring and knowledge-flow audit gaps that can be verified by source contracts and targeted tests:

- playlist play recovery for missing or invisible playlists
- playlist builder validation/status feedback and mobile staged structure
- accessible names for ResourceNode and knowledge-node authoring controls
- stable knowledge graph tool names and compact mobile filter groups

It does not claim full visual closure for every long mobile authoring page in the original audit batch. Those broader pages remain listed as residual work in `report.md`.

## Closure Evidence

### Playlist Play Recovery

Files:

- `src/app/playlists/[id]/play/page.tsx`
- `src/app/__tests__/playlist-play-page.test.ts`

Contracts:

- Missing playlists render `data-playlist-play-recovery="unavailable"` instead of calling `notFound()`.
- Private or inaccessible playlists use the same recovery copy as missing playlists.
- Anonymous unavailable states share the same `/login` action; authenticated unavailable states return to `/playlists`.
- The recovery state does not expose the private playlist title or raw playlist id.

Audit findings:

- 212, 379: closed for missing/private playlist recovery.
- 381, 382: partially remediated for playlist play deep-link recovery only.

### Playlist Builder Status and Mobile Structure

Files:

- `src/features/knowledge/playlist-builder.tsx`
- `src/app/__tests__/authoring-resource-flow-source.test.ts`

Contracts:

- Native `alert('请输入标题')` is removed from the builder flow.
- Validation, save, add, remove, and error messages update an inline `role="status"` / `aria-live="polite"` region.
- The builder declares `data-playlist-builder-mobile-steps="library-selection-then-course-flow"` and uses two compact panels that stack on mobile.
- Selected item controls include action-specific accessible names for interaction type, duration, move up, move down, and remove.

Audit findings:

- 215: closed.
- 216: closed for selected course-flow item controls.
- 219: closed for source-level staged mobile structure; no screenshot claim is made here.
- 369, 372: partially remediated for playlist-builder status and structure.

### ResourceNode and Knowledge Node Authoring Names

Files:

- `src/features/teacher/resources/teacher-resource-node-management.tsx`
- `src/features/teacher/resources/knowledge-node-manager.tsx`
- `src/app/__tests__/authoring-resource-flow-source.test.ts`

Contracts:

- ResourceNode filters expose stable `aria-label` values.
- ResourceNode selection and load-more actions expose object-specific labels.
- Knowledge-node expand/collapse and load-more actions expose stable labels.

Audit findings:

- 365, 375: partially remediated for control naming and list operation clarity.
- 370: partially remediated for authoring control usability, not for every long mobile page.

### Knowledge Graph Tool and Mobile Filter Groups

Files:

- `src/features/knowledge/knowledge-graph-system.tsx`
- `src/app/__tests__/authoring-resource-flow-source.test.ts`

Contracts:

- Desktop graph tools expose stable labels such as ``aria-label={`${item.label}工具`}``.
- Mobile relation controls are grouped into `details` sections with:
  - `data-knowledge-mobile-filter-group="density-mode"`
  - `data-knowledge-mobile-filter-group="relation-types"`
  - `data-knowledge-mobile-filter-group="advanced-thresholds"`

Audit findings:

- 217: closed.
- 218: closed for source-level mobile filter grouping.
- 380: partially remediated for stable graph follow-up controls.

## Verification

Commands run:

```bash
rtk npx vitest run src/app/__tests__/authoring-resource-flow-source.test.ts src/app/__tests__/playlist-play-page.test.ts src/features/knowledge/__tests__/playlist-route.test.ts src/features/teacher/__tests__/teacher-resource-node-management-component.test.ts src/lib/__tests__/teacher-resource-node-management.test.ts
rtk npx eslint 'src/app/playlists/[id]/play/page.tsx' src/features/knowledge/playlist-builder.tsx src/features/knowledge/knowledge-graph-system.tsx src/features/teacher/resources/knowledge-node-manager.tsx src/features/teacher/resources/teacher-resource-node-management.tsx src/app/__tests__/authoring-resource-flow-source.test.ts src/app/__tests__/playlist-play-page.test.ts --max-warnings=0
rtk openspec validate audit-remediation-authoring-knowledge-flow-polish --strict
rtk git diff --check
```

Results:

- Vitest: 5 files passed, 33 tests passed.
- ESLint: passed with `--max-warnings=0`.
- OpenSpec validation: valid.
- Diff whitespace check: passed.

## Residual Work

- This evidence is source-contract and targeted-test based. It does not include fresh browser screenshots for 320px/390px visual height.
- Broader authoring page mobile length issues outside playlist builder and knowledge graph filters remain open.
- Deep-link runtime behavior already covered by #618 is not re-proven here except for playlist play unavailable recovery.
