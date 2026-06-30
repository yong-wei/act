## Design

The teacher K/A/Q evidence trace surface should answer a concrete teacher question: "Why does this class or student appear weak on this K/A/Q node, and which resources or evidence support the next action?"

## Surface

The canonical route should be `/teacher/classes/[classId]/kaq-evidence-trace`. It may accept query parameters for graph node id, objective id, student id, or resource gap type, but all parameters must be validated against teacher authorization and class scope.

The page should show node identity, objective/portrait mapping, associated SAR trace summary, safe top events, learner/class evidence counts, resource coverage gaps, suggested resource candidates, limitations, and links back to Graph Center, student evidence, report context, or ResourceNode governance where available.

## Privacy

Teacher-scoped evidence is allowed only for authorized classes or students. Student-visible responses must not reuse teacher-only trace payloads. Cross-class, audit-only, hidden Arena internals, raw learner answers, and private Konling memory must be rejected or redacted.

## Verification Strategy

- Route/API tests for authorized class, unauthorized class, student filter, and missing node.
- Payload tests proving restricted evidence is absent.
- UI/DOM tests for node identity, trace summary, resource gap candidates, and degraded states.
- OpenSpec strict validation.
