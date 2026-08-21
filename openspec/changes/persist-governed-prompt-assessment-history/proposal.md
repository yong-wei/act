## Why

The prompt-quality and process-consistency features are intended to help students improve how they express and validate automatic-control learning strategies. Their history is currently held in process memory, accepts caller-supplied user identities, and can be read through an arbitrary path user ID, so it is neither durable nor safely attributable to one learner.

## What Changes

- Require an authenticated session whose role is `STUDENT` before prompt assessment, consistency tracking, or prompt-history reads touch learning data.
- Persist prompt-quality evaluations as versioned, learner-owned `PromptAssessment` records instead of a process-local map.
- Attach process-consistency results and bounded task-context metadata to the owned assessment record.
- Enforce a unique learner/session/version identity and safe retry behavior for concurrent creates.
- Return a user-scoped history projection and preserve the existing client-only demonstration mode.
- Scope page-level history metrics, consistency targets, and local demonstration versions to the active evaluation session.
- Keep this evidence outside `LearningFact`, learner portraits, official scores, rankings, and recommendations.

## Capabilities

### New Capabilities
- `governed-prompt-assessment-history`: authenticated, durable, user-isolated prompt assessment and consistency history for learning-process reflection.

### Modified Capabilities
- `server-action-and-route-safety`: user-scoped evaluation routes must authenticate and reject caller-selected identities before any protected read or write.
- `learning-evidence-source-catalog`: `PromptAssessment` and its consistency result remain traceable learning-process evidence but are not profile-grade evidence by default.

## Impact

- `src/app/api/evaluation/assess-prompt/route.ts`, `track-consistency/route.ts`, and `prompt-history/[userId]/route.ts`
- `src/features/evaluation/prompt-quality.ts` and the prompt-assessment page contract
- `prisma/schema.prisma` plus an additive PostgreSQL migration
- Route, persistence, concurrency, UI source, and browser acceptance tests
