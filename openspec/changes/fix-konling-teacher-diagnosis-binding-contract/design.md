## Context

`KonlingTeachingAssistantModeId` is the source type for every assistant mode. Conversation persistence deliberately keeps only a small mode identity plus allowlisted client context hints. The production fix and its complete persistence regression test are already present in `integration`; this change records the resulting contract so later changes preserve the same authorization boundary.

## Goals / Non-Goals

**Goals:**

- Preserve the established explicit empty client-hint allowlist for teacher diagnosis.
- Preserve the established server-side authorization boundary for teacher, class, and student scope.

**Non-Goals:**

- Change the teacher diagnosis UI, mode tools, data model, or server-side authorization.
- Persist a class, teacher, or student scope in the conversation binding.

## Decisions

- `integration` uses `teacher-diagnosis: []` in the existing exhaustive record. This maintains the existing per-mode binding design and makes any future mode registration fail type checking until its persistence policy is chosen.
- Treat all browser context as untrusted for this mode. The existing diagnosis tools reauthorize teacher, active class, and target student on every request, so duplicating those values in stored conversation metadata would create a misleading scope source.

## Risks / Trade-offs

- [A future caller expects persisted browser scope] → The mode remains identifiable, but callers must obtain scope through the existing server authorization path.
- [A later mode omits its allowlist] → The exhaustive TypeScript record blocks the regression during type checking.
