## Context

Several interactive lessons render activity cards through shared manifest runtime components, but student pages still decide locally how to save state and emit submit telemetry. Some pages already call `buildManifestSubmissionTelemetry`, while 5-1 emits only `stepId`, `attemptKey`, and a small flag. The server faithfully persists what it receives, so missing answer evidence becomes a permanent data-quality issue.

## Goals / Non-Goals

**Goals:**

- Make one shared submission path the default for manifest lessons.
- Make submitted answers durable outside mutable `StudentState`.
- Produce objective scoring evidence usable by reports, facts, and later backfills.
- Preserve backward compatibility for legacy event payloads.

**Non-Goals:**

- Migrate all module 5 pages in this change.
- Change lesson content, page order, or authoring contracts.
- Backfill historical production data.

## Decisions

### Decision: Put submission evidence generation in a shared manifest controller

The shared controller should accept `step`, `stepManifest`, `response`, optional `extraEvidence`, and existing state-save callbacks. Course pages should not assemble the event envelope by hand. This reduces lesson-specific drift and keeps future courses inside one data contract.

### Decision: Store a versioned evidence envelope

The envelope should include `schemaVersion: "manifest-submission-v2"` so consumers can distinguish rich evidence from legacy submit events. The envelope should carry `answers`, `answerDigest`, `questionSummaries`, `score`, `correctCount`, `objectiveTotal`, `subjectiveCompleteness`, `misconceptionTags`, and `parameterSnapshots` where available.

### Decision: Score server-side from the submitted envelope

The front end may provide question summaries, but `LearningFact` materialization should still validate or normalize score fields from the envelope. This avoids trusting arbitrary client-only scores while preserving a readable event payload.

### Decision: Legacy events remain valid but lower confidence

Submit events without the v2 envelope should still create durable records. They should be marked as `evidenceQuality: "legacy-envelope"` or equivalent so reports can avoid overclaiming diagnostic precision.

## Risks / Trade-offs

- [Risk] Front-end and server scoring may diverge. Mitigation: centralize answer normalization helpers and test the same answer forms.
- [Risk] Subjective answers can contain long or sensitive text. Mitigation: persist structured digest and completeness markers; keep full text only when existing policy allows it.
- [Risk] Course-specific parameter panels need extra evidence. Mitigation: support `extraEvidence` under a controlled namespace instead of per-course event schemas.

## Migration Plan

1. Add the shared controller and v2 envelope builder.
2. Route at least one representative lesson through the shared path for tests.
3. Extend API persistence and LearningFact materialization.
4. Extend session reports with evidence quality counts.
5. Leave full module 5 migration to the dependent change.
