## 1. Versioned evaluation assets

- [x] 1.1 Define the blind-audit manifest schema: item list, expected counts, model/provider, prompt version, score version, and benchmark version.
- [x] 1.2 Ship a versioned fixture benchmark (`blind-audit-v1`) with rule-score and blind-audit items, and record the manifest content hash for resume-time drift checks.

## 2. Resumable runner and atomic store

- [x] 2.1 Implement the artifacts store: run directory creation with an exclusive run lock, atomic per-record writes via temp file + rename, orphan temp cleanup, and never-overwrite semantics for frozen records.
- [x] 2.2 Implement the runner loop: skip already-completed task keys, retry failure keys at most once per run, and persist model/provider/prompt/score versions, timestamps, git revision, and structured error codes in every record.
- [x] 2.3 Add fixture and live script entrypoints following the diagnosis-benchmark conventions (deterministic fixture mode by default, explicit opt-in live mode).

## 3. Integrity-gated aggregation

- [x] 3.1 Implement aggregation that compares expected vs completed counts, marks incomplete batches, and refuses to emit official metrics for incomplete or mixed-configuration batches.
- [x] 3.2 Keep rule-score and blind-audit records and summaries in separate subtrees; cross-mode mixing fails closed.

## 4. Failure-injection and resume tests

- [x] 4.1 Fault-injection tests for rate limiting, timeout, insufficient balance, and per-record parse failure: verify records persist, retries recover, completed items are not re-billed, and repeated runs change nothing frozen.
- [x] 4.2 Resume tests that interrupt at arbitrary completion ratios and continue to full completion; integrity gate tests for incomplete batches and manifest drift.
