## Tasks

- [x] 1. Define the completeness audit contract.
  - Specify layer names, severity levels, stable IDs, thresholds, privacy rules, and JSON/Markdown output shapes.

- [x] 2. Implement the read-only helper.
  - Add a script that reads Prisma, runtime governance artifacts, ResourceNode registry, graph-center coverage sources, source-event lineage, and learner fixture readiness without mutating records.

- [x] 3. Add Yang Fan canonical-account diagnostics.
  - Report the canonical account, duplicate accounts, missing learner evidence sources, and whether fixture generation is blocked by resource-data incompleteness.

- [x] 4. Add tests or snapshot fixtures for helper output.
  - Cover complete, partial, blocked, lineage-broken, duplicate-account, PII-redacted, and no-fixture-account cases with deterministic output.

- [x] 5. Document usage and validation.
  - Document command examples, output interpretation, and how agents should use the helper during staged data completion.

- [x] 6. Validate the change.
  - Run `rtk openspec validate add-data-completeness-audit-helper --strict`.
  - Run the targeted helper test command.
  - Run relevant data-governance evidence coverage checks.
