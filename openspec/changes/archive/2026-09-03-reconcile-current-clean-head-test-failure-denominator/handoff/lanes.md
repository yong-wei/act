# Per-lane denominator

- subject: `fa6e618d7a875412e975a14259dfac37c4cfed1bc6ca48095184f72bb0946d02`
- sourceCommit: `698cb2f4cd6d001bcbeee95bca9be58c56c1cca3`
- toolCommit: `7bef35c1fb350ddc8f8ad6cc659725cc434f4ad8`
- defaultConclusion: `clean`

| lane | command | status | passed | failed | skipped | unhandled | unresolved | default |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| default | `test` | pass | 15 | 0 | 0 | 0 | 0 | yes |
| unit | `test:unit` | non-clean | 11040 | 71 | 47 | 0 | 0 | no |
| contract | `test:contract` | BLOCKED | 0 | 0 | 0 | 0 | 0 | no |
| integration | `test:integration` | non-clean | 1 | 0 | 16 | 0 | 0 | no |
| e2e-critical | `test:e2e:critical` | non-clean | 0 | 1 | 0 | 0 | 0 | no |
| release | `test:release` | non-clean | 0 | 1 | 0 | 0 | 0 | no |
| nightly | `test:nightly` | BLOCKED | 0 | 0 | 0 | 0 | 0 | no |
