## Tasks

- [ ] 1. Add a SAR diagnostics entry point to the admin data-governance surface.
  - Render the existing `sarDiagnostics` payload in a dashboard panel or dedicated linked route.
  - Include counts, trace summaries, Source Pack handoff, verified citation rate, privacy rejections, limitations, and demo fixture status.

- [ ] 2. Preserve SAR privacy boundaries in the visible UI.
  - Do not expose raw learner answers, hidden Arena internals, private Konling memory, or raw audit traces.
  - Keep SAR candidates visually distinct from verified citations.

- [ ] 3. Clean up the archived SAR spec Purpose.
  - Replace the placeholder `TBD` Purpose with a stable description of SAR's governed role and boundaries.

- [ ] 4. Add focused tests for the admin SAR diagnostics surface.
  - Cover rendered diagnostics when data is present.
  - Cover absent/degraded diagnostics state.
  - Assert forbidden raw fixture strings are not rendered.

- [ ] 5. Validate the change.
  - Run `rtk openspec validate expose-sar-diagnostics-admin-surface --strict`.
  - Run strict validation for affected specs if the implementation edits archived specs.
  - Run the targeted admin governance and SAR diagnostics tests.
