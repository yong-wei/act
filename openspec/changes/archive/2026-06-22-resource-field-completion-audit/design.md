## Overview

This change creates the audit foundation for resource remediation. The output is a stable inventory that says which resources can already become PlanningUnits, which resources can only be retrieved or cited, and which resources are blocked by missing fields.

## Inventory Scope

The audit must include at least:

- registered resource metadata;
- runtime interactive lesson steps and modules;
- runtime lesson media and handouts;
- runtime knowledge cards;
- runtime knowledge infographs;
- authoring textbook chapters, sections, figures, and captions;
- adaptive quiz and generated-question sources;
- simulation, Arena, control workbench, reflection, checkpoint, Konling, and external resource records where present.

## Field Groups

The audit groups fields by purpose:

- identity and provenance: stable id, source kind, source ref, source path or URL, content hash, version ref;
- graph binding: LearningGoal ids, K/A/Q objective ids, knowledge node ids, capability target ids, quality target ids;
- path profile: target, path role, estimated time, cognitive load, effort, prerequisites, terminal constraints;
- evidence: evidence instrumentation, completion criteria, outcome refs, mastery effect policy;
- evidence contract: event source, event type, client event id policy, attempt key, source log id, dedupe key, started/submitted/completed timestamps, LearningFact materialization policy, confidence policy, and privacy scope;
- readiness: competency thresholds, evidence count, required completed nodes, required outcomes, fallback nodes;
- grounding: segment refs, citation targets, citation readiness, AI-use permission, scene availability;
- review state: generated, local-model-assisted, externally-derived, human-confirmed, blocked, stale.

## Completion Method Policy

Manual completion is required for textbook sections, LearningGoal bindings, capability targets, readiness thresholds, and mastery-affecting quiz mappings.

Local model or external-tool output may create suggested metadata for knowledge card summaries, infograph summaries, image descriptions, transcript segmentation, and unbound image semantics. These suggestions remain provisional until reviewed.

Generated-provisional fields may improve search and authoring triage, but they must not make a resource path-eligible or mastery-affecting.

Human confirmation must be auditable. A confirmed field set records reviewer id, reviewer role, reviewed time, review batch id, reviewed source hash, reviewed version ref, generation tool or model where applicable, prompt or manifest hash where applicable, confidence, and stale invalidation rules.

## Output Contract

The audit output must include one row per resource or segment candidate with:

- resource id and resource type;
- source path or source record;
- missing field codes;
- completion method;
- review status;
- review audit fields;
- evidence contract completeness;
- path eligibility after completion;
- grounding eligibility after completion;
- coverage denominator and source window where the row contributes to graph coverage;
- blocking dependency, if another change must run first.

The first implementation is audit-only. It should write JSON/JSONL diagnostics and must not modify underlying resource truth or mark resources as complete.

## Artifact Paths

The implementation SHALL write reviewed diagnostics under `course-content/runtime/resource-governance/`:

- `resource-field-completion-audit.jsonl` for row-level missing-field evidence;
- `resource-field-completion-summary.json` for resource-family counts, denominator, source window, artifact version, limitation categories, and role-safe summary fields.

These files are implementation artifacts for verification and downstream completion changes, not source-of-record authoring data.

## Validation

The audit is successful when it can explain why currently registered resources are mostly PlanningUnit-ready while large runtime and authoring resource sets remain blocked or retrieval-only.
