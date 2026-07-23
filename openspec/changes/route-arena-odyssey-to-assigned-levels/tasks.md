## 1. Assignment Contract

- [x] 1.1 Add a pure Arena task-to-Odyssey-level assignment module with bidirectional lookup helpers.
- [x] 1.2 Route configured Control Odyssey Arena tasks with their assigned `odysseyLevelId` while preserving existing context parameters.
- [x] 1.3 Preserve bridge API compatibility by consuming the shared assignment mapping from the submission bridge.

## 2. Controlled Client Session

- [x] 2.1 Add client coverage that proves an Arena task bypasses the introductory and level-selection views for its assigned level.
- [x] 2.2 Make a valid Arena assignment open directly in the designated level configuration and prevent level-selection, next-level, and ordinary return-to-menu navigation.
- [x] 2.3 Keep ordinary Control Odyssey free-play initialization and navigation unchanged.

## 3. Progression Isolation

- [x] 3.1 Add a server action regression test proving a valid Arena-assigned run does not mutate ordinary Odyssey progression.
- [x] 3.2 Skip ordinary credits, tier progress, and controller-unlock mutations only for a persisted valid assignment pair while retaining official Arena bridging.
- [x] 3.3 Preserve mismatched-task rejection, normal free-play rewards, durable replay behavior, and publication access validation.

## 4. Verification and Delivery

- [x] 4.1 Run focused Arena routing, assignment, Control Odyssey client, and score-action tests.
- [ ] 4.2 Run TypeScript checking and strict OpenSpec validation; inspect the final diff for accidental scope expansion.
- [ ] 4.3 Create the Arena GitHub Issue and a pull request to `integration`, request Codex review in Chinese, and do not merge the pull request.
