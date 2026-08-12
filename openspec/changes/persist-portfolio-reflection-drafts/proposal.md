## Why

The portfolio reflection page currently marks a candidate only in browser state, so a refresh, navigation, or new login loses the student's explicitly saved reflection. This breaks the learning-process companion workflow because an AI-assisted reflection cannot become a recoverable personal draft.

## What Changes

- Add a learner-owned portfolio reflection draft persistence model with provenance, lifecycle, and duplicate-submit protection.
- Add authenticated APIs to save, read, update, and discard only the current student's drafts.
- Replace the portfolio page's local-only draft marker with loading, saving, reopening, editing, and discarding of persisted drafts.
- Keep the saved payload limited to the displayed structured candidate; do not store the complete Copilot conversation.
- Preserve the existing candidate-only boundary: saving a draft does not create `LearningFact`, update a learner portrait, alter official scores, or publish a formal portfolio record.

## Capabilities

### New Capabilities
- `portfolio-reflection-draft-persistence`: learner-scoped persistence and lifecycle management for explicitly saved portfolio reflection candidates.

### Modified Capabilities
- `audit-remediation-ai-task-boundaries`: an explicitly saved portfolio reflection candidate must remain a durable draft while retaining its candidate-only writeback boundary.

## Impact

- `prisma/schema.prisma` and a PostgreSQL migration.
- New portfolio reflection draft API routes and their route-level tests.
- `src/app/(main)/profile/portfolio/page.tsx` and its source/browser contract coverage.
- No AI provider, official evaluation, leaderboard, `LearningFact`, or learner-portrait writer changes.
