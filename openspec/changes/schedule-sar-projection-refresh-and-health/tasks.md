## Tasks

- [ ] 1. Define SAR refresh source families and health status contract.
  - Include source versions, last refresh timestamps, stale counts, failures, retries, and limitations.

- [ ] 2. Implement refresh orchestration over persisted SAR records.
  - Reuse existing SAR projection builders and persisted upsert contract.
  - Record manual refresh actions through governance operation evidence.

- [ ] 3. Surface SAR refresh health to administrators.
  - Show fresh, stale, degraded, and failed states without exposing restricted raw content.

- [ ] 4. Preserve Arena official evaluation source authority.
  - Ensure SAR refresh uses official Arena records for score, validity, ranking, attempt policy, and evaluation metrics.
  - Mark LearningFact, SAR trace, and KAQ writeback data as learning evidence context only.

- [ ] 5. Validate the change.
  - Run `rtk openspec validate schedule-sar-projection-refresh-and-health --strict`.
  - Run targeted SAR refresh, operation ledger, and admin governance tests.
