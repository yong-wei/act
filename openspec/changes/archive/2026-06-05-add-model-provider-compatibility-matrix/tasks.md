## 1. Provider Contract

- [x] 1.1 Define provider config fields for service id, provider kind, base URL, model name, auth mode, secret reference, priority, enabled state, and capability flags.
- [x] 1.2 Define normalized request, response, stream event, tool call, and citation objects.
- [x] 1.3 Define health check and capability discovery or declaration behavior.

## 2. Runtime Integration

- [x] 2.1 Route Konling path coaching through the provider registry by service id and required capabilities.
- [x] 2.2 Support OpenAI-compatible and Anthropic-compatible adapter fixtures or implementations.
- [x] 2.3 Implement explicit downgrade, alternate-provider selection, or unavailable-state behavior when required capabilities are missing.
- [x] 2.4 Preserve environment-variable fallback when provider config storage is unavailable.

## 3. Security And Admin Controls

- [x] 3.1 Restrict provider configuration reads and writes to admin or service scope.
- [x] 3.2 Store and return secret references rather than plaintext API keys.
- [x] 3.3 Redact provider errors before student or teacher display.

## 4. Verification

- [x] 4.1 Add adapter tests for OpenAI-compatible and Anthropic-compatible normalized tool loops.
- [x] 4.2 Add tests for citation normalization and missing-citation capability fallback.
- [x] 4.3 Add tests for admin authorization, secret redaction, health checks, and environment fallback.
- [x] 4.4 Run `rtk openspec validate add-model-provider-compatibility-matrix --strict`.
- [x] 4.5 Run focused AI runtime, provider, and security tests.
