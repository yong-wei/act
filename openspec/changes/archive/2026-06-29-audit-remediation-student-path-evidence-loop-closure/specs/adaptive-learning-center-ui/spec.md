## ADDED Requirements

### Requirement: Student path intents shall render truthful recovery states
Adaptive path selection, execution, evidence review, and bad path contexts SHALL render truthful student-facing states instead of normal progress when the backing path or evidence is unavailable.

#### Scenario: `path-selection`, `path-execution`, or `evidence-review` is opened without a valid active path or evidence context
- **WHEN** `path-selection`, `path-execution`, or `evidence-review` is opened without a valid active path or evidence context
- **THEN** the page SHALL explain the missing context, preserve the intended action, and offer generation, evidence review, or return actions.

#### Scenario: a path node launches a resource
- **WHEN** a path node launches a resource
- **THEN** returning to the center SHALL restore path id, node id, goal id, completion state, and evidence summary when available.

### Requirement: Student learning work shall write back or explain limits
Student missions, adaptive practice, evidence review, growth recommendations, and portfolio actions SHALL either write governed completion evidence or show why writeback is unavailable.

#### Scenario: a student completes a task, practice, review, or portfolio action
- **WHEN** a student completes a task, practice, review, or portfolio action
- **THEN** the surface SHALL show completion state, evidence source, review state, and effect on later recommendations.

#### Scenario: evidence cannot be written or matched because of lessonId, sourceEventId, or slug mismatch
- **WHEN** evidence cannot be written or matched because of lessonId, sourceEventId, or slug mismatch
- **THEN** the UI SHALL expose a recovery state and the implementation SHALL avoid presenting fabricated completion.
