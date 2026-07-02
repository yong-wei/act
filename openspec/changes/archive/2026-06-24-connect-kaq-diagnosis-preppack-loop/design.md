## Loop

```text
Class overlay + evidence writeback
        -> graph-node diagnosis
        -> resource coverage gap
        -> prep-pack draft candidates
        -> teacher review/activation
        -> post-class evidence
        -> overlay refresh
```

## Diagnosis Input

Graph-aware diagnosis should consume:

- LearningGoal or graph node scope;
- class overlay distributions and suppression metadata;
- learner overlay summaries where authorized;
- resource coverage and missing coverage types;
- verified citations and evidence refs;
- version refs and stale limitations.

## Prep-Pack Output

Prep-pack candidate interventions should include:

- target graph node ids and LearningGoal ids;
- affected population or suppressed denominator metadata;
- source diagnosis and evidence refs;
- resource gap or existing ResourceNode refs;
- suggested intervention type and insertion target;
- expected impact and confidence;
- teacher review state.

## Review Boundary

Generated prep-pack candidates remain draft. Activation remains teacher-controlled, class/session scoped, reversible, auditable, and non-mutating to base runtime content.

## Boundaries

This change connects the loop and payloads. It does not implement resource ranking, graph editing, or automatic publication.
