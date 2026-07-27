## Why

The current graph mixes course modules, navigation constructs, and semantic domains. Partitioning first requires a reviewable flat candidate manifest and a dimension-pollution queue, without prematurely fixing the final vocabulary or assigning concepts.

## What Changes

- Derive flat top-level domain candidates with unique proposed names, definitions, inclusion/exclusion boundaries, evidence, and review status.
- Define migration rules for existing mixed-dimension values such as course overview, module, rapid-track, structural, constraint, migration, and frontier labels.
- Keep multi-domain membership possible while prohibiting child-domain trees and free-form domain values.
- Exclude final concept-domain ownership and membership decisions.

## Capabilities

### New Capabilities

- `controlled-knowledge-domain-candidate-manifest`: defines domain candidates and dimension-pollution review records without fixing final cardinality.

### Modified Capabilities

- None.

## Impact

- Produces an offline vocabulary manifest used by semantic partitioning.
- Does not change UI navigation, node metadata, runtime projections, course structure, or database records.
## ADR 0045 Boundary

Domain candidates derive only from current formal-course anchors and current authoring truth. Historical learner facts, events, derived state, and inactive legacy references cannot establish domain membership or readiness.
