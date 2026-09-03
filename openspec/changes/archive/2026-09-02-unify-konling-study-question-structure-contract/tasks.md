## 1. Contract and scorer

- [x] 1.1 Add the six-intent section catalog with canonical titles and aliases.
- [x] 1.2 Add a deterministic structure scorer that matches heading lines only.

## 2. Prompt and runtime

- [x] 2.1 Drive `requiredSections` from the catalog without changing the string-array contract.
- [x] 2.2 Write an explicit study-question output contract into the system prompt, including preference compatibility and precedence over the generic length limit.

## 3. Verification

- [x] 3.1 Add tests for six intents, semantic headings, unstructured failure, and concise/table/steps/guided preferences.
- [x] 3.2 Run focused Konling/prompt tests and `openspec validate --type change --strict`.
