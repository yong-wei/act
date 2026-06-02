## Framework Migration Notes

Next 16 introduces or emphasizes:

- Turbopack default behavior and top-level `turbopack` config.
- Middleware-to-proxy naming and type changes when middleware exists.
- Continued support for React 18.2+ and React 19 peer ranges.
- Playwright peer requirement of at least `^1.51.1`.
- Potential generated type and route behavior changes.

## Repository-Specific Checks

The repository currently has:

- `next.config.js` with `output: 'standalone'`.
- App Router routes under `src/app`.
- No root `middleware.ts` detected in the current worktree.
- Docker standalone output copied into the runner image.

## Browser Route Set

Minimum browser validation should include:

- `/`
- `/login?callbackUrl=%2Fdata-center`
- `/data-center`
- `/interactive-learning`
- `/interactive-learning/courses`
- `/teacher`
- `/admin`
- `/simulations`

Authenticated routes may require seeded/local test accounts.
