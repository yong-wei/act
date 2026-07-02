## Tasks

- [x] 1. Define SAR suggested binding review states and audit payloads.
  - Include candidate provenance, trace summary, missing coverage type, reviewer, decision, and rationale.

- [x] 2. Implement review actions for authorized teachers or administrators.
  - Support accept, reject, defer, and invalidate without exposing restricted evidence.

- [x] 3. Connect accepted suggestions to ResourceNode governance updates.
  - Keep all updates behind existing authorization, validation, and audit rules.

- [x] 4. Validate the change.
  - Run `rtk openspec validate govern-sar-suggested-bindings-workflow --strict`.
  - Run targeted Graph Center, ResourceNode governance, and SAR suggestion tests.
