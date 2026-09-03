# Residual Data Governance future slices

Each slice is a migration input, not authorization to act. Readers must verify subject/tool/schema identities.

## learning-record-ingress

- accountableOwner: `learning-record`
- publicBoundary: src/features/learning-record/ingestion
- notTouched: writers, anchors, times, dedupe, outbox, pointer, watermark, schema, retention
- deletionCondition: zero-direct-and-staged-callers-and-one-online-writer-proven
- rollback: preserve-append-only-facts-and-original-anchors
- paths: `src/lib/data-governance/derived-learning-materialization.ts` `src/lib/data-governance/event-buffer.ts` `src/lib/data-governance/event-normalization.ts` `src/lib/data-governance/event-protocol.ts` `src/lib/data-governance/event-types.ts` `src/lib/data-governance/evidence-source-catalog.ts` `src/lib/data-governance/evidence-timeline.ts` `src/lib/data-governance/interactive-event-ingestion.ts` `src/lib/data-governance/interactive-evidence-scoring-recompute.ts` `src/lib/data-governance/learning-fact-materialization.ts` `src/lib/data-governance/learning-fact-quality-weight.ts` `src/lib/data-governance/session-fact-replay.ts` `src/lib/data-governance/trusted-learning-fact-filter.ts` `src/lib/data-governance/unit-4-1-submission-telemetry.ts` `src/lib/data-governance/unit-4-4-submission-telemetry.ts` `src/lib/data-governance/worker-client.ts`

## assignment-evidence

- accountableOwner: `learning-record`
- publicBoundary: Assignment public API plus approved-snapshot port
- notTouched: C16-orchestration, LearningFact-from-routes, CAS, idempotency
- deletionCondition: zero-unclassified-callers-and-complete-snapshot-lineage
- rollback: preserve-approved-snapshots-CAS-idempotency-derivatives-outbox
- paths: `src/lib/data-governance/assignment-attachment-understanding.ts` `src/lib/data-governance/math-document-conversion.ts` `src/lib/data-governance/math-document-grading-api.ts` `src/lib/data-governance/math-document-grading-batch.ts` `src/lib/data-governance/math-document-grading-contracts.ts` `src/lib/data-governance/math-document-grading-evaluator.ts` `src/lib/data-governance/math-document-grading-lifecycle.ts` `src/lib/data-governance/math-document-grading-persistence.ts` `src/lib/data-governance/math-document-grading-queue.ts` `src/lib/data-governance/math-document-grading-review.ts` `src/lib/data-governance/math-document-grading-worker-readiness.ts` `src/lib/data-governance/math-document-word-representation.ts` `src/lib/data-governance/submission-evidence-quality.ts` `src/lib/data-governance/teacher-assignment-resubmission-intake.ts` `src/lib/data-governance/teacher-assignment-review-derivative-storage.ts` `src/lib/data-governance/teacher-assignment-review-derivative.ts` `src/lib/data-governance/teacher-assignment-review-outbox.ts`

## portrait-profile

- accountableOwner: `personalization`
- publicBoundary: Portrait V2/profile read and refresh ports
- notTouched: portrait-algorithms, StudentCompetency-compatibility, freshness, current-pointers
- deletionCondition: all-readers-use-governed-ports
- rollback: keep-last-qualified-generation
- paths: `src/lib/data-governance/competency-engine.ts` `src/lib/data-governance/competency-model.ts` `src/lib/data-governance/cumulative-class-materialization.ts` `src/lib/data-governance/cumulative-learner-state.ts` `src/lib/data-governance/cumulative-portrait-read-model.ts` `src/lib/data-governance/growth-evaluation.ts` `src/lib/data-governance/portrait-reconciliation-access.ts` `src/lib/data-governance/portrait-v2-consumer.ts` `src/lib/data-governance/portrait-v2-incremental-update.ts` `src/lib/data-governance/portrait-v2-materialization.ts` `src/lib/data-governance/portrait-v2-migration.ts` `src/lib/data-governance/portrait-v2-model.ts` `src/lib/data-governance/portrait-v2-primary-gate.ts` `src/lib/data-governance/profile-center.ts` `src/lib/data-governance/profile-portfolio-evidence.ts` `src/lib/data-governance/risk-detector.ts` `src/lib/data-governance/student-evidence-feature-cache.ts`

## classroom-session

- accountableOwner: `classroom`
- publicBoundary: authorized class/session read and finalization ports
- notTouched: class-student-authorization, redaction, independent-learner-suppression, backfill-isolation
- deletionCondition: worker-scheduler-and-report-callers-closed
- rollback: preserve-immutable-session-snapshots-and-receipts
- paths: `src/lib/data-governance/class-attribution.ts` `src/lib/data-governance/class-scoped-learning-materialization.ts` `src/lib/data-governance/class-session-attribution.ts` `src/lib/data-governance/course-review-prepost-tracking.ts` `src/lib/data-governance/interactive-session-finalization.ts` `src/lib/data-governance/session-closure-outbox.ts` `src/lib/data-governance/session-closure-phases.ts` `src/lib/data-governance/session-data-quality-report.ts` `src/lib/data-governance/session-finalization-snapshots.ts` `src/lib/data-governance/session-quality-status.ts` `src/lib/data-governance/session-reports.ts`

## simulation-arena

- accountableOwner: `practice-lab`
- publicBoundary: official Arena submission and governed simulation-task evidence ports
- notTouched: ArenaSubmission-scoring, preview-open-isolated-as-official, UI-as-writer
- deletionCondition: official-result-and-context-only-paths-proven
- rollback: preserve-ArenaSubmission-and-fact-identity
- paths: `src/lib/data-governance/control-workbench-run-context.ts` `src/lib/data-governance/simulation-agent-evidence-materialization.ts` `src/lib/data-governance/simulation-scene-run-persistence.ts` `src/lib/data-governance/simulation-task-catalog.ts` `src/lib/data-governance/simulation-task-completion.ts` `src/lib/data-governance/simulation-task-evidence.ts` `src/lib/data-governance/simulation-task-learning-fact.ts` `src/lib/data-governance/simulation-task-materialization.ts` `src/lib/data-governance/simulation-task-portrait-projection.ts` `src/lib/data-governance/simulation-task-reconciliation.ts`

## knowledge-resource-sar

- accountableOwner: `knowledge`
- publicBoundary: knowledge/resource/SAR public adapters
- notTouched: knowledge-authority, release-selectors, resource-registry, teaching-admission
- deletionCondition: public-adapters-and-privacy-scopes-singular
- rollback: leave-release-and-catalog-identities-unchanged
- paths: `src/lib/data-governance/autocontrol-kaq-graph-catalog.ts` `src/lib/data-governance/course-evidence-specs.ts` `src/lib/data-governance/graph-center-evidence.ts` `src/lib/data-governance/graph-center-source-scope.ts` `src/lib/data-governance/graph-center-sources.ts` `src/lib/data-governance/graph-center.ts` `src/lib/data-governance/kaq-graph-schema.ts` `src/lib/data-governance/kaq-objective-taxonomy.ts` `src/lib/data-governance/knowledge-truth-revision.ts` `src/lib/data-governance/learning-evidence-rag-corpus.ts` `src/lib/data-governance/new-resource-semantic-completeness-gate.ts` `src/lib/data-governance/openspec-change-evidence-path.ts` `src/lib/data-governance/resource-coverage-matching.ts` `src/lib/data-governance/sar-association-expansion.ts` `src/lib/data-governance/sar-diagnostics.ts` `src/lib/data-governance/sar-persistence.ts` `src/lib/data-governance/sar-projection.ts` `src/lib/data-governance/sar-refresh.ts` `src/lib/data-governance/structured-associative-retrieval-types.ts` `src/lib/data-governance/structured-associative-retrieval.ts` `src/lib/data-governance/teacher-kaq-evidence-trace-server.ts` `src/lib/data-governance/teacher-kaq-evidence-trace.ts` `src/lib/data-governance/teacher-prep-pack-generation.ts` `src/lib/data-governance/visual-evidence-contract.ts` `src/lib/data-governance/visual-evidence-description.ts`

## operator-backfill:assignment

- accountableOwner: `assignment`
- publicBoundary: scripts/db/** scripts/ops/** scripts/data-governance/** worker/scheduler
- notTouched: online-writer, current-pointer
- deletionCondition: zero-production-consumers-and-rollback-rehearsal
- rollback: operator-receipt-and-frozen-input
- paths: `src/lib/data-governance/teacher-ai-grading-lab-artifact-store.ts` `src/lib/data-governance/teacher-ai-grading-lab-contracts.ts` `src/lib/data-governance/teacher-ai-grading-lab-controlled-experiment.ts` `src/lib/data-governance/teacher-ai-grading-lab-core.ts` `src/lib/data-governance/teacher-ai-grading-lab-dataset-store.ts` `src/lib/data-governance/teacher-ai-grading-lab-evaluation-records.ts` `src/lib/data-governance/teacher-ai-grading-lab-evaluation-store.ts` `src/lib/data-governance/teacher-ai-grading-lab-import.ts` `src/lib/data-governance/teacher-ai-grading-lab-metrics.ts` `src/lib/data-governance/teacher-ai-grading-lab-overview.ts` `src/lib/data-governance/teacher-ai-grading-lab-pdf.ts` `src/lib/data-governance/teacher-ai-grading-lab-redaction.ts` `src/lib/data-governance/teacher-ai-grading-lab-run-store.ts` `src/lib/data-governance/teacher-ai-grading-lab-runner.ts` `src/lib/data-governance/teacher-ai-grading-lab-sensitive-files.ts` `src/lib/data-governance/teacher-ai-grading-lab-split.ts` `src/lib/data-governance/teacher-ai-grading-lab-strata.ts` `src/lib/data-governance/teacher-ai-grading-lab-structured-review.ts` `src/lib/data-governance/teacher-ai-grading-publication-candidate.ts` `src/lib/data-governance/teacher-ai-grading-visual-diagnostics.ts`

## operator-backfill

- accountableOwner: `learning-record`
- publicBoundary: scripts/db/** scripts/ops/** scripts/data-governance/** worker/scheduler
- notTouched: online-writer, current-pointer
- deletionCondition: zero-production-consumers-and-rollback-rehearsal
- rollback: operator-receipt-and-frozen-input
- paths: `src/lib/data-governance/course-evidence-backfill.ts` `src/lib/data-governance/data-completeness-audit.ts` `src/lib/data-governance/historical-evidence-materialization.ts` `src/lib/data-governance/unit-4-4-backfill.ts`

## operator-backfill:personalization

- accountableOwner: `personalization`
- publicBoundary: scripts/db/** scripts/ops/** scripts/data-governance/** worker/scheduler
- notTouched: online-writer, current-pointer
- deletionCondition: zero-production-consumers-and-rollback-rehearsal
- rollback: operator-receipt-and-frozen-input
- paths: `src/lib/data-governance/cumulative-snapshot-jobs.ts`

## operator-backfill:practice-lab

- accountableOwner: `practice-lab`
- publicBoundary: scripts/db/** scripts/ops/** scripts/data-governance/** worker/scheduler
- notTouched: online-writer, current-pointer
- deletionCondition: zero-production-consumers-and-rollback-rehearsal
- rollback: operator-receipt-and-frozen-input
- paths: `src/lib/data-governance/simulation-task-historical-application.ts` `src/lib/data-governance/simulation-task-historical-dryrun.ts`

## compatibility-assets-tests:assignment

- accountableOwner: `assignment`
- publicBoundary: index.ts, assets/**, __tests__/**
- notTouched: barrel-deletion, fixture-deletion, asset-deletion
- deletionCondition: zero-consumers-and-regeneration-retention-evidence
- rollback: reversible-compatibility-surface
- paths: `src/lib/data-governance/__tests__/teacher-ai-grading-lab-cli.test.ts` `src/lib/data-governance/__tests__/teacher-ai-grading-lab-controlled-experiment.test.ts` `src/lib/data-governance/__tests__/teacher-ai-grading-lab-core.test.ts` `src/lib/data-governance/__tests__/teacher-ai-grading-lab-evaluation-records.test.ts` `src/lib/data-governance/__tests__/teacher-ai-grading-lab-evaluation-store.test.ts` `src/lib/data-governance/__tests__/teacher-ai-grading-lab-metrics.test.ts` `src/lib/data-governance/__tests__/teacher-ai-grading-lab-overview.test.ts` `src/lib/data-governance/__tests__/teacher-ai-grading-lab-pdf.test.ts` `src/lib/data-governance/__tests__/teacher-ai-grading-lab-redaction.test.ts` `src/lib/data-governance/__tests__/teacher-ai-grading-lab-run-store.test.ts` `src/lib/data-governance/__tests__/teacher-ai-grading-lab-split.test.ts` `src/lib/data-governance/__tests__/teacher-ai-grading-lab-strata.test.ts` `src/lib/data-governance/__tests__/teacher-ai-grading-lab-structured-review.test.ts` `src/lib/data-governance/__tests__/teacher-ai-grading-lab.test.ts` `src/lib/data-governance/__tests__/teacher-ai-grading-publication-candidate.test.ts` `src/lib/data-governance/__tests__/teacher-ai-grading-visual-diagnostics.test.ts`

## compatibility-assets-tests:classroom

- accountableOwner: `classroom`
- publicBoundary: index.ts, assets/**, __tests__/**
- notTouched: barrel-deletion, fixture-deletion, asset-deletion
- deletionCondition: zero-consumers-and-regeneration-retention-evidence
- rollback: reversible-compatibility-surface
- paths: `src/lib/data-governance/__tests__/class-attribution.test.ts` `src/lib/data-governance/__tests__/class-session-attribution-repair-script.test.ts` `src/lib/data-governance/__tests__/class-session-attribution.test.ts` `src/lib/data-governance/__tests__/course-review-prepost-tracking.test.ts` `src/lib/data-governance/__tests__/interactive-session-finalization.test.ts` `src/lib/data-governance/__tests__/session-data-quality-report-options.test.ts` `src/lib/data-governance/__tests__/session-data-quality-report.test.ts` `src/lib/data-governance/__tests__/session-finalization-snapshots.test.ts` `src/lib/data-governance/__tests__/session-quality-status.test.ts` `src/lib/data-governance/__tests__/session-reports.test.ts` `src/lib/data-governance/__tests__/session-route-attribution.test.ts`

## compatibility-assets-tests:knowledge

- accountableOwner: `knowledge`
- publicBoundary: index.ts, assets/**, __tests__/**
- notTouched: barrel-deletion, fixture-deletion, asset-deletion
- deletionCondition: zero-consumers-and-regeneration-retention-evidence
- rollback: reversible-compatibility-surface
- paths: `src/lib/data-governance/__tests__/autocontrol-kaq-graph-catalog.test.ts` `src/lib/data-governance/__tests__/course-evidence-specs.test.ts` `src/lib/data-governance/__tests__/graph-center-sources.test.ts` `src/lib/data-governance/__tests__/graph-center.test.ts` `src/lib/data-governance/__tests__/kaq-graph-schema.test.ts` `src/lib/data-governance/__tests__/kaq-objective-taxonomy.test.ts` `src/lib/data-governance/__tests__/learning-evidence-rag-corpus.test.ts` `src/lib/data-governance/__tests__/new-resource-semantic-completeness-gate.test.ts` `src/lib/data-governance/__tests__/openspec-change-evidence-path.test.ts` `src/lib/data-governance/__tests__/sar-association-expansion.test.ts` `src/lib/data-governance/__tests__/sar-diagnostics.test.ts` `src/lib/data-governance/__tests__/sar-persistence.test.ts` `src/lib/data-governance/__tests__/sar-projection.test.ts` `src/lib/data-governance/__tests__/sar-refresh.test.ts` `src/lib/data-governance/__tests__/structured-associative-retrieval.test.ts` `src/lib/data-governance/__tests__/teacher-kaq-evidence-trace.test.ts` `src/lib/data-governance/__tests__/teacher-prep-pack-generation.test.ts` `src/lib/data-governance/__tests__/visual-evidence-contract.test.ts` `src/lib/data-governance/__tests__/visual-evidence-description.test.ts`

## compatibility-assets-tests

- accountableOwner: `learning-record`
- publicBoundary: index.ts, assets/**, __tests__/**
- notTouched: barrel-deletion, fixture-deletion, asset-deletion
- deletionCondition: zero-consumers-and-regeneration-retention-evidence
- rollback: reversible-compatibility-surface
- paths: `src/lib/data-governance/__tests__/adaptive-learner-state-route.test.ts` `src/lib/data-governance/__tests__/adaptive-learner-state-service.test.ts` `src/lib/data-governance/__tests__/assignment-attachment-understanding.test.ts` `src/lib/data-governance/__tests__/course-evidence-backfill-options.test.ts` `src/lib/data-governance/__tests__/course-evidence-backfill.test.ts` `src/lib/data-governance/__tests__/data-completeness-audit.test.ts` `src/lib/data-governance/__tests__/data-governance-worker-materialization.test.ts` `src/lib/data-governance/__tests__/derived-learning-materialization.test.ts` `src/lib/data-governance/__tests__/event-buffer.test.ts` `src/lib/data-governance/__tests__/event-protocol.test.ts` `src/lib/data-governance/__tests__/evidence-browser-entrypoints.test.ts` `src/lib/data-governance/__tests__/evidence-source-catalog.test.ts` `src/lib/data-governance/__tests__/evidence-timeline.test.ts` `src/lib/data-governance/__tests__/fixtures/teacher-ai-grading-lab-synthetic.ts` `src/lib/data-governance/__tests__/historical-evidence-materialization.test.ts` `src/lib/data-governance/__tests__/intelligent-teaching-assistant-demo-package.test.ts` `src/lib/data-governance/__tests__/interactive-event-ingestion.test.ts` `src/lib/data-governance/__tests__/interactive-evidence-scoring-recompute.test.ts` `src/lib/data-governance/__tests__/learning-fact-materialization.test.ts` `src/lib/data-governance/__tests__/legacy-assignment-attachment-migration.test.ts` `src/lib/data-governance/__tests__/math-document-grading-batch.test.ts` `src/lib/data-governance/__tests__/math-document-grading-default-policy-migration.test.ts` `src/lib/data-governance/__tests__/math-document-grading-deploy.test.ts` `src/lib/data-governance/__tests__/math-document-grading-hardening.test.ts` `src/lib/data-governance/__tests__/math-document-grading-legacy-routes.test.ts` `src/lib/data-governance/__tests__/math-document-grading-lifecycle.test.ts` `src/lib/data-governance/__tests__/math-document-grading-persistence.test.ts` `src/lib/data-governance/__tests__/math-document-grading-pipeline.test.ts` `src/lib/data-governance/__tests__/math-document-grading-provider-runtime.test.ts` `src/lib/data-governance/__tests__/math-document-grading-queue.test.ts` `src/lib/data-governance/__tests__/math-document-grading-security.test.ts` `src/lib/data-governance/__tests__/math-document-grading-worker.test.ts` `src/lib/data-governance/__tests__/math-document-word-representation.test.ts` `src/lib/data-governance/__tests__/redis-client.test.ts` `src/lib/data-governance/__tests__/runtime-lesson-catalog.test.ts` `src/lib/data-governance/__tests__/student-competency-snapshot-route.test.ts` `src/lib/data-governance/__tests__/student-evidence-route.test.ts` `src/lib/data-governance/__tests__/submission-evidence-quality.test.ts` `src/lib/data-governance/__tests__/teacher-assignment-resubmission-intake.test.ts` `src/lib/data-governance/__tests__/teacher-assignment-review-derivative-storage.test.ts` `src/lib/data-governance/__tests__/teacher-assignment-review-derivative.test.ts` `src/lib/data-governance/__tests__/teacher-assignment-review-outbox.test.ts` `src/lib/data-governance/__tests__/teacher-assignment-reviewed-asset-route.test.ts` `src/lib/data-governance/__tests__/teacher-assignment-teacher-reviewed-asset-route.test.ts` `src/lib/data-governance/__tests__/teacher-attainment-delivery.test.ts` `src/lib/data-governance/__tests__/teacher-evidence-route.test.ts` `src/lib/data-governance/__tests__/teacher-student-cumulative-insights.test.ts` `src/lib/data-governance/__tests__/trusted-learning-fact-filter.test.ts` `src/lib/data-governance/__tests__/unit-4-1-submission-telemetry.test.ts` `src/lib/data-governance/__tests__/unit-4-4-backfill.test.ts` `src/lib/data-governance/__tests__/unit-4-4-submission-telemetry.test.ts` `src/lib/data-governance/__tests__/yangfan-diagnostic-fixture.test.ts` `src/lib/data-governance/assets/NotoSansSC-LICENSE.md` `src/lib/data-governance/assets/NotoSansSC-Regular.ttf` `src/lib/data-governance/index.ts` `src/lib/data-governance/intelligent-teaching-assistant-demo-package.ts` `src/lib/data-governance/yangfan-diagnostic-fixture.ts`

## compatibility-assets-tests:personalization

- accountableOwner: `personalization`
- publicBoundary: index.ts, assets/**, __tests__/**
- notTouched: barrel-deletion, fixture-deletion, asset-deletion
- deletionCondition: zero-consumers-and-regeneration-retention-evidence
- rollback: reversible-compatibility-surface
- paths: `src/lib/data-governance/__tests__/backfill-unit-4-1-growth-governance.test.ts` `src/lib/data-governance/__tests__/competency-engine.test.ts` `src/lib/data-governance/__tests__/competency-evidence-summary.test.ts` `src/lib/data-governance/__tests__/cumulative-attainment-backfill.test.ts` `src/lib/data-governance/__tests__/cumulative-class-materialization.test.ts` `src/lib/data-governance/__tests__/cumulative-learner-state.test.ts` `src/lib/data-governance/__tests__/cumulative-portrait-read-model.test.ts` `src/lib/data-governance/__tests__/cumulative-risk-growth-materialization.test.ts` `src/lib/data-governance/__tests__/cumulative-snapshot-jobs.test.ts` `src/lib/data-governance/__tests__/cumulative-snapshot-producers.test.ts` `src/lib/data-governance/__tests__/growth-evaluation-provider-runtime.test.ts` `src/lib/data-governance/__tests__/growth-evaluation.test.ts` `src/lib/data-governance/__tests__/portrait-reconciliation-status.test.ts` `src/lib/data-governance/__tests__/portrait-refresh-routes.test.ts` `src/lib/data-governance/__tests__/portrait-task-attainment-ui-contract.test.ts` `src/lib/data-governance/__tests__/portrait-v2-consumer.test.ts` `src/lib/data-governance/__tests__/portrait-v2-incremental-update.test.ts` `src/lib/data-governance/__tests__/portrait-v2-migration.test.ts` `src/lib/data-governance/__tests__/portrait-v2-model.test.ts` `src/lib/data-governance/__tests__/portrait-v2-primary-gate.test.ts` `src/lib/data-governance/__tests__/profile-page-evidence-status.test.ts` `src/lib/data-governance/__tests__/profile-portfolio-evidence.test.ts` `src/lib/data-governance/__tests__/profile-route.test.ts` `src/lib/data-governance/__tests__/risk-detector.test.ts` `src/lib/data-governance/__tests__/student-evidence-feature-cache.test.ts`

## compatibility-assets-tests:practice-lab

- accountableOwner: `practice-lab`
- publicBoundary: index.ts, assets/**, __tests__/**
- notTouched: barrel-deletion, fixture-deletion, asset-deletion
- deletionCondition: zero-consumers-and-regeneration-retention-evidence
- rollback: reversible-compatibility-surface
- paths: `src/lib/data-governance/__tests__/control-correction-demo-package.test.ts` `src/lib/data-governance/__tests__/control-workbench-run-context.test.ts` `src/lib/data-governance/__tests__/simulation-agent-evidence-materialization.test.ts` `src/lib/data-governance/__tests__/simulation-arena-preview-evidence.test.ts` `src/lib/data-governance/__tests__/simulation-runs-route.test.ts` `src/lib/data-governance/__tests__/simulation-scene-run-persistence.test.ts` `src/lib/data-governance/__tests__/simulation-task-evidence.test.ts` `src/lib/data-governance/__tests__/simulation-task-historical-application.test.ts` `src/lib/data-governance/__tests__/simulation-task-portrait-projection.test.ts` `src/lib/data-governance/__tests__/simulation-task-reconciliation.test.ts` `src/lib/data-governance/control-correction-demo-package.ts`
