## Context

Current diagnostics on 2026-06-14:

- Error-only React Doctor scan: 0 diagnostics.
- Owned-surface error gate: 0 diagnostics.
- Owned-surface Security gate: 0 selected diagnostics.
- Owned-surface warning summary: 3,418 advisory diagnostics.

The highest-volume warning rules mix true defects and scanner limitations:

- True product risks: `button-has-type`, control labels, media captions, keyboard handlers, App Router query boundaries, client fetch for server data, effect-driven parent sync.
- Mechanical cleanup: unused exports, unused files, component-only exports, metadata, simple array-iteration performance findings.
- Tool-noise candidates: R3F/Three JSX reported as DOM `no-unknown-property`.

## Decisions

1. Keep blocker and advisory channels separate.
   - Errors and Security warnings remain clean gates.
   - Warning summaries remain local evidence and planning input.

2. Classify before fixing.
   - Each remediation change must declare the rule families it owns.
   - R3F/Three findings require classification and runtime visual evidence before any suppression or rewrite.

3. Use delta evidence, not absolute-count promises.
   - Individual changes should prove their owned rule/file scope improves without increasing blocker diagnostics.
   - The series can reduce the 3,418 baseline incrementally.

## Baseline Buckets

| Bucket | Representative rules | Expected handling |
| --- | --- | --- |
| Product risk | `button-has-type`, `control-has-associated-label`, `label-has-associated-control`, `nextjs-no-use-search-params-without-suspense`, `no-pass-data-to-parent` | Direct remediation with focused tests or browser evidence |
| Mechanical cleanup | `unused-export`, `unused-file`, `only-export-components`, `nextjs-missing-metadata` | Graph-backed cleanup or documented deferral |
| Tool-noise candidate | R3F/Three `no-unknown-property` | Classify, allowlist, or wrap with proof of unchanged scene behavior |

## Open Questions

- Should warning deltas be stored only in `artifacts/react-doctor/`, or also summarized in `artifacts/commercial-ui/evidence.json` when UI governance depends on them?
- Should mechanical module hygiene be allowed to delete unused legacy files in the same change, or should deletion require separate review?
