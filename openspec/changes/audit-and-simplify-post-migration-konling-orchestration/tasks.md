## 1. Baseline

- [ ] 1.1 Confirm no active change owns the runtime, then record current size, direct domain imports, public exports, and compatibility branches.
- [ ] 1.2 Run the existing Konling runtime tests for tools, context, citations, sessions, permissions, persistence, and failures.

## 2. Simplification

- [ ] 2.1 Simplify tool metadata, context projection, citation handling, domain adapters, and run-state plumbing one boundary at a time.
- [ ] 2.2 Remove obsolete compatibility and forwarding code after proving zero use; keep domain decisions in existing public APIs.

## 3. Verification

- [ ] 3.1 Run Konling tests, related chat route tests, `npm run typecheck`, `npm run test`, and `git diff --check`.
- [ ] 3.2 Report before/after size, direct domain imports, guards, state forms, compatibility branches, and unchanged public behavior.
