## 1. Establish the shared failure contract

- [ ] 1.1 Add red tests for JSON errors, plain-text errors, empty responses, stream failures and rejected fetch calls, including internal canary strings that must never reach student output.
- [ ] 1.2 Define the bounded failure categories, allowlisted server codes, Simplified Chinese copy and state-appropriate recovery descriptors.
- [ ] 1.3 Align `/api/ai/chat` public failure responses with stable codes while keeping provider and exception details in redacted server diagnostics only.

## 2. Integrate active student surfaces

- [ ] 2.1 Normalize failures in the shared `useLegacyChat` transport boundary without exposing raw `Error.message` to presentation components.
- [ ] 2.2 Update `/ai/copilot` to handle authentication, missing conversation, invalid task context, state conflict and retryable service failures with matching actions.
- [ ] 2.3 Update the global Konling sidebar status and error regions to consume the same bounded failure model and preserve accessible announcements.
- [ ] 2.4 Audit production imports and avoid expanding the change to unreferenced legacy components unless they share the active adapter automatically.

## 3. Verify the student recovery journey

- [ ] 3.1 Add component tests proving raw JSON, machine codes, provider names and browser exception text never appear in the active DOM.
- [ ] 3.2 Add browser acceptance for representative 401, 404, 409, 503 and network failures, proving each action changes or repairs the required state.
- [ ] 3.3 Capture revision-bound 1440px and 320px evidence for standalone Copilot and the global sidebar error states, including keyboard focus and no horizontal overflow.
- [ ] 3.4 Run focused transport, route, component and Playwright tests, full TypeScript checking, strict change and repository OpenSpec validation, Commercial UI governance and `git diff --check` on the final revision.
