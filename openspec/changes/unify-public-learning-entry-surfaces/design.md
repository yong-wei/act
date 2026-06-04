## Context

The first-viewport review showed the homepage has some brand tone, but login is disconnected, Interactive Learning and course catalog are card-heavy, and simulation hub underuses its high-quality 3D ship imagery as a product system.

## Goals / Non-Goals

**Goals:**

- Bring public entry, login, learning entry, course catalog, and simulation hub into the same route frame and brand system.
- Organize student destinations by learning intent rather than module implementation names.
- Preserve callback URLs, role redirects, and authenticated/unauthenticated states.

**Non-Goals:**

- Rebuilding course runtime internals.
- Replacing simulation physics or resource registry behavior.
- Implementing future recommendation logic.

## Decisions

### Decision 1: Entry pages use learning-map hierarchy

Interactive Learning, course catalog, and simulation hub should reveal progression, modules, and scenario intent instead of only equal cards.

### Decision 2: Login is an entry surface

Login must carry route destination intent, role semantics, brand identity, and error/loading states. It should not be a visually separate technical form.

### Decision 3: Simulation hub uses visual assets as primary information

Ship imagery should carry scenario identity, with difficulty, course fit, task status, and launch actions layered consistently.

## Validation

- `rtk openspec validate unify-public-learning-entry-surfaces --strict`
- Visual QA for `/`, `/login`, `/interactive-learning`, `/interactive-learning/courses`, one course detail route, and `/simulations` in light and dark themes.
- Authentication callback checks for `/login?callbackUrl=%2Fprofile`.
