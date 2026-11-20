# Design: ACT central account and in-page login

## Identity and migration

`Account(provider='platform')` stores the OIDC issuer and subject as a composite `providerAccountId`; `session_state` stores the central `person_id`. Existing stage-A rows are upgraded only after the OIDC exchange verifies issuer, subject, and person claim. No login path matches a person by email, display name, or self-reported username.

The roster endpoint exports local user id, trusted student/employee identifier, account status, eligibility, and business role baseline. It contains no password, token, secret, or learning evidence. ACT-only accounts remain explicit exceptions in migration.

## Central decision and local authorization

Every protected session validates the current ACT grant, central person status, and sessionVersion before local role and ownership checks. Revocation disables only ACT; global disablement affects every connected app. Local database role remains authoritative. A central grant without a local business role or mapping is an explicit configuration-pending state, never implicit ADMIN.

The central daily admin is linked to the existing local ADMIN only by an explicit person id. Legacy administrator password login is retired with the other migrated credentials.

## In-page lifecycle

The app creates short-lived, origin-bound OIDC transactions and displays the provider in an in-page iframe. Completion returns only a transaction id; the app exchanges it once for its own host-only session. The provider never navigates the ACT top-level page. Draft and deep-link state are restored without starting simulations, resubmitting work, or generating evidence.

Local logout suppresses automatic SSO until explicit user action. Global logout ends the central session. Account switching clears per-user caches and aborts outstanding personal requests. Public pages and optional session endpoints remain anonymous and do not open the dialog.

## Account administration

Central owns authentication accounts, enablement, passwords, and application grants. ACT retains local role assignment, student profiles, classes, course membership, and resource permissions. Existing account-creation and password-write endpoints return a retired status rather than silently creating parallel credentials.

## Rollout

Deploy read-only roster export first, run dry-run/diff/apply/resume and activation, backfill verified mappings, then enable central enforcement. Preserve pre-migration images and mapping lists for rollback. Production completion is recorded only after real browser and revocation/recovery checks.
