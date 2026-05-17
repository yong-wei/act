## 1. Odyssey Context Bridge

- [x] 1.1 Add an Arena context header or shell mount for Odyssey challenge mode.
- [x] 1.2 Preserve existing Odyssey runtime, store, tuning panel, and game score behavior.
- [x] 1.3 Load previous Arena submissions or status for the Odyssey task where applicable.

## 2. Result Mapping And Submission

- [x] 2.1 Define telemetry fields required for official Odyssey submission.
- [x] 2.2 Map completed run telemetry to Arena metrics or an Arena-compatible artifact.
- [x] 2.3 Submit through the official Arena evaluation path and keep original Odyssey score separate.
- [x] 2.4 Block submission when telemetry is incomplete.

## 3. Verification

- [x] 3.1 Add tests that Odyssey original progression is not replaced by Arena score.
- [x] 3.2 Add tests for incomplete telemetry rejection.
- [x] 3.3 Add routing tests that Odyssey migrates only after the bridge is available.
