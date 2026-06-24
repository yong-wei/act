## Overview

Learner and class overlays translate governed evidence into graph-node state. The graph body answers what exists in the curriculum; overlays answer how a learner or class is doing relative to those nodes.

## Learner Overlay

Learner node states are:

- `mastered`
- `developing`
- `weak`
- `not-started`
- `locked`
- `evidence-needed`

Each overlay item includes score or null, confidence, evidence count, last evidence time, evidence refs, recommendation, reason code, evidence window, source coverage, verified citation refs, and limitations. Missing or low-confidence evidence must be visible.

Recommendation is not a free-text hint. It must be derived from server-owned learner state, graph target, resource coverage, path context, and verified citations where required. It must distinguish target requirements from observed mastery and must expose source coverage and confidence.

## Class Overlay

Class overlay aggregates learner states into distributions. It includes mastered, developing, weak, not-started, and evidence-needed counts, average score, confidence, common issue codes, denominator, included population, excluded population, suppression reason, and rounding policy. Teachers can only read classes they are authorized to inspect; administrators can read governed aggregate views.

Small samples and low denominators must be suppressed, bucketed, or marked unavailable. A graph-node heat entry must not let a teacher infer a single student's hidden state from a one-student distribution after filtering.

## Privacy

Student view can read only the owner's overlay. Teacher view can read class-scoped overlays after class membership and teacher ownership are verified. Overlay payloads must not include raw answers, raw Konling memory, hidden Arena internals, or private evidence text.

Class overlay privacy protection is not satisfied by authorization alone. The payload must include enough denominator metadata for the UI and tests to prove that low-sample states were suppressed or rounded.

## UI

Graph center should support learner and class-heatmap modes. Empty state must be explicit when no learner or class context exists.
