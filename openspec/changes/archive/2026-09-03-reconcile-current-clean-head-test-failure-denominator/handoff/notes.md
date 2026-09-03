# Investigation notes

- schemaVersion: `act-test-denominator-compact-package/v1`
- packageDigest: `d92540430e6696204147505a0eb9f974e7ac333921af2443411ccc414b679833`
- defaultConclusion: `clean`
- compactDigestCheck: `d92540430e6696204147505a0eb9f974e7ac333921af2443411ccc414b679833`
- subject: successorCaptureId `fa6e618d7a875412e975a14259dfac37c4cfed1bc6ca48095184f72bb0946d02`, sourceCommit `698cb2f4cd6d001bcbeee95bca9be58c56c1cca3`, sourceTree `41d6b3f5966493911d6ce9c1f299015189778d53`, packageDigest `259ce5259694268d25d9b91825f070acf46b78ec0b34d26a0f4bb7686579ab12`, status `qualified-for-investigation`
- tool: toolCommit `7bef35c1fb350ddc8f8ad6cc659725cc434f4ad8`, toolTree `e0acdd1f3cb5d41f799e8238f83ce0099906b851`, entryBundleDigest `6c657a23d91a33def619f7fecdb1a888abc10504954a200f521c129a1ec91c9e`, equalToSubject `false`
- universe: discovered 1452, classified 1415, excluded 37, unresolved 0, duplicate 0
- planned dispositions: 138 (`FIX` 135, `BLOCKED` 2, `QUARANTINE` 1)
- measurement/result-core detail: `artifacts/test-denominator/<successorCaptureId>/` (local/CI only)

Default PR lane `test` is clean for this exact subject/tool pair. Non-default lanes remain independently non-clean or BLOCKED (unit 71 failures + 47 unregistered skips; contract timeout; integration 16 unregistered skips; e2e-critical Playwright webServer failed on subject-checkout `node_modules` symlink; release qualification manifest missing; nightly not run).

Follow-up FIX/DELETE/QUARANTINE execution is out of scope. Do not write this package into `REQUIRED_BASELINE`, `REQUIRED_FITNESS_BUDGET`, or any active selector. This artifact commit is not the subject identity.
