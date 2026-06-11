## 1. Runtime Selection

- [x] 1.1 Audit current provider selection and capability requirement paths.
- [x] 1.2 Add explicit runtime-supported adapter state for every provider kind.
- [x] 1.3 Ensure unavailable providers are never selected for live grading, Konling, diagnosis, or prep-pack tasks.
- [x] 1.4 Preserve clear unavailable or downgraded states when no provider satisfies requirements.

## 2. Adapter Normalization

- [x] 2.1 Harden OpenAI-compatible adapter normalization for tools, JSON schema, streaming, errors, and citation metadata.
- [x] 2.2 Add Anthropic-compatible fixture normalization for messages, `tool_use`, `tool_result`, streaming, JSON-like outputs, and citations.
- [x] 2.3 Add native Anthropic-compatible runtime adapter only if the project has credentials and SDK/runtime dependency support; otherwise keep the provider kind explicitly unavailable.

## 3. Health and Smoke Tests

- [x] 3.1 Add local smoke tests for chat, structured draft grading, citation-bearing answer, streaming, and capability fallback.
- [x] 3.2 Expose admin-visible health and capability state without leaking API keys, secret refs, or internal stack traces.
- [x] 3.3 Document local-only smoke command and keep it out of GitHub Actions unless explicitly requested later.

## 4. Verification

- [x] 4.1 Add provider selection and redaction tests.
- [x] 4.2 Add adapter fixture tests.
- [x] 4.3 Run local provider smoke tests with available configured provider.
- [x] 4.4 Run `rtk openspec validate provider-runtime-compatibility-hardening --strict`.
