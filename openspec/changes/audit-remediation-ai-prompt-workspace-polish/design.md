## Context

AI task boundaries now sanitize output and create some candidate artifacts. Remaining issues are workspace-level: local task inputs can be displaced by Global AI, status controls are inconsistent, and Prompt/Copilot/portfolio tasks do not always preserve their task intent.

## Design

1. Local task dominance.
   - Prompt evaluation, AI workshop, Copilot reflection, and portfolio reflection surfaces identify their primary task input and output target.
   - Global AI remains available but cannot visually or semantically replace the local task input.
   - Keyboard order reaches the local task input and action controls before unrelated Global AI controls; active local AI task panels may mark background/global AI surfaces inert, deprioritized, or outside the task tab sequence.
   - Mobile layouts reserve safe area so the Global AI dock cannot cover local inputs or primary task actions.

2. Status controls.
   - Stop, retry, clear, loading, degraded, completed, saved-draft, and discarded states are local to the task surface.
   - Empty quick-question sections and nonfunctional clear actions are hidden or repaired.

3. Context preservation.
   - Prompt history, AI workshop practice candidates, Copilot reflection drafts, and portfolio creation flows keep assignment/source/intent context.
   - Generated candidates remain candidates until the user saves or submits them.

4. Safety boundary.
   - No raw prompt/tool/server context is exposed.
   - This change consumes existing sanitization rather than redesigning the provider runtime.
   - Candidate drafts exclude raw prompt/tool/server context and do not become evidence, profile facts, portfolio artifacts, or teacher-visible records until explicit save, submit, or publish succeeds.

## Out Of Scope

- Adaptive path generation, Graph Center actions, Konling graph context, KAQ writeback, provider/model admin governance, and resource metadata.
