## Tasks

- [x] 1. Extract or designate the shared Konling chat renderer.
  - Consolidate assistant/user message layout, loading/error states, retry/stop/clear affordances, and normalized citation rendering.
  - Keep route-specific context, tools, and prompt extensions outside the renderer.

- [x] 2. Implement shared tool-call disclosure.
  - Add collapsed assistant-message-level tool summary and per-tool expandable rows.
  - Use standard expand/collapse icons rather than literal arrow text.
  - Show only sanitized tool result details.

- [x] 3. Update Konling message and input layout.
  - Remove assistant avatar placeholder spacing from replies.
  - Allow assistant replies to span the full reply area.
  - Make the input prompt box occupy 70 percent to 80 percent of the Konling window width by default.

- [x] 4. Prefix development diagnostics.
  - Mark injected streaming evidence diagnostics as development-mode diagnostics.
  - Preserve production gating so raw diagnostic reason codes do not appear in production-visible assistant text.

- [x] 5. Migrate duplicate visible Konling implementations.
  - Replace or wrap legacy sidebar, copilot, and interactive lesson AI panel message/tool/citation rendering with the shared renderer.
  - Preserve page-specific tool sets and system prompt extensions through context registration.

- [x] 6. Add UI and integration tests.
  - Cover tool disclosure expand/collapse behavior, layout changes, development diagnostic label, and context-specific tool registration.
  - Run browser or Playwright checks for knowledge graph and interactive lesson Konling entry points.

- [x] 7. Validate the change.
  - Run `rtk openspec validate unify-konling-chat-experience --strict`.
  - Run targeted AI UI tests and any affected browser checks.
