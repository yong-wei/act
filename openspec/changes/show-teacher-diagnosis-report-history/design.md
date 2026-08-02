## Context

The repository already contains role-based diagnosis panels for cumulative learning views. `DiagnosisReport` is a different persisted artifact: it is generated at an evidence cutoff, retains governed findings and limitations, and can be revisited without rerunning AI. The new surface must not collapse those two concepts or create a separate assistant portal.

## Decisions

### Reports appear as a read-only evidence ledger

The class and student workspaces host a shared newest-first report ledger. Selecting an entry changes only the displayed persisted snapshot. Viewing, refreshing, or selecting a report never generates or writes a report.

### The API returns an explicit browser projection

The route serializes report timestamps and exports a stable response type. The browser receives allowlisted report fields already selected by the persistence service. Opaque evidence references are used only to calculate counts and are not rendered as identifiers.

### Degraded evidence remains visible

Low or unavailable confidence and non-empty limitations produce a visible degraded state. Empty history is not treated as a zero-score diagnosis. Request failures remain distinct from an empty authorized history.

### Existing teacher workspaces own navigation

Class reports live in the class workspace and student reports live in the existing class-bound student detail. Findings may expose only the server-generated preparation link. The surface does not introduce a new portal or automatic intervention.

## Risks and mitigations

- Report JSON could leak governed identifiers. The component does not render evidence refs and tests assert private/raw keys are absent.
- Historical reports may be mistaken for current state. The selected entry always shows generated time and evidence cutoff.
- A large history could dominate the page. The API remains bounded and the selector uses a compact horizontal ledger on small screens.

## Verification

- Static rendering tests cover class/student scope, history selection, degraded state, preparation links, and privacy omissions.
- Existing persistence authorization tests continue to cover class ownership and membership.
- Targeted typecheck, lint, strict OpenSpec validation, and browser evidence cover the integrated workspaces.
