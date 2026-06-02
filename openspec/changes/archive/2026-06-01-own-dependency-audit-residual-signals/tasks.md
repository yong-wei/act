## 1. Residual Ownership

- [x] 1.1 Record the Next/PostCSS audit finding as a real owned residual, not as local install noise.
- [x] 1.2 Reject unsafe `npm audit fix` downgrade recommendations in the governance record.
- [x] 1.3 Classify ESLint 8, Tailwind 3, and Drei 9 deprecation warnings by owner lane and removal condition.
- [x] 1.4 Ensure low-risk dependency refresh work can distinguish owned residuals from new findings.

## 2. Validation

- [x] 2.1 Run `rtk npm audit --omit=dev --json`.
- [x] 2.2 Run `rtk npm ci` or consume the clean-install evidence from `normalize-runtime-log-and-environment-signals` to capture deprecated-package warnings.
- [x] 2.3 Run dependency path checks for residual warning owners.
- [x] 2.4 Validate with `rtk openspec validate own-dependency-audit-residual-signals --strict`.
