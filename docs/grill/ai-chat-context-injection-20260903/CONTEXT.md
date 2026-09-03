# AI Chat Context Boundary

## Domain

This glossary records the learning-companion meaning of context passed to the
AI chat entry point.

## Terms

### Client context hint

A value supplied by the browser to help select or describe an entry point. It
is navigation input, not evidence of course ownership, learner state, page
identity, teaching authority, or an instruction to the model.

### Server-owned runtime context

The context resolved from authenticated identity and registered course,
lesson, resource, session, and permission records. Only this context can
authorize scoped tools or describe the current learning task in the private
model prompt.

### Generic chat fallback

The compatible assistant behavior used when no server-owned learning task can
be resolved. It may answer a general learning question, but it must not claim
that an unverified client description is the student's current course or page.

### Prompt instruction boundary

The boundary separating system-level behavior rules from learner-provided
metadata. Client-controlled free text must never cross this boundary as
executable instruction or as authoritative task context.

### Context unavailable

A truthful state meaning that the requested page or learning task could not be
verified for the signed-in learner. It is distinct from a valid page with
empty content and must not be silently represented as a verified context.

