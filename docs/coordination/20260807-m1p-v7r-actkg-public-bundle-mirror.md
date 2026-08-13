# M1P V7R ActKG Public Bundle Consumer Mirror

## Decision

ACT has accepted the byte-preserving consumer mirror of the following ActKG
public Bundles on `integration` at commit `b0f74a42e7dc9ea0a9f7fc524271bbda175cfee8`:

- `robustness-sensitivity-analysis-engineering-v0.1`
- `control-theory-integration-v0.11`
- `control-theory-engineering-v0.13`

The authoritative ActKG publication is commit
`c65df1dadd7685ccbfee1e01132bbbb91cd2335a` on ActKG `main`, with the
corresponding remote public and source tags. The consumer commit only vendors
the three public Bundles, registers the V7R relation policy, and pins their
canonical projection digests.

## Evidence

- Every mirrored directory passes its committed `SHA256SUMS` verification.
- The ACT canonical-digest, public-bundle compatibility, and privacy suites
  pass: 70 tests.
- ACT commit and push gates pass, including TypeScript type checking and the
  staged resource-governance checks.

## Boundary

This is a compatible public-Bundle mirror on ACT `integration`, not a
production activation. It does not create a ReleaseSet Lock, candidate import
receipt, ReleaseSet Delta, candidate state, or production selector change.

ACT `main` is deliberately not advanced by this mirror. At this decision,
`origin/main..origin/integration` contains 420 commits. Promoting `main`
would therefore release an unreviewed wider integration range rather than only
these three Bundles. A later ACT release change must review that complete
range, run the existing ReleaseSet/import/candidate/activation process in a
clean checkout, and produce its own receipts.

The original ACT working tree is not used for this publication because it has
unrelated user modifications.
