# Browser verification evidence

Date: 2026-08-17

## Environment

- Branch: `issue-1429`
- Application: `http://127.0.0.1:3002`
- Authentication: real NextAuth credentials callback using the seeded `demo` student account; the browser session was not replaced by an `/api/auth/session` route stub.
- Database: temporary local PGlite PostgreSQL-compatible instance with the current Prisma schema and demo student profile.
- Candidate facts: deterministic browser route fixtures for the three-candidate batch; server identity and authorization behavior is covered separately by the route and runtime tests.

## Commands

```powershell
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:3002'
$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'
npx playwright test tests/adaptive-path-candidate-comparison-1429.spec.ts --reporter=line
```

Result: 2 tests passed.

The auditable capture repeated the same desktop and 320px flows with a Playwright-managed, non-reused server on port 33142. Result: 2 tests passed.

## Auditable visual capture

- Capture source revision: `0eed0725de88f648979af63a4a48518a51df8332`
- Integration baseline merged into the source revision: `d3b0a13f54908162dfc59c61083290357ae2d54d`
- Capture command: `node artifacts/commercial-ui/issue-1429-candidate-comparison/capture-evidence.mjs`
- Manifest: `artifacts/commercial-ui/issue-1429-candidate-comparison/evidence-manifest.json`
- Desktop screenshot: `artifacts/commercial-ui/issue-1429-candidate-comparison/candidate-comparison-1440.png`
  - Viewport: 1440 × 1000
  - Full-page dimensions: 1440 × 3301
  - SHA-256: `44c08fceffa3aa4f711270a1b3bc0df1815789ba0ff20e4e4a5d05c727d9f772`
- Mobile screenshot: `artifacts/commercial-ui/issue-1429-candidate-comparison/candidate-comparison-320.png`
  - Viewport: 320 × 900
  - Full-page dimensions: 320 × 7798
  - SHA-256: `17f947e082bedd181e4ade3ad23fcab5d49bab7a6b9828c3512a8b5cf6a2c30e`
- The capture fails closed when HEAD changes, any worktree path outside the three declared evidence outputs is dirty or untracked, Playwright fails, a screenshot is missing, or the PNG width does not match its declared viewport.
- The manifest records source hashes, generator hash, screenshot hashes, authentication mode, projection-fixture boundary, keyboard focus, pair coverage, stale-response rejection, and horizontal-overflow assertions.

## Verified behavior

- Desktop at 1440 × 1000 and mobile at 320 × 900 render the authenticated candidate-batch comparison workspace without page-level horizontal overflow.
- The batch summary exposes all three candidates, including rhythm, readiness-state distribution, terminal validation, and the explicit no-difference marker for equal facts.
- A-B, A-C, and B-C are all selectable; B-A restores the same normalized A-B result identity.
- The confirmation control works by keyboard Enter.
- A delayed A-B response cannot replace the newly selected A-C state.
- Confirmed URL state contains batch, path version, and normalized pair identity.
- The comparison flow remains read-only; no path adoption or execution action is invoked by the browser test.
