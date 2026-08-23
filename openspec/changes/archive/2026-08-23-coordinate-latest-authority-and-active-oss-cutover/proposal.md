## Why

The production Authority, Teaching Projection, and OSS Runtime Release can currently advance through independent selectors, while formal resource binding is scoped to a future candidate and the teaching-relation contract permits production use with prerequisite or association work still pending. Switching to a newer graph under those rules can expose a mixed product state, silently remove existing teaching resources, or activate an incomplete teaching projection.

## What Changes

- Capture the execution-time latest complete formal ActKG composite release from the local ActKG checkout, seal its commit, tags, component identities, and hashes, and reuse the existing adapter only when the public Schema and consumer contract remain compatible. Schema or contract incompatibility fails closed and requires a separate adaptation change.
- Freeze the successor Runtime Release denominator as the complete logical-resource inventory of the production-active OSS Runtime Release plus explicitly declared new or changed release inputs. Historical OSS releases, orphaned objects, and workspace scans cannot enlarge or shrink that denominator.
- Reuse unchanged atomic resource bindings and relation decisions by complete content and dependency identity; recompute only resources, atoms, Canonical revisions, scopes, roles, pipelines, or launch contracts that changed.
- **BREAKING** Protect the existing production teaching-resource inventory from technical exclusion: every retained teaching resource must complete atomic binding, and only an explicit course-owner retirement decision may remove it. Failed new resources remain development-only and do not enter the successor release.
- **BREAKING** Require complete containment, prerequisite, and pedagogical-association dispositions for every member of the sealed course active-domain scope before coordinated production selection. Evidence-backed `NO_RELATION` is valid, fabricated edges are forbidden, and unresolved review items must be zero.
- Build one acyclic immutable identity graph: seal a coordination allocation record first, let inner Authority-derived artifacts bind only that allocation and earlier inputs, then seal an outer coordinated candidate receipt over their exact hashes. Activation uses a journaled transaction identity for inner mutation receipts and a final outer active receipt over the committed combination.
- Generate same-Schema candidate artifacts without a version-specific adaptation spec, but keep candidate qualification, deployment, and production activation as independent authorities. Production selectors move only through an explicitly authorized stopped-service transaction that restores the whole predecessor combination on failure.

## Capabilities

### New Capabilities

- `latest-authority-active-oss-resource-cutover`: Defines execution-time Authority capture, active OSS resource continuity, incremental derivation, coordinated candidate qualification, selector commit, and whole-combination rollback.

### Modified Capabilities

- `act-canonical-teaching-relation-governance`: Adds a coordinated-production gate requiring final dispositions for all three teaching-relation families and zero unresolved candidates.
- `act-teaching-projection`: Requires coordinated production consumers to select a complete projection bound to the exact captured Authority, course scope, and coordinated receipt.
- `content-addressed-runtime-release-storage`: Requires the successor Runtime Release identity and active receipt to close over the coordinated Authority/resource predecessor and successor combinations.

## Impact

- Builds on the archived `gate-formal-runtime-resources-on-canonical-bindings` capability now present in the main specs. Implementation must reuse its formal-resource envelope and Runtime Release v2 authority rather than recreating or bypassing them.
- Affects Authority release intake and compatibility checks, ACT Teaching Projection governance, resource-binding cache invalidation, Runtime Release v2 inventory and receipts, domain-shard and consumer selectors, production cutover journaling, rollback, readiness, and governance evidence.
- Does not modify ActKG authoring data, create a runtime review role or service, require a resource or relation edge for every Canonical Object, reinterpret Engineering relations as teaching facts, or automatically activate later ActKG releases.
- The accepted scope and trade-offs are recorded in `docs/grill/20260823-am/CONTEXT.md` and `docs/grill/20260823-am/adr/20260823-coordinate-latest-authority-and-active-oss-resource-cutover.md`.
