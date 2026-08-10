# July 2026 dependency remediation baseline

## Capture identity

- Base commit: `56f62b2a0463a5aebebb7e3fdbdcd4796916c19a`
- Base `package-lock.json` SHA-256: `9cd916c6b00c5170463458eb556ef111425245aae4406fd0300aa55b1157051a`
- Node: `v26.0.0`
- npm: `11.12.1`
- Configured local registry: `https://registry.npmmirror.com`
- Authoritative audit registry: `https://registry.npmjs.org`
- Audit date: 2026-07-24

The baseline was re-created from `git archive 56f62b2a0 package.json package-lock.json`
in a temporary directory. This prevents installed modules or later lockfile work
from changing the before-state.

The reproducible commands are:

```bash
npm audit --package-lock-only --json --registry=https://registry.npmjs.org --audit-level=low
npm audit --package-lock-only --omit=dev --json --registry=https://registry.npmjs.org --audit-level=low
npm ls --package-lock-only @gltf-transform/functions ndarray-pixels sharp next next-auth postcss prisma @prisma/dev @hono/node-server hono brace-expansion esbuild fast-uri js-yaml whatwg-encoding --all
```

## Direct dependency ranges

| Lane | Base range | Base resolution |
|---|---|---|
| Next | `^16.2.7` | `16.2.7` |
| NextAuth | `^4.24.14` | `4.24.14` |
| Prisma CLI | `^7.8.0` | `7.8.0` |
| Prisma Client | `^7.8.0` | `7.8.0` |
| Sharp | `^0.33.0` | `0.33.5` |
| glTF transform functions | `^4.4.1` | `4.4.1` |

## Raw audit summary

| Scope | Critical | High | Moderate | Low | Total |
|---|---:|---:|---:|---:|---:|
| Complete lockfile | 1 | 9 | 3 | 1 | 14 |
| `--omit=dev` | 1 | 6 | 3 | 1 | 11 |

These counts are npm vulnerability package records, not unique advisory counts.

| Finding | Advisory identifiers or aggregated cause | Ownership path | Relevance | Lane |
|---|---|---|---|---|
| `next-auth` | `GHSA-xmf8-cvqr-rfgj`, `GHSA-7rqj-j65f-68wh`, `GHSA-x445-f3h2-j279` | direct `next-auth@4.24.14` | production | auth |
| `next` | nine Next advisories plus `postcss` and `sharp` | direct `next@16.2.7` | production | framework |
| `postcss` | `GHSA-qx2v-qp2m-jg93`, `GHSA-6g55-p6wh-862q` | `next -> postcss@8.4.31` | production | framework |
| `sharp` | `GHSA-f88m-g3jw-g9cj` | direct, `next -> sharp@0.34.5`, and `ndarray-pixels -> sharp@0.34.5` | mixed | image |
| `@gltf-transform/functions` | aggregated `ndarray-pixels` | direct dev dependency | development | image tooling |
| `ndarray-pixels` | aggregated `sharp` | `@gltf-transform/functions -> ndarray-pixels@5.0.1` | development | image tooling |
| `prisma` | aggregated `@prisma/dev` | direct `prisma@7.8.0` | production install tree | Prisma |
| `@prisma/dev` | aggregated `@hono/node-server` | `prisma -> @prisma/dev@0.24.3` | production install tree | Prisma |
| `@hono/node-server` | `GHSA-92pp-h63x-v22m`, `GHSA-frvp-7c67-39w9` | `@prisma/dev -> @hono/node-server@1.19.11` | production install tree | Prisma |
| `hono` | `GHSA-rv63-4mwf-qqc2`, `GHSA-wgpf-jwqj-8h8p`, `GHSA-88fw-hqm2-52qc`, `GHSA-wwfh-h76j-fc44`, `GHSA-j6c9-x7qj-28xf`, `GHSA-xgm2-5f3f-mvvc`, `GHSA-hvrm-45r6-mjfj`, `GHSA-w62v-xxxg-mg59` | `@prisma/dev -> hono@4.12.23` | production install tree | Prisma |
| `brace-expansion` | `GHSA-3jxr-9vmj-r5cp` | ESLint and archive tooling | mixed | tooling |
| `fast-uri` | `GHSA-v2hh-gcrm-f6hx`, `GHSA-4c8g-83qw-93j6` | `ajv -> fast-uri@3.1.2` | production | tooling |
| `js-yaml` | `GHSA-52cp-r559-cp3m` | `eslint -> @eslint/eslintrc -> js-yaml@4.2.0` | development | tooling |
| `esbuild` | `GHSA-g7r4-m6w7-qqqr` | `tsx` and `vite` to `esbuild@0.28.0` | tooling | tooling |

## Governance state

Before remediation, the gate reported:

- 13 tracked moderate-or-higher package records;
- 2 allowed records;
- 11 unallowlisted records;
- 3 unused allowlist entries;
- 1 deprecated package and 1 unowned deprecation warning.

The deprecated package is `whatwg-encoding@3.1.1`, installed by
`jsdom@26.1.0` directly and through `html-encoding-sniffer@4.0.0`.
Issue #1033 owns that exact development-only warning until the supported jsdom
line removes it.

A fresh official-registry `npm ci` from the committed baseline also leaves
`@emnapi/runtime@1.10.0` as extraneous. `npm prune` does not remove it. This is
an existing mixed Sharp 0.33/0.34 optional-dependency defect, so task 2.4
remains incomplete until the final compatible Sharp convergence produces a
clean tree.

The previous Next/PostCSS exceptions are stale because the same package records
now contain new high-severity advisories. They must be removed rather than
expanded. Production high findings cannot be allowlisted by this batch.

The Prisma/Hono residual remains owned by #291. Its exact advisory set now also
includes `GHSA-frvp-7c67-39w9` / source `1124006`.

## Candidate decisions

| Candidate | Decision | Evidence |
|---|---|---|
| NextAuth `4.24.15` | Accept | Latest v4; clears all baseline NextAuth advisories without changing the credentials/JWT contract. |
| Next `16.2.11` | Accept only for Next-owned fixes | Latest stable 16; clears the nine Next-owned advisories but still pins vulnerable PostCSS and accepts only Sharp 0.34. |
| Sharp `0.35.3` direct | Reject in the mixed tree | It clears the direct advisory, but npm hoists `@img/sharp-wasm32@0.35.3` across nested Sharp 0.34 consumers, producing an invalid/extraneous tree after `npm ci`. |
| `brace-expansion` `1.1.16` / `5.0.8` | Accept | Existing parent ranges accept the patched versions. |
| `fast-uri` `3.1.4` | Accept | `ajv@8.20.0` accepts the version through `^3.0.1`. |
| `js-yaml` `4.3.0` | Accept | `@eslint/eslintrc@3.3.5` accepts it through `^4.1.1`. |
| `esbuild` `0.28.1` | Accept | The existing tool parents accept the patched version. |
| Prisma `7.9.0` | Reject for this revision | Removes Hono but introduces the new high-severity `find-my-way` advisory through `@prisma/dev@0.24.14`. |
| Next `16.3.0-preview.9` | Reject | It is not stable and still uses PostCSS `8.5.10`, below the `8.5.12` fix floor. |
| Override nested PostCSS or Sharp | Reject | Next pins PostCSS `8.4.31` and accepts Sharp only through `^0.34.5`; ndarray-pixels accepts Sharp only through `^0.34.0`. |
| Downgrade glTF functions to `3.4.2` | Reject | It crosses the supported dependency line and is npm audit downgrade guidance rather than a compatible fix. |

## Blocking upstream conditions

Issue #1035 tracks the release-blocking production Next paths. A supported
stable Next 16 release must accept PostCSS `>=8.5.12` and Sharp `>=0.35.0`.
The direct Sharp dependency must move in the same compatible batch; updating it
alone fails the required clean `npm ls` invariant because the current nested
Sharp 0.34 consumers require different exact optional binaries.

Issue #1034 is addressed by moving GLB optimization into the independent
`tools/glb-model-optimizer` npm project. The application build no longer invokes
model compression, and the root dependency graph no longer contains
`@gltf-transform/*` or its `ndarray-pixels` path. The root manifest also no
longer declares `meshoptimizer` directly; `@types/three` retains its unrelated
transitive meshoptimizer type dependency. Optimized GLBs remain ignored
production resources and are copied from the primary worktree into isolated
worktrees as real files.

This does not resolve the root production Sharp dependency or the Sharp version
accepted by Next. Until those production conditions are satisfied, parent
remediation #1032 cannot pass `audit:governance` or produce final image
evidence. The compatible, already verified subset is delivered independently
by #1036; its merge does not claim that #1032 or #1035 is complete.
