## 1. Runtime Logs

- [ ] 1.1 Make startup/runtime verification distinguish current-run errors from historical `.logs/error.log` residue.
- [ ] 1.2 Ensure runtime checks can report an error-log delta without relying on manually reading stale entries.

## 2. Environment Contract

- [ ] 2.1 Declare or validate the supported Node version range for local, CI, and server use.
- [ ] 2.2 Declare or validate the package-manager version used to generate the lockfile.
- [ ] 2.3 Refresh Browserslist data through an auditable lockfile hygiene step if required.
- [ ] 2.4 Verify whether extraneous `@emnapi/*` packages disappear after clean `npm ci`; if not, record the owning dependency path.

## 3. Validation

- [ ] 3.1 Run `rtk npm ci`.
- [ ] 3.2 Run `rtk npm ls --depth=0`.
- [ ] 3.3 Run a homepage smoke request and confirm current-run error reporting is unambiguous.
- [ ] 3.4 Validate with `rtk openspec validate normalize-runtime-log-and-environment-signals --strict`.
