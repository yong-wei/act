# Tasks: issue-2164-central-auth

## 1. Identity and roster

- [x] 1.1 Replace stage-A subject/person confusion and automatic account matching with verified issuer+subject+person mapping.
- [x] 1.2 Export ACT account and business role baselines without secrets, including ACT-only exceptions.
- [x] 1.3 Bind the central admin only by explicit person id and keep local roles authoritative.

## 2. Central access and session lifecycle

- [x] 2.1 Enforce ACT grant, person status, and sessionVersion before local authorization.
- [x] 2.2 Implement page-in OIDC transactions, callback, completion, cancellation, and deep-link restoration.
- [ ] 2.3 Cover revocation, restoration, global disablement, account switching, local logout hold, and global logout while preserving anonymous content.

## 3. Account administration and migration

- [x] 3.1 Retire local authentication account creation, enablement, and password writes without weakening business role management.
- [ ] 3.2 Run real roster dry-run, conflict isolation, apply/resume/diff, activation, mapping backfill, and rollback verification.

## 4. Verification and delivery

- [ ] 4.1 Add unit and integration coverage and pass typecheck, relevant suites, build, and strict OpenSpec validation.
- [ ] 4.2 Complete real browser acceptance, latest-head Codex review, and merge.
- [ ] 4.3 Deploy ACT, verify production identity, grants, public access, logout, migration, recovery, and rollback, then archive and record platform#11.
