## 1. Runtime Selection

- [ ] 1.1 Audit current provider selection and capability requirement paths.
- [ ] 1.2 Add explicit runtime-supported adapter state for every provider kind.
- [ ] 1.3 Ensure unavailable providers are never selected for live grading, Konling, diagnosis, or prep-pack tasks.
- [ ] 1.4 Preserve clear unavailable or downgraded states when no provider satisfies requirements.

## 2. Adapter Normalization

- [ ] 2.1 Harden OpenAI-compatible adapter normalization for tools, JSON schema, streaming, errors, and citation metadata.
- [ ] 2.2 Add Anthropic-compatible fixture normalization for messages, `tool_use`, `tool_result`, streaming, JSON-like outputs, and citations.
- [ ] 2.3 Add native Anthropic-compatible runtime adapter only if the project has credentials and SDK/runtime dependency support; otherwise keep the provider kind explicitly unavailable.

## 3. Health and Smoke Tests

- [ ] 3.1 Add local smoke tests for chat, structured draft grading, citation-bearing answer, streaming, and capability fallback.
- [ ] 3.2 Expose admin-visible health and capability state without leaking API keys, secret refs, or internal stack traces.
- [ ] 3.3 Document local-only smoke command and keep it out of GitHub Actions unless explicitly requested later.

## 4. Verification

- [ ] 4.1 Add provider selection and redaction tests.
- [ ] 4.2 Add adapter fixture tests.
- [ ] 4.3 Run local provider smoke tests with available configured provider.
- [ ] 4.4 Run `rtk openspec validate provider-runtime-compatibility-hardening --strict`.
