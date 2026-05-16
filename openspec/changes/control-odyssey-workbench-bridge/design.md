## Context

Odyssey is not just another chart-based workbench; it includes level runtime, game UI, telemetry history, tuning controls, and original scoring. Arena already has Odyssey seed tasks and a partial bridge concept, but full integration should be isolated so generic workbench routing does not disrupt the game.

## Goals / Non-Goals

**Goals:**
- Render Arena challenge context and submission status for Odyssey tasks.
- Preserve the original Odyssey game score and progression system.
- Convert eligible Odyssey completion results into official Arena submissions through the existing official path.

**Non-Goals:**
- No rewrite of Odyssey physics or rendering.
- No embedding of every Odyssey screen into a generic four-panel chart layout.
- No direct leaderboard writes from Odyssey game score.

## Decisions

- Keep Odyssey as a dedicated runtime with Arena context chrome.
  Rationale: a bridge protects the game architecture while making Arena task context visible.

- Keep original score and Arena score separate.
  Rationale: Odyssey score is game progression; Arena score must come from official evaluation and hard constraints.

- Use explicit result mapping.
  Rationale: settlement time, peak deviation, terminal error, and control smoothness must be traceable from Odyssey telemetry, not guessed from UI state.

## Risks / Trade-offs

- [Risk] Students may see two scores and confuse them.
  → Mitigation: label Odyssey score and Arena official score separately in Chinese.

- [Risk] Game telemetry may be insufficient for official metrics.
  → Mitigation: add a bridge validation step that rejects incomplete runs before submission.
