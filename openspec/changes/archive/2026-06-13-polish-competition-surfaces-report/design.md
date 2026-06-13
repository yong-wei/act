## Context

This change should land after product capabilities are wired. Its job is to make the final competition experience coherent: one shell language, one story, one effect report, and one asset package. Current UI governance already covers AppShell and secondary navigation drift, so this change should reuse those gates instead of creating a parallel design checklist.

## Goals / Non-Goals

**Goals:**

- Make competition core surfaces visually and navigationally consistent.
- Produce source-backed effect-report exports with clear synthetic/real boundaries.
- Provide a complete asset manifest for video, screenshots, accounts, route order, model notes, privacy notes, and fallback steps.
- Add final acceptance checks that reviewers and agents can rerun.

**Non-Goals:**

- No new grading evaluator or path planner logic.
- No replacement of the platform-wide UI system.
- No production deployment or main-branch release.
- No unsupported claim that Anthropic-compatible runtime is fully implemented.

## Decisions

- Reuse commercial UI governance evidence format. Competition screenshots should become a focused subset of the broader visual governance system.
- Generate effect report from existing source-backed metrics and demo package records. Do not hand-author numbers in markdown.
- Treat `/data-center` as teacher/admin only and use `/profile/evidence` or other learner-record routes for student evidence.
- Keep final assets in repo-local competition documentation unless the external video repository is explicitly available and in scope.

## Risks / Trade-offs

- Visual polish can mask weak data -> every report metric must carry source references, exclusions, sample size, and data-origin marker.
- Screenshot maintenance can become brittle -> capture representative route states and metadata rather than pixel-perfect full-site diffs.
- Asset scripts can drift from implementation -> require route-ledger checks and browser evidence generated from the running app.
