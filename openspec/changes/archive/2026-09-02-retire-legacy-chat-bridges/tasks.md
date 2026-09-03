## 1. Characterize legacy bridges

- [x] 1.1 Inventory static and runtime callers of `useLegacyChat`, message compatibility, stream compatibility, copilot/sidebar components and chat routes.
- [x] 1.2 Add failing tests for persisted session resume, resource switching, empty/recovery failure, stream terminal/error, retry/cancel and duplicate-send behavior.
- [x] 1.3 Verify no bridge owns a conversation store, provider selection, business fact or privileged context.

## 2. Migrate retained surfaces

- [x] 2.1 Route copilot/global AI/Konling sidebars through the existing session/message contract with C28 normalized events.
- [x] 2.2 Route interactive course AI through its server-validated resource session while preserving bounded history and one-turn compatibility semantics where explicitly supported.
- [x] 2.3 Preserve AppShell, role authorization, SSR/R3F boundaries, focus/loading/error labels and privacy redaction across desktop/mobile surfaces.
- [x] 2.4 Add mounted and route tests proving refresh/resume, resource isolation, provider failure, abort and retry behavior.

## 3. Retire duplicate paths

- [x] 3.1 Delete compatibility hooks, parsers, facades and aliases with no remaining callers; retain only a documented ingress adapter where evidence requires it.
- [x] 3.2 Add a no-second-store/no-provider-bypass static contract and verify Web/worker/tool/test graphs compile without retired imports.
- [x] 3.3 Prove AI responses remain advisory and cannot write course, assessment, learning-record, publication or production facts.

## 4. Verify and hand off

- [x] 4.1 Run focused AI/session/interactive/component/accessibility suites, typecheck, lint, `verify:commit`, `verify:push`, and diff checks.
- [x] 4.2 Run `openspec validate retire-legacy-chat-bridges --type change --strict` and record before/after bridge inventory for C30.
