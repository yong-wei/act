# September 2026 dependency remediation baseline

## Capture identity

- Base commit: `e39da04852f2b1dba62edbc3bfa0796fb2fb5cf4` (`origin/integration`)
- Base `package-lock.json` SHA-256: `c744a44586a83c0e803ada63c3245c8058ac9a2b1f7856a18f85e38a72ed1860`
- Node: `v26.0.0`
- npm: `11.12.1`
- Configured local registry: `https://registry.npmmirror.com`
- Authoritative audit registry: `https://registry.npmjs.org`
- Audit date: 2026-09-01

The baseline was re-created from `git show HEAD:package.json` and
`git show HEAD:package-lock.json` in a temporary directory, then audited with
`--package-lock-only`. This keeps later lockfile work from changing the
before-state.

The reproducible commands are:

```bash
npm audit --package-lock-only --json --registry=https://registry.npmjs.org --audit-level=low
npm audit --package-lock-only --omit=dev --json --registry=https://registry.npmjs.org --audit-level=low
npm ls --package-lock-only next prisma @prisma/client @prisma/adapter-pg @prisma/dev @hono/node-server find-my-way sharp postcss next-auth eslint-config-next deepmerge-ts brace-expansion fast-uri js-yaml --all
```

## Direct dependency ranges

| Lane | Base range | Base resolution | Selected range | Selected resolution |
|---|---|---|---|---|
| Next | `^16.2.11` | `16.2.11` | `^16.3.4` | `16.3.4` |
| eslint-config-next | `^16.2.11` | `16.2.11` | `^16.3.4` | `16.3.4` |
| NextAuth | `^4.24.15` | `4.24.15` | unchanged | `4.24.15` |
| Prisma CLI / Client / adapter-pg | `^7.8.0` | `7.8.0` | `^7.10.0` | `7.10.0` |
| Sharp | `^0.33.0` | `0.33.x` | `^0.35.4` | `0.35.4` |
| PostCSS (direct) | `^8.5.15` | below `8.5.23` | unchanged range | `8.5.23` |

## Raw baseline audit summary

| Scope | Critical | High | Moderate | Low | Total |
|---|---:|---:|---:|---:|---:|
| Complete lockfile | 0 | 10 | 4 | 0 | 14 |
| `--omit=dev` | 0 | 9 | 4 | 0 | 13 |

| Finding | Advisory / cause | Relevance | Lane | Decision |
|---|---|---|---|---|
| `next`, `postcss`, `sharp` | PostCSS `<=8.5.22`, Sharp `<0.35.0`; Next range through `16.3.0-preview.10` | production | framework / image | Accept Next `16.3.4` (`postcss@8.5.23`, optional `sharp@^0.35.4`) and Sharp `0.35.4`. Closes #1035. |
| `prisma`, `@prisma/dev`, `@hono/node-server`, `hono`, `valibot` | Hono / valibot through `@prisma/dev<=0.24.16` | production install tree | Prisma | Accept Prisma `7.10.0` → `@prisma/dev@0.24.17`. Hono path absent. Closes #291. |
| `prisma`, `@prisma/config`, `deepmerge-ts` | `GHSA-ggr8-5vv4-36mx`, `deepmerge-ts<8.0.0` | production install tree | Prisma | `@prisma/config@7.10.0` pins `deepmerge-ts@7.1.5`. Nested override to `8.0.2` after `prisma validate` and a valid `npm ls`. No Prisma 7 release depends on `>=8`; Prisma 8 is a major/RC and out of scope. |
| `brace-expansion` | `<=1.1.17` or `4.0.0–5.0.8` | mixed | tooling | Accept `1.1.18` and `5.0.9` (parent ranges `^1.1.7` / `^5.0.5`). |
| `fast-uri` | `3.0.0–3.1.4` | production | tooling | Accept `3.1.6` (`ajv@8.20.0` allows `^3.0.1`). |
| `js-yaml` | `4.0.0–4.3.0` | development | tooling | Accept `4.3.2` (`@eslint/eslintrc` allows `^4.1.1`). |
| `nanoid` | `<=3.3.17` | production via PostCSS | tooling | Resolved by PostCSS `8.5.23`. |

## Rejected candidates

| Candidate | Decision | Evidence |
|---|---|---|
| Prisma `8.0.0-rc.12` / `@prisma/client` still `7.10.0` | Reject | Major plus RC; client latest remains 7.10.0. |
| Prisma `7.9.0` | Reject | Still installs vulnerable `find-my-way@9.6.0`. |
| Next `16.3.0-preview.*` / `canary` | Reject | Not a supported stable 16 release. |
| jsdom major | Reject | Owned by #1033; this batch does not migrate jsdom. |
| `npm audit fix --force` or Prisma `6.12.0` downgrade | Reject | Crosses supported major lines. |

## Final official-registry audit

| Scope | Critical | High | Moderate | Low | Total |
|---|---:|---:|---:|---:|---:|
| Complete lockfile | 0 | 0 | 0 | 0 | 0 |

`npm ls --package-lock-only --all` reports no `invalid:` or `extraneous:` paths.
`@hono/node-server` and `hono` are absent. `@prisma/dev` is `0.24.17` with
`find-my-way@9.7.0`. `deepmerge-ts` is `8.0.2` only under `@prisma/config`.

Security allowlist entries are empty. The remaining owned residual is the
jsdom `whatwg-encoding@3.1.1` deprecation (#1033).
