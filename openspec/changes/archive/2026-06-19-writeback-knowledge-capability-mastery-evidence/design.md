## Overview

Evidence writeback should update explainable mastery state only from governed sources. Raw events and assistant text must be transformed into evidence atoms or materialized summaries before they influence high-value learner state.

## Accepted Evidence Sources

- Path execution and completion records.
- Exercises and quizzes with mapped knowledge/capability targets.
- Teacher-approved grading outcomes.
- Simulation and Arena validation summaries.
- Interactive lesson evidence.
- AgentToolRun records, approved intervention outcomes, or materialized evidence summaries.

## Mastery State

Each knowledge/capability mastery state should expose supporting evidence refs, confidence, freshness, source coverage, and limitations. Missing, stale, partial, preview-only, or low-confidence evidence must remain visible.

## Risks

- Directly using raw chat would contaminate mastery state.
- Treating context-only activity as mastery evidence would overstate learning.
- Ignoring active path execution changes would create conflicting completion semantics.
