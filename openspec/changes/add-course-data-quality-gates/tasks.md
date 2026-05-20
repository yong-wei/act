## 1. Static Gates

- [ ] 1.1 Add an inventory of response-producing manifest pages, including 5-2 and later lessons.
- [ ] 1.2 Add a guard that fails when a response-producing page bypasses the shared submission path.
- [ ] 1.3 Add tests for the guard using a migrated and a deliberately invalid fixture.

## 2. Data-Quality Report

- [ ] 2.1 Add a session data-quality report command.
- [ ] 2.2 Include answer availability, score availability, question summary availability, evidence quality, report freshness, snapshot freshness, and sync incident quality.
- [ ] 2.3 Support session id and lesson/date filters.

## 3. Skill and Acceptance Updates

- [ ] 3.1 Update the interactive lesson implementation skill with the shared submission evidence requirement.
- [ ] 3.2 Add acceptance language for evidence-rich submissions and classified sync incidents.
- [ ] 3.3 Reference the report command as the post-class verification path.

## 4. Verification

- [ ] 4.1 Run the static guard tests.
- [ ] 4.2 Run the data-quality report dry-run.
- [ ] 4.3 Run `npm run lint`.
