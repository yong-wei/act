# Content, knowledge, and runtime release

Standard toolchain entries for content export, locked knowledge publication,
and immutable runtime publication. Captured-tree denominators are `git ls-files`
counts 41 / 7 / 75 / 33 / 5.

Publication commands go through `tools/content-knowledge-runtime-release`.
Knowledge projection publication is owned by `teaching-projection:*`. Operator
activation, deploy, rollback, and OSS mounts stay as explicit adapters.

Verification uses existing `typecheck:tools` plus
`src/lib/__tests__/content-knowledge-runtime-release-toolchains.test.ts`.
This change does not activate selectors, deploy hosts, or mutate production data.
