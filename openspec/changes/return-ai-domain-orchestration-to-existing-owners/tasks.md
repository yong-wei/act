## 1. Map ownership and current behavior

- [ ] 1.1 Build a route/tool/workflow inventory for AI reads and writes across all charter owners, including deep imports, Prisma access and duplicate state machines.
- [ ] 1.2 Record canonical owner, public/application contract, scope, revision, permission, idempotency, error and audit expectations for every action.
- [ ] 1.3 Add failing tests proving model suggestions or forged client context cannot create course, assessment, learning-record, profile, publication or production facts.

## 2. Return orchestration to owners

- [ ] 2.1 Migrate assessment, personalization, learning-record, course/classroom, assignment, practice/arena, knowledge/resource and identity calls to their existing public/application boundaries.
- [ ] 2.2 Keep platform/delivery concerns in platform owner and keep provider/session/stream concerns in the C28/C29 canonical seams.
- [ ] 2.3 Add owner-side validation for scope, revision, authorization, provenance, idempotency and concurrency; map failures to explicit AI unavailable/advisory states.
- [ ] 2.4 Remove AI deep imports, Prisma/route access and duplicate business state machines only after behavior parity is demonstrated.

## 3. Verify authority and delivery boundaries

- [ ] 3.1 Add dependency-graph and no-second-workspace/no-second-fact-store contracts.
- [ ] 3.2 Verify AppShell, role projections, SSR/R3F, PlatformSetting, ingress schema, timeout/privacy and release/rollback security validator remain unchanged.
- [ ] 3.3 Run affected domain/AI suites, concurrency and negative authorization tests, typecheck, lint and architecture fitness checks.

## 4. Handoff

- [ ] 4.1 Record before/after owner map, deleted aliases/deep imports and retained adapters.
- [ ] 4.2 Run `openspec validate return-ai-domain-orchestration-to-existing-owners --type change --strict` and attach evidence before C33.
