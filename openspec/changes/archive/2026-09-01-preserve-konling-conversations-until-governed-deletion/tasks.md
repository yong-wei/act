## 1. Retention contract and regression baseline

- [x] 1.1 Add failing tests proving a library conversation created more than seven days earlier disappears from list, detail and chat continuation despite not being deleted.
- [x] 1.2 Add shared retention eligibility tests for no expiry, future governed expiry, elapsed governed expiry, user ownership and `libraryVisible=false` records.
- [x] 1.3 Add database fixtures distinguishing visible expired native/library conversations from excluded legacy empty or failed-initialization sessions.

## 2. Schema and data migration

- [x] 2.1 Make `KonlingSession.expiresAt` nullable and add an idempotent PostgreSQL migration.
- [x] 2.2 Clear the obsolete fixed expiry only for `libraryVisible=true` rows while preserving messages, titles, pinned state, activity timestamps and source identity.
- [x] 2.3 Verify migration counts and unchanged message/content hashes on a restored production-format PostgreSQL database; prove `libraryVisible=false` rows remain excluded.

## 3. Runtime and client alignment

- [x] 3.1 Create new library conversations without a product-level expiry and serialize nullable retention state safely.
- [x] 3.2 Apply one shared active-retention condition to list, detail, rename/pin, delete, chat ownership, message persistence and conversation-turn claim/release paths.
- [x] 3.3 Add route/runtime regressions for restored history, continuing after the old seven-day boundary, explicit governed expiry, cross-user denial and confirmed deletion.
- [x] 3.4 Verify global sidebar and supported embedded/standalone clients can reopen restored conversations without presenting them as new or duplicating messages.

## 4. Delivery verification

- [x] 4.1 Run focused conversation-library, session-route, chat-route and runtime tests plus `prisma validate`, generated client checks and `npm run typecheck`.
- [x] 4.2 Run the migration on isolated PostgreSQL, record before/after visible, expired and excluded counts, and verify rerun safety.
- [x] 4.3 Run `openspec validate preserve-konling-conversations-until-governed-deletion --strict`, repository strict validation and `git diff --check` on the final intended revision.
- [x] 4.4 Capture browser evidence for an older restored conversation being listed, opened and continued at desktop and 320px when the affected UI changes are visible.
- [x] 4.5 Record verification results and the post-merge `openspec archive preserve-konling-conversations-until-governed-deletion --yes` responsibility before delivery.
