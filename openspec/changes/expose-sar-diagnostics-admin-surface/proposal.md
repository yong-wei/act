## Why

The SAR implementation is now present as contracts, projection, association expansion, Konling grounding, Graph Center candidate evidence, path-planner candidate handling, diagnostics builders, and a data-governance API payload. The remaining gap from `docs/proposals/2026-06-26-sag.md` is that administrators cannot yet inspect SAR diagnostics as a first-class product surface: the report is available in the status payload, but the data-governance dashboard does not render SAR counts, trace health, Source Pack handoff, verified citation rate, privacy rejections, or demo fixture status.

The archived `structured-associative-retrieval` spec also still has an auto-generated `TBD` Purpose. That weakens the spec as a contract for future SAR work.

## What Changes

- Add an administrator-visible SAR diagnostics section or route from the data-governance dashboard.
- Render SAR projection counts, relation counts, privacy-scope distribution, query trace summaries, Source Pack handoff count, verified citation rate, privacy rejection count, limitation count, and demo fixture status.
- Preserve SAR privacy boundaries: no raw learner answers, hidden Arena internals, private Konling memory, or raw audit traces may be displayed.
- Make the SAR diagnostics UI actionable by linking it to existing data-governance/source/Graph Center review context where available.
- Update the `structured-associative-retrieval` spec Purpose from placeholder text to a stable description of SAR's role.
- Add tests and DOM-level checks proving the dashboard renders SAR diagnostics and does not expose forbidden raw content.

## Impact

- Extends `admin-data-governance-dashboard`.
- Extends `structured-associative-retrieval`.
- Does not change SAR projection, association expansion, Source Pack ranking, citation verification, path-planner authority, Prisma schema, or asynchronous indexing.
