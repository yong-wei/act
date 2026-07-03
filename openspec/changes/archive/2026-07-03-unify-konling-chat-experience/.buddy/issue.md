---
change_id: unify-konling-chat-experience
claim_branch: unify-konling-chat-experience
series: konling-chat-experience
coupling_group: konling-chat-experience
execution_mode: isolated
base_branch: integration
required_branch:
depends_on:
  - normalize-konling-citation-presentation
parent_issue:
blocked_by: []
blocking: []
openspec_path: openspec/changes/unify-konling-chat-experience
risk: medium
area: ai
---

## Goal

Unify the visible Konling chat experience across graph, adaptive path, copilot, and interactive lesson surfaces while preserving page-specific context, tools, and prompt behavior.

## Scope

- Consolidate visible message, tool-call, diagnostic, and citation rendering into a shared Konling chat experience.
- Render tool calls through a collapsed summary and per-tool expandable rows using standard expand/collapse icons.
- Update prompt input and assistant reply layout.
- Prefix development-mode streaming evidence diagnostics.
- Migrate duplicate visible Konling implementations to wrap, delegate to, or open the shared experience.
- Consume normalized citation presentation from `normalize-konling-citation-presentation`.

## Out of Scope

- Citation normalization itself, except consuming the dependent normalized presentation contract.
- Manual semantic data completion for knowledge graph nodes, textbooks, exercises, or resources.
- Writing Yang Fan or other test-student learner/path history fixtures.
- Changing page-specific tool permissions or replacing server-owned context resolution.

## Acceptance Checklist

- [ ] AC-1: Konling visible chat rendering is shared across current graph, adaptive path, copilot, and interactive lesson entry points. Owner: independent reviewer.
  Evidence: Component diff plus tests or static checks showing duplicate message/tool/citation rendering was removed or delegated.
- [ ] AC-2: Tool calls render as a collapsed "called N tools" disclosure with expandable per-tool rows and standard expand/collapse icons. Owner: independent reviewer.
  Evidence: Component tests or browser evidence for collapsed, hover/focus, expanded summary, and expanded tool-result states.
- [ ] AC-3: Konling layout matches the requested prompt and answer behavior. Owner: independent reviewer.
  Evidence: UI test or screenshot evidence showing prompt input in a 70 percent to 80 percent width range and assistant replies without avatar placeholder narrowing.
- [ ] AC-4: Development-mode evidence diagnostics are visibly labeled as development mode, while production keeps raw diagnostics out of user-visible assistant text. Owner: independent reviewer.
  Evidence: Runtime or component tests for development and production diagnostic visibility.
- [ ] AC-5: Page-specific context, tool sets, and prompt extensions still work after UI consolidation. Owner: independent reviewer.
  Evidence: Browser or integration checks for knowledge graph selected-node context and interactive lesson context.
- [ ] AC-6: OpenSpec and targeted UI tests pass. Owner: independent reviewer.
  Evidence: `rtk openspec validate unify-konling-chat-experience --strict` and targeted AI UI/browser test output.

## Tasks

- [ ] Task 1: Extract or designate the shared Konling chat renderer.
  Covers: AC-1
  Acceptance: Current visible Konling entry points use the same message, tool-call, diagnostic, and citation rendering boundary.
  Evidence: Component diff and targeted static or unit tests.
  Reviewer Check: Confirm remaining wrappers do not keep independent assistant bubble, tool result, or citation rendering logic.
- [ ] Task 2: Implement collapsible tool-call disclosure.
  Covers: AC-2
  Acceptance: Assistant messages summarize called tools, expand to tool rows, and each row expands sanitized result details with standard icons.
  Evidence: Component tests or browser evidence.
  Reviewer Check: Confirm raw internal diagnostics remain hidden for student-visible contexts.
- [ ] Task 3: Update Konling prompt and reply layout.
  Covers: AC-3
  Acceptance: Prompt input occupies 70 percent to 80 percent of the window by default, and assistant replies render without avatar placeholder width loss.
  Evidence: Component test, DOM metric, or screenshot evidence.
  Reviewer Check: Confirm controls remain reachable at narrow and wide widths.
- [ ] Task 4: Label development diagnostics and preserve production gating.
  Covers: AC-4
  Acceptance: Development injected citation diagnostics include a development-mode label, and production does not show raw diagnostic reason codes.
  Evidence: Runtime/component tests for development and production modes.
  Reviewer Check: Confirm the change does not hide persisted diagnostic metadata needed for review.
- [ ] Task 5: Preserve page-specific context contracts.
  Covers: AC-5
  Acceptance: Knowledge graph selected-node questions and interactive lesson questions still receive the proper context, tools, and system prompt extension through the shared UI.
  Evidence: Browser or integration test output.
  Reviewer Check: Confirm unification did not replace route-specific prompts with generic chat behavior.
- [ ] Task 6: Run validation and record evidence.
  Covers: AC-6
  Acceptance: OpenSpec strict validation and targeted UI tests pass.
  Evidence: Validation command output and test output.
  Reviewer Check: Confirm any remaining failures are unrelated and documented before AC approval.

## Agent Guardrails

- Only execute this issue's change.
- Implementation agents may propose satisfied AC ids with evidence, but must not check Acceptance Checklist items themselves.
- Check AC items only after an independent reviewer confirms the linked task evidence.
- Use the claim branch named in front matter.
- Do not execute other planned OpenSpec changes.
- Stop if dependency, coupling group, or branch constraints fail.
- Stop if GitHub blockedBy relationships still contain open blockers.
