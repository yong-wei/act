## Design

### Current Surfaces

The repository currently has several visible Konling or Konling-like chat surfaces:

- `GlobalAISidebar` uses `GlobalAIProvider` page context and AI SDK streaming.
- `KonlingSidebar` uses a separate session API and renders its own message bubbles.
- `CopilotPanel` and `/ai/copilot` render local tool results and citations independently.
- `InteractiveAIPanel` embeds a local chat panel inside interactive lesson dialogs.

The page context contract is already more unified than the visible UI. Routes can register tool names, system prompt extensions, assistant entry points, selected knowledge nodes, resource hints, and path context. The main problem is duplicated rendering and divergent UX.

### Target Architecture

Use one shared Konling chat renderer for visible messages:

```text
Route context registration
  -> GlobalAIProvider context
  -> shared Konling chat renderer
  -> shared tool-call disclosure
  -> normalized citation presentation
```

Page-specific behavior remains at the context boundary:

- Knowledge graph registers selected node, graph tools, and graph prompt extension.
- Adaptive path surfaces register path advisor entry point, path tools, and goal context.
- Interactive lessons register resource or activity context and lesson-specific prompt extension.
- Teacher or admin surfaces register role-scoped tools and mode-specific prompts.

The shared renderer owns visible message layout, tool disclosure behavior, development diagnostic labels, and citation rendering.

### Tool Call Disclosure

Tool calls are rendered as one collapsed summary per assistant message:

- Collapsed summary text: called N tools.
- Hover state: brighter text and a visible affordance.
- Expanded summary: same text plus a standard collapse icon.
- Expanded list: one row per tool, each row collapsed by default.
- Tool row collapsed text: called `<toolName>`.
- Tool row expanded state: shows sanitized result detail.

Use standard frontend expand/collapse icons, not literal `>` or `v` characters. Tool result details must continue to respect redaction boundaries; raw internal diagnostics are not shown to students.

### Message Layout

- User input occupies about 75 percent of the Konling window width by default.
- DOM or screenshot validation may accept a 70 percent to 80 percent range so the layout remains responsive without turning the requirement into a subjective screenshot judgment.
- Assistant replies no longer reserve space for an assistant avatar placeholder.
- Assistant replies use the full available message width.
- Existing stop, retry, clear, loading, and error affordances remain reachable.

### Development Diagnostics

Development-mode evidence diagnostics may still be injected for local debugging, but the visible notice must explicitly identify itself as development mode. Production remains controlled by runtime configuration and must not expose raw diagnostic reason codes to ordinary users.

### Citation Consumption

This change consumes the normalized citation presentation from `normalize-konling-citation-presentation`. It should not re-implement citation deduplication or linkability in each chat surface.

### Migration Boundary

Old visible Konling implementations should either be removed, turned into wrappers around the shared renderer, or route through the global entry point. A remaining route-specific wrapper is acceptable only if it passes context, prompt, and tool configuration into the shared renderer and does not duplicate message bubble, tool-call, or citation rendering logic.

### Validation

Implementation should include:

- Unit or component tests for tool disclosure interaction.
- Tests proving old surfaces use shared message/tool/citation rendering.
- A development-mode diagnostic test verifying the "development mode" label.
- Browser or Playwright evidence for knowledge graph and interactive lesson contexts.
