## 1. Runtime Logs

- [x] 1.1 Make startup/runtime verification distinguish current-run errors from historical `.logs/error.log` residue.
- [x] 1.2 Ensure runtime checks can report an error-log delta without relying on manually reading stale entries.

## 2. Environment Contract

- [x] 2.1 Declare or validate the supported Node version range for local, CI, and server use.
- [x] 2.2 Declare or validate the package-manager version used to generate the lockfile.
- [x] 2.3 Refresh Browserslist data through an auditable lockfile hygiene step if required.
- [x] 2.4 Verify whether extraneous `@emnapi/*` packages disappear after clean `npm ci`; if not, record the owning dependency path.

## 3. Validation

- [x] 3.1 Run `rtk npm ci`.
- [x] 3.2 Run `rtk npm ls --depth=0`.
- [x] 3.3 Run a homepage smoke request and confirm current-run error reporting is unambiguous.
- [x] 3.4 Validate with `rtk openspec validate normalize-runtime-log-and-environment-signals --strict`.
