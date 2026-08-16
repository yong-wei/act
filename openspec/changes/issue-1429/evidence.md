# Browser verification evidence

Date: 2026-08-17

## Environment

- Branch: `issue-1429`
- Application: `http://127.0.0.1:3002`
- Authentication: real NextAuth credentials callback using the seeded `demo` student account; the browser session was not replaced by an `/api/auth/session` route stub.
- Database: temporary local PGlite PostgreSQL-compatible instance with the current Prisma schema and demo student profile.
- Candidate facts: deterministic browser route fixtures for the three-candidate batch; server identity and authorization behavior is covered separately by the route and runtime tests.

## Command

```powershell
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:3002'
$env:PLAYWRIGHT_SKIP_WEB_SERVER='1'
npx playwright test tests/adaptive-path-candidate-comparison-1429.spec.ts --reporter=line
```

Result: 2 tests passed.

## Auditable visual capture

- Capture source revision: `eee4eff112519f70ac2df3289f2ceb96693f7c88`
- Capture command: `node artifacts/commercial-ui/issue-1429-candidate-comparison/capture-evidence.mjs`
- Manifest: `artifacts/commercial-ui/issue-1429-candidate-comparison/evidence-manifest.json`
- Desktop screenshot: `artifacts/commercial-ui/issue-1429-candidate-comparison/candidate-comparison-1440.png`
  - Viewport: 1440 × 1000
  - Full-page dimensions: 1440 × 3229
  - SHA-256: `f8a7459ac41ef08375c63930797012e8170d1691db4c6fb585a51451c43e3d07`
- Mobile screenshot: `artifacts/commercial-ui/issue-1429-candidate-comparison/candidate-comparison-320.png`
  - Viewport: 320 × 900
  - Full-page dimensions: 320 × 7402
  - SHA-256: `04777a8dced7804d7e0b155cf6ac83488ee7990ebae9297586d74f3189ff9369`
- The capture fails closed when HEAD changes, bound source files are dirty, Playwright fails, a screenshot is missing, or the PNG width does not match its declared viewport.
- The manifest records source hashes, generator hash, screenshot hashes, authentication mode, projection-fixture boundary, keyboard focus, pair coverage, stale-response rejection, and horizontal-overflow assertions.

## Verified behavior

- Desktop at 1440 × 1000 and mobile at 320 × 900 render the authenticated candidate-batch comparison workspace without page-level horizontal overflow.
- The batch summary exposes all three candidates, the terminal-validation dimension, and the explicit no-difference marker for equal facts.
- A-B, A-C, and B-C are all selectable; B-A restores the same normalized A-B result identity.
- The confirmation control works by keyboard Enter.
- A delayed A-B response cannot replace the newly selected A-C state.
- Confirmed URL state contains batch, path version, and normalized pair identity.
- The comparison flow remains read-only; no path adoption or execution action is invoked by the browser test.
