## Context

Teacher evidence governance already protects class scope and raw evidence boundaries. The report's target metrics are path adoption, completion, competency lift, simulation and Arena transfer, Konling intervention outcomes, citation coverage, and resource contribution. This change defines the report and export contract.

## Goals / Non-Goals

**Goals:**

- Expose cohort-level metrics for control-correction path effectiveness.
- Provide authorized student drilldown with traceable but privacy-safe evidence.
- Export report data and visual summaries for review and demo packages.
- Include methodology and confidence metadata for each metric.

**Non-Goals:**

- Replacing existing class insights.
- Creating a new experiment engine.
- Exposing raw answer bodies, private Konling memory, hidden Arena internals, or raw traces.

## Decisions

### Decision 1: Report metrics use governed features

The report should read path features, learner-state snapshots, feature-cache summaries, and governed simulation/Arena evidence instead of scanning raw tables directly.

### Decision 2: Metrics include confidence and denominator

Every report metric must expose denominator, included population, excluded population or reason, confidence state, and calculation window.

### Decision 3: Drilldown is scoped

Student drilldown may show evidence summaries and references only for students within the teacher's authorized class scope.

## Validation

- API tests SHALL verify class scope, metric denominators, export output, and redaction.
- Report tests SHALL cover missing, stale, and low-confidence evidence.
- `rtk openspec validate publish-control-correction-teacher-report --strict` SHALL pass.
