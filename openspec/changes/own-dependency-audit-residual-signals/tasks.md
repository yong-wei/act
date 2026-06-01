## 1. Residual Ownership

- [ ] 1.1 Record the Next/PostCSS audit finding as a real owned residual, not as local install noise.
- [ ] 1.2 Reject unsafe `npm audit fix` downgrade recommendations in the governance record.
- [ ] 1.3 Classify ESLint 8, Tailwind 3, and Drei 9 deprecation warnings by owner lane and removal condition.
- [ ] 1.4 Ensure low-risk dependency refresh work can distinguish owned residuals from new findings.

## 2. Validation

- [ ] 2.1 Run `rtk npm audit --omit=dev --json`.
- [ ] 2.2 Run `rtk npm ci` or consume the clean-install evidence from `normalize-runtime-log-and-environment-signals` to capture deprecated-package warnings.
- [ ] 2.3 Run dependency path checks for residual warning owners.
- [ ] 2.4 Validate with `rtk openspec validate own-dependency-audit-residual-signals --strict`.
