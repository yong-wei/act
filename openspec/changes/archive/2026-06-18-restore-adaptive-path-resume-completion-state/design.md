## Context

The current page can load explicit `pathId` links and falls back through learner-state and latest path reads, but the default product state still behaves like a cold-start path center unless the URL carries the correct intent. Separately, path execution advancement depends on `LearningPathExecution` and path metadata, while at least one interactive precheck-style resource completes inside the resource component without a matching path `completed` write-back.

## Goals / Non-Goals

**Goals:**

- Make the current or recently completed path visible when a student enters the center without path-specific URL parameters.
- Show completed nodes, current node, pending result states, and completed-path summary from persisted path state.
- Add a shared completion bridge for path-launched simple interactive resources.
- Keep complex-node advancement dependent on typed outcome references.

**Non-Goals:**

- Redesigning the path-selection layout.
- Owning the resource return label or target; that is handled by the launch/return context change.
- Changing planner scoring or terminal validation policy.

## Decisions

- Use `LearningPath` persistence and append-only execution records as the truth for resume and completion. Learner-state path context is useful for hints, but stale learner-state must not hide an existing latest path.
- The default path-center order is active path, then completed path summary, then generation/cold-start.
- Simple interactive resource completion can write a completion event with privacy-safe evidence references where available. Complex resources must continue to supply typed outcome references before advancing dependent nodes.
- Pending state is visible: if a resource says local completion happened but the path execution result is not bound, the path center shows a waiting state rather than moving the current node prematurely.

## Risks / Trade-offs

- **Risk:** Automatically resuming a path could hide generation entry points.  
  **Mitigation:** keep generation and path switch actions visible as secondary controls.
- **Risk:** Completion bridge could double-count repeated interactions.  
  **Mitigation:** use scoped idempotency keys and distinguish completion from review or continued interaction.
- **Risk:** Latest path recovery may need goal inference when no goal is supplied.  
  **Mitigation:** start with registered goal priority and explicit latest active/completed path reads for supported goals, while preserving cold-start fallback.
