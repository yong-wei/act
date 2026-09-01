## 1. Reproduce the public-response leak

- [ ] 1.1 Add a serialization regression containing user, assistant, page-context system and assistant-binding system messages with unique internal canary values.
- [ ] 1.2 Add authenticated conversation-route coverage that inspects the raw JSON response and proves system roles, content, metadata and internal identifiers are currently reachable before the fix.

## 2. Enforce the server-owned public projection

- [ ] 2.1 Update the shared conversation serializer to derive the bounded public assistant binding from complete server-owned history while returning only user and assistant messages.
- [ ] 2.2 Preserve approved assistant citations, revisions, corrections and public structured actions while continuing to exclude private tool parts and metadata.
- [ ] 2.3 Audit every public caller of the serializer and remove any route-specific path that can return the unfiltered persisted message array.

## 3. Verify compatibility and security boundaries

- [ ] 3.1 Prove conversation GET and applicable update responses contain no internal canary values while preserving visible message order and the allowed assistant binding.
- [ ] 3.2 Prove standalone Copilot and shared conversation-library recovery still restore the same student-visible history without relying on client-side filtering for confidentiality.
- [ ] 3.3 Run focused Konling library, route and client tests, full TypeScript checking, strict change and repository OpenSpec validation, and `git diff --check` on the final implementation revision.
- [ ] 3.4 Record an authenticated raw-response verification using browser Network inspection or an equivalent route-level capture; no Commercial UI screenshots are required unless implementation changes visible UI.
