## Context

Unit 1-4 currently derives `systemPromptExtension` and tool lists in the browser from `savedResponse` and `answerVisible`. The shared chat route does not parse those fields, while the server-owned page-context builder resolves only static course-step context. The interactive session API already persists student response state, so the missing behavior is a server-side projection and consumption boundary rather than a new source of truth.

## Goals / Non-Goals

**Goals:**

- Resolve the latest response, submission and answer-disclosure state from authenticated server-owned records.
- Give pre-submission assistance without revealing or completing the answer.
- Allow bounded answer checking only after complete submission or teacher disclosure.
- Apply the same state contract to embedded and global Konling entry points.

**Non-Goals:**

- Exposing teacher-private answer packages or other students' responses.
- Letting AI submit, grade, rewrite or promote an answer.
- Treating browser form state as a trusted authorization source.
- Changing the existing user-level cross-page conversation policy.

## Decisions

### 1. Resolve an interactive tutoring state on the server

The runtime will resolve a bounded state from the authenticated learner, classroom session, resource and step. The state distinguishes unanswered, partial, fully submitted and teacher-disclosed conditions, and includes only the learner's persisted response summary needed for coaching.

### 2. Derive tools and prompt behavior from the resolved state

The runtime, not the browser, decides whether answer checking is permitted and which tutoring instruction applies. Before complete submission it provides concepts, observation order and hints only. After complete submission or teacher disclosure it may compare the learner's persisted response without changing official records.

### 3. Treat client tutoring fields as presentation hints only

Client `tools`, `systemPromptExtension`, `contextData`, completion flags and answer-visibility flags cannot widen server permissions or establish disclosure. Unsupported or conflicting values are ignored or rejected before model invocation.

## Risks / Trade-offs

- [Risk] Session and step identifiers may be incomplete on legacy callers. -> Keep an explicit compatibility state that does not claim response awareness or enable answer checking.
- [Risk] A stale session read may lag the page. -> Resolve on every request from the latest persisted state and test changes between turns.
- [Risk] Response summaries could reveal answer keys. -> Project only the current learner's submitted fields and never load teacher-private answer payloads before authorized disclosure.

## Migration Plan

Introduce the resolver and tests, route both interactive entry points through it, then remove client-authored tutoring authority. No data migration is required because the response state is already persisted.

## Open Questions

None. The governing boundary is server-owned response state; legacy callers degrade without answer-aware claims.

