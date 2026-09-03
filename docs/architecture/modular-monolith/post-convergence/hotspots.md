# Top hotspot observation vector

File size, centrality, change frequency, and trust density are prioritization evidence only.
They are not defects and do not create or update a fitness budget.

## Capture identity

- successorCaptureId: `fa6e618d7a875412e975a14259dfac37c4cfed1bc6ca48095184f72bb0946d02`
- sourceCommit: `698cb2f4cd6d001bcbeee95bca9be58c56c1cca3`
- sourceTree: `41d6b3f5966493911d6ce9c1f299015189778d53`
- commitTime: `2026-09-03T13:07:15+08:00`
- schemaVersion: `act-architecture-post-convergence-successor/v1`
- schemaVersions.censusCore: `act-architecture-census/v1`
- schemaVersions.measurementReceipt: `act-architecture-measurement-receipt/v1`
- schemaVersions.currentHeadDelta: `act-architecture-current-head-delta/v1`
- nodeVersion: `v26.0.0`
- npmVersion: `11.12.1`
- typescriptVersion: `5.8.3`
- predecessorBaseline.sourceCommit: `58c77cbf6e0f6cd284e1eea6a39ca4df8854ebac`
- predecessorBaseline.censusCoreSha256: `40549dcad9b03da31abc6ef05c5ede5bff4e04b47268f86450831aa39788c52a`
- predecessorCurrentHead.sourceCommit: `09fa54739c74a5005b7f3131bf3c85dcf79ff01a`
- predecessorCurrentHead.packageSha256: `120ece26720573a906e5196ad5f8ed80594376f2412fb87d5e42727745a211dd`
- frozenReceiptIds: `428e888776e52c415a1f6daa029110c029b20e2d790f030d155fbfde3b059c39`, `5fa6bc476c928f27605dc055844244b5ab0d0d3909b5dd467690cadbba1360e9`

- metric scope: sourceBytes: Git object byte size for the path (gitlink entries carry no blob bytes and count 0) | functionCount: count of /\bfunction\b/ in source content | branchCount: count of /\b(?:if|for|while|switch|case|catch)\b/ in source content | importBreadth: distinct src/<top-dir> prefixes of census dependency-edge targets | fanIn: census dependency-edge inbound count (production context) | fanOut: census dependency-edge outbound count (production context) | changeFrequency: commits touching the path within the last 500 commits of HEAD | testDensity: count of census test observations whose basename (without extension and trailing .test/.spec suffix) equals the file basename-without-extension | trustDensity: count of census observations with trustClass != null whose evidence contains the path
- rank tuple: sourceBytes desc | fanIn desc | changeFrequency desc | functionCount desc | branchCount desc | importBreadth desc | testDensity desc | trustDensity desc | fanOut desc | identity asc (stable tie-break)

| rank | identity | bytes | fanIn | fanOut | changeFreq | functions | branches | breadth | tests | trust | changeCenter |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | src/lib/konling-agent-runtime.ts | 415890 | 17 | 40 | 17 | 334 | 589 | 4 | 1 | 0 | true |
| 2 | src/lib/resource-node-path-readiness-review-batch.ts | 409128 | 4 | 1 | 0 | 4 | 58 | 1 | 0 | 0 | true |
| 3 | src/app/assessment/adaptive-practice/page.tsx | 331370 | 0 | 20 | 5 | 87 | 338 | 3 | 1 | 0 | true |
| 4 | src/features/personalization/path-planning/internal/assemble-plan.ts | 247704 | 4 | 22 | 3 | 176 | 310 | 2 | 1 | 0 | true |
| 5 | src/features/interactive/shared/manifest-runtime/content-renderers.tsx | 209572 | 29 | 10 | 5 | 180 | 310 | 1 | 0 | 0 | true |
| 6 | src/lib/commercial-ui-governance.ts | 200841 | 0 | 1 | 1 | 58 | 306 | 1 | 1 | 0 | true |
| 7 | src/lib/data-governance/math-document-grading-lifecycle.ts | 157019 | 14 | 4 | 0 | 82 | 391 | 1 | 1 | 0 | true |
| 8 | src/lib/data-governance/math-document-grading-persistence.ts | 146299 | 18 | 9 | 1 | 69 | 266 | 1 | 1 | 0 | true |
| 9 | src/lib/resource-node-registry.ts | 146291 | 33 | 3 | 0 | 127 | 241 | 1 | 1 | 0 | true |
| 10 | src/features/knowledge/graph/knowledge-graph-canvas.tsx | 136837 | 4 | 20 | 5 | 13 | 163 | 2 | 0 | 0 | true |
| 11 | src/lib/resource-registry-metadata.ts | 116538 | 25 | 1 | 0 | 11 | 4 | 1 | 1 | 0 | true |
| 12 | src/features/interactive/unit-2-1-modeling-language/step-panels.tsx | 106214 | 2 | 7 | 2 | 25 | 121 | 3 | 0 | 0 | true |
| 13 | src/lib/data-governance/teacher-ai-grading-lab-core.ts | 105129 | 3 | 22 | 1 | 60 | 154 | 1 | 1 | 0 | true |
| 14 | src/features/personalization/learner-state/internal.ts | 104343 | 10 | 14 | 7 | 105 | 188 | 2 | 0 | 0 | true |
| 15 | src/features/assignment-authoring/assignment-editor-workspace.tsx | 103947 | 2 | 7 | 1 | 24 | 128 | 3 | 0 | 0 | true |
| 16 | src/lib/platform-role-navigation.ts | 103838 | 22 | 2 | 3 | 16 | 34 | 2 | 1 | 0 | true |
| 17 | src/lib/assignments/submission-service.ts | 102354 | 3 | 7 | 4 | 48 | 192 | 1 | 0 | 0 | false |
| 18 | src/features/knowledge/knowledge-graph-system.tsx | 102002 | 19 | 28 | 4 | 5 | 81 | 3 | 0 | 0 | false |
| 19 | src/lib/smart-lesson-plan/service.ts | 101940 | 2 | 10 | 1 | 72 | 200 | 2 | 3 | 0 | false |
| 20 | src/features/interactive/shared/manifest-runtime/module-registry-gate.ts | 99422 | 0 | 4 | 1 | 77 | 310 | 2 | 0 | 1 | false |
| 21 | src/lib/aggregate-governance/current-course-coverage-batch-review.ts | 99104 | 1 | 3 | 0 | 46 | 228 | 1 | 1 | 1 | false |
| 22 | src/features/knowledge/active-authority-graph.tsx | 95285 | 1 | 19 | 19 | 42 | 143 | 3 | 0 | 0 | false |
| 23 | src/resources/control-system/charts/control-analysis-panels.tsx | 94996 | 13 | 5 | 0 | 75 | 115 | 2 | 0 | 0 | false |
| 24 | src/resources/simulations/destroyer-simulation.tsx | 94796 | 0 | 4 | 0 | 22 | 111 | 1 | 0 | 0 | false |
| 25 | src/lib/data-governance/student-evidence-feature-cache.ts | 90636 | 14 | 6 | 1 | 90 | 105 | 2 | 1 | 0 | false |
| 26 | src/features/knowledge/graph/knowledge-graph-2d.tsx | 90186 | 2 | 18 | 9 | 13 | 129 | 1 | 0 | 0 | false |
| 27 | src/lib/data-governance/graph-center.ts | 89770 | 7 | 14 | 2 | 78 | 118 | 2 | 1 | 0 | false |
| 28 | src/resources/simulations/simulations/cruise-simulation.tsx | 88130 | 2 | 31 | 1 | 27 | 72 | 2 | 0 | 0 | false |
| 29 | src/features/interactive/unit-2-2-time-response/step-panels.tsx | 83470 | 2 | 8 | 2 | 24 | 54 | 3 | 0 | 0 | false |
| 30 | src/resources/interactive-learning/lesson-07/pole-manipulator/index.tsx | 81766 | 1 | 4 | 1 | 34 | 94 | 2 | 0 | 0 | false |
| 31 | src/lib/data-governance/intelligent-teaching-assistant-demo-package.ts | 80455 | 1 | 1 | 1 | 15 | 40 | 1 | 1 | 0 | false |
| 32 | src/features/teacher/smart-courseware-editor.tsx | 78459 | 1 | 11 | 1 | 49 | 97 | 2 | 1 | 0 | false |
| 33 | src/resources/simulations/physics/engine-factory.ts | 77964 | 3 | 21 | 1 | 2 | 82 | 1 | 0 | 0 | false |
| 34 | src/resources/interactive-learning/control-odyssey/index.tsx | 77666 | 2 | 16 | 1 | 0 | 80 | 5 | 0 | 0 | false |
| 35 | src/features/admin/data-governance-dashboard.tsx | 76971 | 1 | 7 | 0 | 18 | 51 | 3 | 0 | 0 | false |
| 36 | src/features/personalization/path-planning/control-correction-path-rounds.ts | 76938 | 11 | 6 | 1 | 79 | 126 | 2 | 1 | 0 | false |
| 37 | src/features/teacher/document-rubric-grading-workbench.ts | 76918 | 7 | 7 | 1 | 68 | 121 | 1 | 1 | 0 | false |
| 38 | src/lib/resource-field-completion-audit.ts | 76352 | 5 | 3 | 0 | 65 | 104 | 1 | 1 | 0 | false |
| 39 | src/features/assignments/student-assignment-workspace.tsx | 75547 | 1 | 8 | 2 | 44 | 95 | 3 | 0 | 0 | false |
| 40 | src/features/interactive/unit-5-2-nonlinear-analysis-entry/step-panels.tsx | 74497 | 2 | 8 | 2 | 39 | 55 | 3 | 0 | 0 | false |
| 41 | src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/step-panels.tsx | 72764 | 2 | 8 | 1 | 33 | 53 | 3 | 0 | 0 | false |
| 42 | src/lib/data-governance/teacher-prep-pack-generation.ts | 71463 | 4 | 6 | 2 | 74 | 122 | 2 | 1 | 0 | false |
| 43 | src/features/admin/system-config-dashboard.tsx | 69247 | 1 | 5 | 0 | 7 | 42 | 3 | 0 | 0 | false |
| 44 | src/features/assessment/learning-goal-checkpoint-question-sets.ts | 67713 | 10 | 3 | 1 | 31 | 18 | 1 | 0 | 0 | false |
| 45 | src/features/interactive/unit-3-5-zero-dynamic-improvement/step-panels.tsx | 66930 | 2 | 5 | 1 | 20 | 68 | 2 | 0 | 0 | false |
| 46 | src/features/interactive/unit-3-2-routh-stability-boundary/step-panels.tsx | 66620 | 2 | 4 | 1 | 22 | 57 | 2 | 0 | 0 | false |
| 47 | src/features/personalization/recommendations/engine.ts | 65898 | 3 | 11 | 1 | 50 | 78 | 2 | 1 | 0 | false |
| 48 | src/lib/architecture-census/post-convergence.ts | 65241 | 2 | 7 | 6 | 42 | 159 | 1 | 0 | 0 | false |
| 49 | src/features/interactive/shared/manifest-runtime/activity-renderers.tsx | 64976 | 29 | 5 | 1 | 55 | 83 | 2 | 0 | 0 | false |
| 50 | src/lib/data-governance/math-document-grading-batch.ts | 64833 | 14 | 7 | 1 | 27 | 135 | 1 | 1 | 0 | false |

## Unresolved metric inputs

_None._
