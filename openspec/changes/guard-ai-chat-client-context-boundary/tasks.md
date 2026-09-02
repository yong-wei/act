## 1. Context boundary

- [ ] 1.1 Add strict parsing for page and legacy lesson context presence.
- [ ] 1.2 Resolve complete page identity through authenticated server-owned
  records before prompt construction.
- [ ] 1.3 Return `INVALID_AI_CONTEXT` for partial, unknown, or unauthorized
  page context before model and tool execution.
- [ ] 1.4 Restrict legacy lesson behavior to recognized enum controls and remove
  arbitrary free-text system instructions.

## 2. Prompt and scope safety

- [ ] 2.1 Ensure prompt builders receive server-owned page fields rather than
  browser-authored titles, topics, objectives, or labels.
- [ ] 2.2 Ensure client context cannot expand target, course, page, class,
  resource, privacy, or tool scope.
- [ ] 2.3 Preserve context-free chat and bounded legacy compatibility.

## 3. Regression coverage

- [ ] 3.1 Add route tests for partial, unknown, unauthorized, and malicious page
  context.
- [ ] 3.2 Add prompt-builder tests for multiline and instruction-like legacy
  text, proving it never becomes system authority.
- [ ] 3.3 Add valid server-resolved context and context-free compatibility
  regressions.
- [ ] 3.4 Run focused AI tests, related tests, typecheck, strict OpenSpec
  validation, and `git diff --check`.

