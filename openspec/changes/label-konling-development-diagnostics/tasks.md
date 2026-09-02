## 1. Reproduce the ambiguous presentation

- [ ] 1.1 Add a regression showing development injection contains internal diagnostic fields but no development-mode identity.
- [ ] 1.2 Confirm production default and explicit support override behavior against the existing #693 contract.

## 2. Label and separate diagnostics

- [ ] 2.1 Add a stable development/support diagnostic prefix whenever detailed diagnostics are injected into visible stream text.
- [ ] 2.2 Keep diagnostic text semantically distinct from verified citation presentation and preserve production raw-token suppression.

## 3. Verify the contract

- [ ] 3.1 Cover development, production and explicit override cases in focused unit tests.
- [ ] 3.2 Run related Konling tests, typecheck, strict OpenSpec validation and `git diff --check`.
