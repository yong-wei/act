## Context

After domain-local fragments are available, a global combination is needed so foundation, classical and modern shards can be validated together. Composition is the first point where endpoint closure, duplicates and the REQUIRED-edge DAG can be assessed against one Authority selection. The current worklists do not contain an admissible new direct ACT_TEACHING cross-domain edge.

## Goals / Non-Goals

**Goals:** publish a new generation-3 combination that reseals the existing foundation, classical and modern teaching shards against one fixed complete Authority envelope, add an empty cross-domain fragment, and validate the composed graph with the unrelaxed composer.

**Non-Goals:** invent direct cross-domain edges from engineering adjacency, visual portals or transfer relations; mutate published generation-2 / modern / foundation / classical bytes; relax `nodeIndexDigest` consistency; generate a transitive closure; force a total course order; or block publication on incomplete coverage.

## Decisions

1. **Scheme B is the accepted publication path.** Do not compose the published modern two-node envelope with the generation-2 4891-node envelope. Publish a new `generation-3/` combination that reseals every accepted shard against the same pinned complete Authority snapshot.
2. **`nodeIndexDigest` consistency is not relaxed.** Every generation-3 fragment, the empty cross-domain fragment and the composed manifest MUST share one `authoritySelection`, including the complete-envelope `nodeIndexDigest`. `compose.ts` / `validate.ts` safety contracts stay unchanged.
3. **Old published bytes stay immutable.** generation-2, modern, foundation and classical published files are read-only inputs. generation-3 may only write its dedicated directory.
4. **Each upstream artifact is pinned.** The new generation records path, original byte digest, original published/semantic digest, resealed digest, the fixed snapshot binding, and an explicit conversion protocol. Any upstream, Authority, source or semantic drift fails closed.
5. **Equivalence allowlist is closed.** Semantic equivalence may differ only on the explicitly listed Authority envelope / generation / provenance identity fields. Broad recursive field deletion is forbidden.
6. **Reuse existing builders.** Obtain the fixed complete envelope and foundation/classical reseal semantics from `buildDomainTeachingGenerationV2`. Obtain modern empty shards from `buildModernControlDomainArtifacts(domain, authority, repoRoot)` under that same full envelope.
7. **The cross-domain fragment is empty.** Review only collected worklist candidates. There is currently no admissible direct ACT_TEACHING candidate, so `coreNodes`, `relations` and the denominator stay zero. Coverage remains non-blocking.
8. **Composition uses the unrelaxed composer.** `composeDomainTeachingProjection` must succeed for endpoint closure, deterministic identity, duplicate conflicts and the global REQUIRED-edge DAG.

## Conversion protocol

Allowed identity changes when comparing an upstream published artifact with its generation-3 reseal:

- generation identity: `fragmentKey`, `fragmentId`, `fragmentDigest`
- Authority envelope identity: `nodeIndexDigest`, `authoritySelection.nodeIndexDigest`, `authorityDigest`, `authorityNodeIds`
- derived provenance digests that include those identity fields: `sourceDigest`, `inputDigest`

All other fields, including teaching payload, unresolved DEFER candidates, empty denominators, evidence, `authorityBinding`, `sourceDatasetHash` and `captureRevision`, must remain identical. Missing or extra non-allowlisted fields fail closed.

## Risks / Trade-offs

- [A real curriculum contains alternative orders] → Model advisory alternatives as RECOMMENDED later; this increment publishes an empty cross-domain fragment rather than a forced order.
- [A global cycle is discovered] → Block only the candidate generation-3 projection, preserve prior published fragments and return the conflicting reviewed edges to curation.
- [Envelope mismatch is tempting to paper over] → Keep fail-closed `nodeIndexDigest` comparison. Reseal modern against the complete envelope instead of weakening compose.

## Migration Plan

Read the pinned Authority snapshot and published upstream shards, reseal them into `generation-3/`, review boundary candidates, compose and validate, then persist only the new directory. Rollback retains every previously published fragment and projection.
