## Tasks

- [ ] 1. Run helper after core, long-form, and assessment item resources are reviewed, then isolate path-relevant evidence-lineage blockers.
  - Separate EventDictionary gaps, client event id gaps, attempt key gaps, source event gaps, stale caches, path execution evidenceRef gaps, and Yang Fan fixture blockers.

- [ ] 2. Complete evidence contracts for path-relevant resource types.
  - Define event type, clientEventId, attemptKey, source log, dedupe, timestamp, LearningFact, confidence, and privacy behavior.

- [ ] 3. Repair instrumentation and materialization gaps.
  - Add or update EventDictionary mappings, source attribution, path execution evidence refs, and cache refresh behavior where required.

- [ ] 4. Add evidence-lineage tests.
  - Verify path-relevant resource events can materialize traceable LearningFacts and path execution evidence without exposing private raw payloads.

- [ ] 5. Validate the change.
  - Run `rtk openspec validate complete-resource-evidence-lineage-readiness --strict`.
  - Run helper and targeted evidence-lineage tests.
  - Preserve helper summarized evidence: layer totals, finding counts, follow-up buckets, evidence-lineage blockers, and Yang Fan fixture blockers.
