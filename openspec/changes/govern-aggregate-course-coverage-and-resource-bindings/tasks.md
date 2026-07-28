## 1. Establish the aggregate governance inputs

- [ ] 1.1 Verify that `adopt-ctkg-0-2-aggregate-release-contract` is complete and capture the accepted aggregate ReleaseSet, projection digest, component membership, and clean ACT Git revision.
- [ ] 1.2 Identify the exact system-modeling objects newly introduced relative to the historical root-locus component and generate a stable item-by-item disposition manifest.
- [ ] 1.3 Update the Git-governed CourseCoverage authoring schema and source identity from the old root-locus release to the aggregate ReleaseSet without treating the release name as course completeness.

## 2. Govern aggregate course coverage

- [ ] 2.1 Review every newly introduced system-modeling object against the Canonical semantic profile and course sources, recording exactly one course role or `excluded_with_rationale` with source evidence and review version.
- [ ] 2.2 Validate unique object identity, aggregate membership, allowed disposition, rationale, source evidence, and exhaustive manifest coverage before import.
- [ ] 2.3 Import the aggregate CourseCoverage transactionally with authoring revision, release hash, projection digest, and capture identity; keep uncovered objects browsable but unavailable to teaching consumers.
- [ ] 2.4 Add tests proving coverage roles do not create prerequisite, containment, sequence, association, or other missing Teaching Projection relations.

## 3. Resolve upstream references to ACT structural units

- [ ] 3.1 Consume and verify the immutable upstream RAG reference records imported by Change A; add or extend only ACT EvidenceStructuralUnitCrosswalk and resource teaching-role records, without copying or re-importing upstream authority data.
- [ ] 3.2 Build the deterministic alignment path for verified stable ID/hash matches and require source edition, structural unit/version/hash, inventory run, capture revision, atomic resource/segment, and validation digest.
- [ ] 3.3 Build node-driven semantic candidates against one versioned ACT structural-unit index when deterministic identity is unavailable, without treating opaque upstream IDs as content proof.
- [ ] 3.4 Add isolated GPT review that receives only the Canonical profile, exact candidate text, structural identities, upstream reference, and evidence; route ambiguous, conflicting, unsupported, or high-impact results to the existing human queue.
- [ ] 3.5 Re-run endpoint, version, hash, uniqueness, aggregate identity, and coherent-capture gates before publishing any ACT Crosswalk; keep unresolved references explicit.

## 4. Re-run canonical resource binding governance

- [ ] 4.1 Capture the effective-resource inventory and structural-unit index from the same clean ACT revision and database watermark used by the Crosswalk run.
- [ ] 4.2 Re-run #1124 node-change/resource-change candidate generation under the aggregate ReleaseSet using the existing pair, review, dispute, and publication contracts.
- [ ] 4.3 Reuse prior semantic work only when Canonical semantic digest, resource/segment hash, role, prompt/reviewer version, evidence, and structural gates remain valid; create a new aggregate revalidation receipt rather than copying old publication identity.
- [ ] 4.4 Publish accepted results only as `SHADOW_PUBLISHED` and prove that RAG, recommendation, path, evidence, and learning-fact production selectors remain Legacy.
- [ ] 4.5 Produce an auditable aggregate summary of included, excluded, unresolved, Crosswalk, binding, stale, and cutover-blocked counts without exposing resource text, model prompts, user data, or local paths.

## 5. Verify governance and downstream readiness

- [ ] 5.1 Add unit/database tests for exhaustive coverage dispositions, coherent capture, opaque-reference handling, deterministic and semantic alignment, isolated review, drift invalidation, revalidation, and shadow-only publication.
- [ ] 5.2 Run the aggregate coverage import, reference alignment, inventory, Crosswalk, candidate, review, and verify-only commands against a local database and confirm repeatability.
- [ ] 5.3 Run targeted coverage/resource-binding suites, data-governance checks, typecheck, build, and strict OpenSpec validation.
- [ ] 5.4 Update project documentation and downstream readiness diagnostics to state that RAG consumes validated ACT Crosswalks, KAQ consumes CourseCoverage, SAR consumes reviewed bindings, and paths/facts/cutover still wait for formal Teaching Projection.
