## Context

This change supplies the root-locus, frequency-domain and classical-control-design teaching fragments after the incremental projection contract exists.

## Goals / Non-Goals

**Goals:** publish reviewed direct learning dependencies and core-node membership for the three classical-control domains.

**Non-Goals:** convert `derived_from`, `applies_to` or association predicates into prerequisites; complete all possible semantic coverage.

## Decisions

1. Review domain candidates against course objectives, teaching materials and explicit curation rather than engineering graph proximity.
2. Keep direct teaching order separate from engineering derivation, representation, application and analysis families.
3. Publish partial valid fragments with visible coverage status; incomplete candidate review does not block the fragment.
4. Validate local endpoint closure and REQUIRED-edge acyclicity before composition.

## Risks / Trade-offs

- [Design methods form ambiguous order] → Use RECOMMENDED when the dependency is advisory and omit unsupported order.
- [Duplicate edges arise across domain membership] → Use deterministic edge identity and let the composed projection reject conflicts.

## Migration Plan

Review and publish the three domain fragments as one content increment; rollback selects the previous Teaching Projection.
