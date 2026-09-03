# Payload classification policy matrix

Actions in this matrix are observations only. Classification never executes them.

| class | git retention | approved external storage | local materialization | CI generation | rollback/recovery | public externalization |
| --- | --- | --- | --- | --- | --- | --- |
| A | retain-in-git | not-eligible-by-class-alone | not-required | not-generated | git-history | internal-only |
| B | retain-until-reproducible-elsewhere | not-eligible-by-class-alone | regenerate-from-source | ci-may-regenerate | regenerate | internal-only |
| C | retain-with-manifest | existing-release-lifecycle | existing-materializer-only | not-via-C | existing-rollback-roots | internal-only |
| D | existing-qa-lifecycle | existing-qa-lifecycle | local-ci-output | existing-qa-capture | existing-qa-receipts | internal-only |
| E | do-not-treat-as-source | existing-view-lifecycle | existing-materializer-only | rebuild-view | rebuild-view | internal-only |
| F | retain-until-privacy-approval | ineligible | ineligible | ineligible | existing-privacy-gates | ineligible |
| unknown-privacy | unresolved | ineligible | ineligible | ineligible | unresolved | ineligible |
