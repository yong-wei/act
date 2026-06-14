# State/effect warning delta for #494

Scope: first remediation batch only; global totals include unrelated upstream changes.

- Baseline touched state/effect warnings: 9
- After touched state/effect warnings: 3
- Delta: -6

## By touched file and rule

| File | Rule | Baseline | After | Delta |
| --- | --- | ---: | ---: | ---: |
| `src/components/classroom/PollComponent.tsx` | `no-derived-state` | 1 | 0 | -1 |
| `src/features/interactive/shared/manifest-runtime/content-renderers.tsx` | `no-derived-state` | 1 | 0 | -1 |
| `src/features/interactive/shared/manifest-runtime/content-renderers.tsx` | `no-derived-state-effect` | 1 | 0 | -1 |
| `src/features/interactive/shared/manifest-runtime/content-renderers.tsx` | `no-reset-all-state-on-prop-change` | 1 | 0 | -1 |
| `src/features/interactive/unit-2-1-modeling-language/step-panels.tsx` | `no-derived-state` | 1 | 0 | -1 |
| `src/features/interactive/unit-2-1-modeling-language/step-panels.tsx` | `no-derived-state-effect` | 1 | 0 | -1 |
| `src/features/interactive/unit-2-1-modeling-language/student-page.tsx` | `no-pass-data-to-parent` | 3 | 3 | 0 |

## Remaining touched diagnostics

- `src/features/interactive/unit-2-1-modeling-language/student-page.tsx:151` `no-pass-data-to-parent` Data passed to parent via effect
- `src/features/interactive/unit-2-1-modeling-language/student-page.tsx:153` `no-pass-data-to-parent` Data passed to parent via effect
- `src/features/interactive/unit-2-1-modeling-language/student-page.tsx:159` `no-pass-data-to-parent` Data passed to parent via effect

## Global rule snapshot

- `no-chain-state-updates`: baseline 20, after 20, delta 0
- `no-derived-state`: baseline 70, after 67, delta -3
- `no-derived-state-effect`: baseline 18, after 16, delta -2
- `no-pass-data-to-parent`: baseline 228, after 228, delta 0
- `no-pass-live-state-to-parent`: baseline 60, after 60, delta 0
- `no-prop-callback-in-effect`: baseline 61, after 61, delta 0
- `no-reset-all-state-on-prop-change`: baseline 8, after 7, delta -1
