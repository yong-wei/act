## 1. Homepage Governance

- [x] 1.1 Register `/` with the appropriate route frame or migrate it into an existing registered shell.
- [x] 1.2 Replace unapproved homepage raw color families with platform tokens or approved primitives.
- [x] 1.3 Avoid broad allowlists; if any exception remains, make it path-, rule-, owner-, and removal-condition-specific.

## 2. Validation

- [x] 2.1 Run `rtk npm run test:commercial-ui-governance`.
- [x] 2.2 Run `rtk npm run test`.
- [x] 2.3 Perform browser checks for `/` if UI source changes are made.
- [x] 2.4 Validate with `rtk openspec validate settle-commercial-ui-governance-noise --strict`.
