## Overview

Konling should interpret a user question as a teaching task. It should identify relevant knowledge nodes, capability target level, learner state, page/path context, and resource citation candidates before generating high-confidence answers.

## Answer Types

- Fact explanation: primarily cites teaching knowledge.
- Personalized diagnosis: cites learner evidence and diagnosis snapshots.
- Path advice: cites capability targets, resource attributes, selected path context, and learner evidence.
- Grading explanation: cites rubric, submitted work, teacher-approved grading state, and source material.
- Media guidance: cites video, audio, image, or interactive step addresses.

## Guardrails

Generated text is not a mastery fact. Any learner-state or path mutation must flow through existing governed tools, approval workflows, or materialized evidence summaries.

## Risks

- If citations are optional, answers will look confident without evidence.
- If client hints expand scope, Konling can leak resource or learner data.
