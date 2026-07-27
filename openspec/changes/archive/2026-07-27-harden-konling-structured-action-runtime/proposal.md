## Why

Konling can currently leak provider tool-call markup into the conversation, lose structured tool-run results, or require a separate suggestion panel that gives no feedback when clicked. Structured actions must behave as durable, understandable conversation content across providers.

## What Changes

- Normalize streamed and non-streamed provider tool calls so DSML or provider-specific markup is never rendered as assistant prose.
- Persist tool runs and structured action results with the assistant turn and restore them when the conversation is reopened.
- Render smart-preparation proposals as action cards inside the assistant message with apply and ignore controls.
- Apply an accepted proposal to the shared smart-preparation task, highlight the affected accordion stage, and report success or conflict in place.
- Remove the separate `查看控灵建议` interaction once message action cards cover the flow.
- Keep page-specific tool sets focused while preserving the project's existing page-context injection.
- Correct the `孔灵` label to `控灵`.
- Reuse the shared provisional-message revision and `正在后台优化响应` contract owned by `integrate-konling-textbook-rag` when one bounded tool-call correction must replace the same assistant response.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `konling-agent-runtime`: strengthens provider-independent tool-call normalization, tool-run persistence, structured action rendering, and response replacement.
- `smart-lesson-plan-authoring`: consumes Konling task proposals as in-message action cards that update the shared structured task.
- `model-provider-compatibility`: prevents provider-specific structured-call syntax from reaching user-visible answer text.

## Impact

- Affects the AI chat streaming endpoint, provider normalization, tool-run persistence, Konling message renderer, smart-preparation proposal tool, and optimistic task revision checks.
- Depends on `add-konling-conversation-library` for durable message ownership and consumes the shared message-revision primitive from `integrate-konling-textbook-rag`; it SHALL NOT implement a second p95 wait or replacement state machine.
- Does not add a second smart-preparation suggestion store or expand page tool sets globally.
