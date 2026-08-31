# Governed math disposition (offline)

This directory is a development-only ledger for ActKG Authority sidecar formulas.
It must not be imported by runtime APIs, copied into public assets, or included in
deployment images.

- Qualify: load `control-theory-engineering-v0.37-r3` sidecars, recompute hashes,
  close references, and compare `disposition.json`.
- Review: `review.json` records course-owner approval of registered unavailable rows.
- Upstream: `upstream-repair.json` is the ActKG repair package. It contains release
  identities and trusted LaTeX only; no ACT Markdown, host paths, or credentials.
- ACT-authored Knowledge Card / handout / textbook failures are not recorded here.

Command:

```bash
npx vitest run src/lib/__tests__/governed-math-sidecar.test.ts
```
