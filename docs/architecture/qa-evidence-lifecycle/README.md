# QA evidence artifact lifecycle

Run-specific screenshots, traces, HARs, and logs are not product inputs. They
are classified, hashed, and externalized; recovery is the Git blob of the
deleted path. The repository keeps portable manifests, audit-ledger markdown,
and representative fixtures that production code still names.

Product TypeScript modules may not import `artifacts/`. Review pages consume
fixtures under `src/lib/qa-evidence/fixtures/`. Commercial UI capture still
uses the existing runner contract and gate matrix; missing external run output
fail-closes instead of substituting a local screenshot.

This change does not mutate production selectors or capture URL/readiness
semantics.
