# Data Completeness Audit Helper

The data completeness audit helper reports whether graph, resource, citation, path-planning, evidence-lineage, and learner-fixture data are ready for governed flows. It is read-only: it only queries Prisma records and runtime resource artifacts, then prints JSON or Markdown.

## Commands

```bash
rtk npm run db:data-completeness-audit -- --format json
rtk npm run db:data-completeness-audit -- --format markdown
rtk npm run db:data-completeness-audit -- --canonical-student-number 20230010102605
```

JSON is the automation contract. Markdown is for human review during staged data completion.

## Output

The report keeps readiness dimensions separate:

- `graphCore`: active knowledge nodes, descriptions, tags, graph edges, and resource references.
- `resourceBinding`: TeachingResource bindings and ResourceNode path eligibility.
- `citationReadiness`: citation targets, retrieval chunks, and corpus citation addresses.
- `pathReadiness`: audited PlanningUnits and high-confidence path eligibility.
- `evidenceLineage`: source event ids, client event ids, EventDictionary mapping, batch processing, and LearningFact attribution.
- `learnerFixtureReadiness`: canonical Yang Fan diagnostics, duplicate candidates, LearningFact coverage, KnowledgeProgress coverage, path evidence refs, snapshots, profile summary, and StudentEvidenceFeatureCache coverage.

Findings use stable refs and one of three severities:

- `blocked`: prevents path planning, high-confidence citation, or fixture generation.
- `partial`: usable only with limitations.
- `advisory`: should be improved but does not block the targeted flow.

## Privacy

Default output is privacy-minimized. The helper hashes user ids, emails, names, and student numbers with a short SHA-256 digest, and it does not print raw answers, raw event payloads, raw resources, or private memory payloads.
