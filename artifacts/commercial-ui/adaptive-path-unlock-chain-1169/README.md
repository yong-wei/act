# PR #1169 Unlock Chain Commercial UI Evidence

Captured from 50f5d7a6adddb5aa8e8ca7e642ee8ece12170841 with the `?demo=1&unlockChainScene=1` production demo path.

## Representative captures

- path-option-preview-desktop-1440: artifacts/commercial-ui/adaptive-path-unlock-chain-1169/path-option-preview-desktop-1440.png
- path-option-preview-mobile-320: artifacts/commercial-ui/adaptive-path-unlock-chain-1169/path-option-preview-mobile-320.png
- execution-structured-desktop-1440: artifacts/commercial-ui/adaptive-path-unlock-chain-1169/execution-structured-desktop-1440.png
- execution-structured-mobile-320: artifacts/commercial-ui/adaptive-path-unlock-chain-1169/execution-structured-mobile-320.png
- execution-prerequisite-target-desktop-1440: artifacts/commercial-ui/adaptive-path-unlock-chain-1169/execution-prerequisite-target-desktop-1440.png
- execution-message-fallback-desktop-1440: artifacts/commercial-ui/adaptive-path-unlock-chain-1169/execution-message-fallback-desktop-1440.png
- execution-unavailable-mobile-320: artifacts/commercial-ui/adaptive-path-unlock-chain-1169/execution-unavailable-mobile-320.png

## Assertions

- Structured multi-gap chains, fallback prerequisites, fallback messages, and unavailable explanations are visible.
- Actionable next actions render links; text-only and unavailable actions remain non-launchable.
- Internal readiness IDs, raw fields, and reason codes are absent from visible text.
- Locked execution nodes expose no start button.
- Desktop and 320px captures have no document-level horizontal overflow.
- Missing or drifted artifacts fail the capture with a non-zero exit.

Manifest: `evidence-manifest.json`