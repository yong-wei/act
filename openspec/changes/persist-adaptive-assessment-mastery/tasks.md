## 1. Persistence

- [ ] 1.1 Add Prisma models or migrations for assessment sessions, answers, item references, ability estimates, mastery updates, and algorithm versions.
- [ ] 1.2 Update assessment submission handling to write durable records.
- [ ] 1.3 Preserve existing assessment API response compatibility.

## 2. Mastery and Evidence

- [ ] 2.1 Implement assessment-backed BKT-compatible mastery updates.
- [ ] 2.2 Emit governed LearningFacts with privacy-safe references and derived scores.
- [ ] 2.3 Add confidence rules that keep non-assessment evidence below high-confidence mastery unless calibrated.

## 3. Validation

- [ ] 3.1 Add tests for restart survival, reproducible ability/mastery updates, privacy-safe payloads, and LearningFact materialization.
- [ ] 3.2 Validate with `rtk proxy openspec validate persist-adaptive-assessment-mastery --strict`.
