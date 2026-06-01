## 1. Homepage Governance

- [ ] 1.1 Register `/` with the appropriate route frame or migrate it into an existing registered shell.
- [ ] 1.2 Replace unapproved homepage raw color families with platform tokens or approved primitives.
- [ ] 1.3 Avoid broad allowlists; if any exception remains, make it path-, rule-, owner-, and removal-condition-specific.

## 2. Validation

- [ ] 2.1 Run `rtk npm run test:commercial-ui-governance`.
- [ ] 2.2 Run `rtk npm run test`.
- [ ] 2.3 Perform browser checks for `/` if UI source changes are made.
- [ ] 2.4 Validate with `rtk openspec validate settle-commercial-ui-governance-noise --strict`.
