# Provider Runtime Compatibility

状态: active
最后更新: 2026-06-12
摘要: 记录 AI provider runtime 兼容性门禁和本地 smoke 验证命令。该文档只描述运行时能力检查，不保存 provider 密钥、secretRef 或外部服务响应正文。

## Runtime Rule

Provider selection requires both declared capabilities and a runtime-supported adapter. Metadata-only providers can remain visible in admin settings, but they must not be selected for live chat, grading, diagnosis, Konling, reports, or prep-pack calls until a native runtime adapter exists.

Current runtime support:

- `openai-compatible`: supported through the OpenAI-compatible runtime adapter.
- `anthropic-compatible`: metadata and fixture normalization are supported, but live runtime selection remains unavailable until a native adapter is added.

## Local Smoke Command

Run the local smoke validation with:

```bash
rtk npm run test:provider-runtime-smoke
```

The smoke command checks:

- chat provider selection
- structured draft grading tool-call normalization
- citation-bearing response normalization
- OpenAI-compatible text streaming and Anthropic-compatible tool-use streaming fixtures
- unavailable fallback when only metadata-only Anthropic-compatible providers are present

Failures report provider id and capability category. The command must not print API keys, secret refs, bearer tokens, or raw stack traces.
