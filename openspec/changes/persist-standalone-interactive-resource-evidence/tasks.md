## 1. Runtime provenance boundary

- [ ] 1.1 Add a typed explicit launch-context contract for classroom and standalone interactive resource launches.
- [ ] 1.2 Pass the existing direct-resource launch descriptor from `ResourceRenderer` into `InteractiveProvider` without using `embedded` as provenance.
- [ ] 1.3 Pass the classroom `sessionId` into the shared renderer's knowledge-card tracker and preserve classroom-session, demo, anonymous, and generated-courseware behavior at the boundary.

## 2. Durable standalone event flow

- [ ] 2.1 Enable authenticated standalone tracking through the existing `/api/interactive/events` path.
- [ ] 2.2 Include canonical standalone context and resource identity in view, interaction, and completion event payloads.
- [ ] 2.3 Confirm server normalization, ownership, deduplication, and evidence-policy behavior remain authoritative.

## 3. Verification and delivery

- [ ] 3.1 Add failing unit/source-contract tests for direct launch context and classroom compatibility.
- [ ] 3.2 Add tracking/route regression coverage for authenticated standalone persistence, canonical classification, anonymous/demo non-persistence, duplicate event handling, and classroom knowledge-card provenance.
- [ ] 3.3 Run focused interactive tests, related learning-record tests, typecheck, strict OpenSpec validation, and `git diff --check`.
- [ ] 3.4 Record the direct-resource route and persisted evidence path as Issue acceptance evidence; do not claim mastery or score effects.
