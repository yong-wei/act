## Why

Konling is exposed through multiple visible chat implementations: the global sidebar, legacy sidebar/session UI, copilot panel, copilot page, and interactive lesson AI panel. These surfaces render assistant messages, tool calls, avatars, citations, and diagnostic text differently. The result is inconsistent behavior across graph, interactive lesson, adaptive path, and copilot contexts, and it makes citation presentation fixes hard to apply reliably.

The platform already has a central `GlobalAIProvider` that carries page context, scoped tools, system prompt extensions, assistant entry points, and knowledge workspace hints. The correct direction is not to maintain parallel Konling UIs, but to converge visible Konling chat rendering on one shared experience while allowing each route to register its own context, tool set, and prompt extension.

## What Changes

- Consolidate visible Konling chat rendering into one shared UI layer.
- Migrate page-local Konling entry points to open or embed the shared experience instead of maintaining duplicate message bubbles and tool result rendering.
- Render tool calls through a collapsed summary such as "called N tools", using standard expand/collapse icons instead of literal text arrows.
- Allow each tool row to expand sanitized tool result details.
- Remove assistant avatar placeholders from reply messages and allow assistant replies to use the full reply width.
- Make the user input box occupy about 75 percent of the Konling window width by default.
- Prefix development-mode evidence diagnostics with an explicit development-mode label.
- Consume the normalized citation presentation from `normalize-konling-citation-presentation`.

## Impact

- Extends `konling-agent-runtime`.
- Touches AI chat UI components, shared message rendering, tool invocation rendering, page context integration, and focused UI tests.
- Depends on `normalize-konling-citation-presentation`.
- Does not seed learner history or complete semantic resource fields.
- Does not remove page-specific prompts, tools, or context registration; those remain route-owned inputs to the shared UI.
