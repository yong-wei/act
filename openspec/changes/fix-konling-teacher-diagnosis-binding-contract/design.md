## Context

`KonlingTeachingAssistantModeId` is the source type for every assistant mode. Conversation persistence deliberately keeps only a small mode identity plus allowlisted client context hints. Adding `teacher-diagnosis` to the source union without adding it to the complete hint-key record breaks the compile-time contract.

## Goals / Non-Goals

**Goals:**

- Register the teacher diagnosis mode with an explicit empty client-hint allowlist.
- Preserve the mode identity while discarding all browser-provided scope values.
- Cover that behavior with a focused unit test.

**Non-Goals:**

- Change the teacher diagnosis UI, mode tools, data model, or server-side authorization.
- Persist a class, teacher, or student scope in the conversation binding.

## Decisions

- Use `teacher-diagnosis: []` in the existing exhaustive record. This maintains the existing per-mode binding design and makes any future mode registration fail type checking until its persistence policy is chosen.
- Treat all browser context as untrusted for this mode. The existing diagnosis tools reauthorize teacher, active class, and target student on every request, so duplicating those values in stored conversation metadata would create a misleading scope source.

## Risks / Trade-offs

- [A future caller expects persisted browser scope] → The mode remains identifiable, but callers must obtain scope through the existing server authorization path.
- [A later mode omits its allowlist] → The exhaustive TypeScript record blocks the regression during type checking.
