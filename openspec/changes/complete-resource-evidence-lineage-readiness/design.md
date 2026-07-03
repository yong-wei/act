## Design

Resources enter path planning in two ways:

- as learning resources selected by the planner;
- as evidence-producing resources that affect completion, remediation, mastery, readiness, or personalization.

Both require source-event lineage. This change runs after core resources, long-form resources, and assessment item catalog resources are reviewed, so it can address the helper's evidence-lineage buckets for the full path-relevant resource set:

- EventDictionary mapping;
- clientEventId policy;
- attemptKey policy;
- timestamp policy;
- sourceLogId and sourceEventId linkage;
- LearningFact materialization policy;
- feature cache refresh and source coverage;
- path execution evidenceRefs.

## Boundary

Historical records may remain partial if they are legacy-only and not used for current path planning. Current and future path-relevant resources must have complete contracts. Any legacy limitation must be represented as a reviewed limitation rather than silently counted as valid path evidence. The final helper evidence must include summarized layer totals, finding counts, follow-up buckets, evidence-lineage blockers, and Yang Fan fixture blockers.
