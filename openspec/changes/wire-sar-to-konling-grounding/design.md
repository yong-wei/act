## Design

Konling should use SAR after it has server-owned page, graph, resource, path, learner, and citation context. SAR receives seed refs from `KonlingKnowledgeCapabilityContext` and returns associated event/entity refs plus trace. Konling may then request a Source Pack using those candidate refs to obtain verified evidence and citation metadata.

## Tool Scope

Allowed modes include diagnosis explainer, path advisor, resource coach, grading assistant, feedback explainer, class summarizer, and prep coauthor according to existing role and privacy rules. Generic chat may receive only limited public/course context unless mode authorization supplies richer scope.

## Output

Assistant metadata may include:

- SAR seed entity ids.
- Associated event ids.
- Candidate refs sent to Source Pack.
- Trace summary.
- Limitations.

Student-visible output must not expose teacher-scoped diagnostic internals, raw private evidence, or audit-only trace details.
