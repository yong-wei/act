# C5 writer ledger

C0 capture: `09fa54739c74a5005b7f3131bf3c85dcf79ff01a`
Canonical write API: `ingestLearningFact` / `stageLearningFactIngestion`
Event protocol: existing `learning-record-event-contract` registry only

## Isolated this change

- Historical apply no longer records online projection triggers; apply requires `operationId`, `authorizedBy`, `frozenCutoff`.
- Redis secondary worker still calls idempotent `ingestLearningFact`; duplicates are isolated by ingest dedupe, never ACK-skipped.

## Already retired (unchanged)

- Destructive Redis `RPOP` / `LTRIM`
- `persistCoreLearningFact` production callers other than ingest

## C6/C7 exceptions (not migrated here)

- Assessment/Personalization adapters still in `data-governance` / plugin writeback
- Arena official writeback
- Teacher document-rubric / approve route
- Control-correction path rounds

Machine-readable rows: `src/features/learning-record/write-boundary/inventory.ts`
