## Overview

The first step is audit visibility, not broad editing. The management surface should show whether each ResourceNode or semantic resource has the required knowledge, capability, citation, and evidence metadata for path planning and assistant grounding.

## Audit Fields

- Knowledge coverage present.
- Capability target mapping present.
- Citation target readiness.
- Evidence instrumentation configured.
- Path eligibility and exclusion reasons.
- Source-of-record ownership and governance warnings.

## Policy

Resources with missing required mapping or evidence capability should be excluded from high-confidence path planning unless an explicit policy allows fallback use. Teacher/admin diagnostics may still show the missing fields.

## Risks

- Opening broad editing too early could conflict with source-of-record ownership.
- Hiding missing mapping states would allow low-quality resources to appear in personalized paths.
