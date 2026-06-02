## Why

Some audit remediations and ecosystem support may require moving beyond Next 15. Next 16 should be evaluated only after the Next 15 step gives a known-good baseline, and the change may close with a documented not-required decision when Next 15 already satisfies the audit and deployment goals.

## What Changes

- Evaluate remaining framework advisories and ecosystem constraints after the validated Next 15 baseline.
- Upgrade from the validated Next 15 baseline to a supported Next 16 release only if required or clearly justified.
- If Next 16 is not required, record the not-required decision, evidence, remaining audit state, and follow-up trigger.
- When an upgrade is performed, resolve React, peer dependency, routing, middleware/proxy, image, build, and deployment compatibility issues introduced by Next 16.
- Validate production build, standalone deployment assumptions, and representative route behavior for either the upgrade path or the not-required decision.
- Document remaining audit findings and accepted residual risks.

## Capabilities

### New Capabilities
- `dependency-vulnerability-catalog`: Adds the Next 16 framework remediation requirement.

### Modified Capabilities
- None.

## Impact

- May affect framework packages, React peer dependencies, build/deploy behavior, and broad route runtime behavior.
- Highest-risk change in the series; requires completed Next 15 validation first.
