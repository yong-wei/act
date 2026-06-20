## Overview

The K/A/Q graph schema should be a typed catalog layer. It must be able to wrap existing runtime knowledge graph data while introducing capability and quality domains that are not currently represented by `KnowledgeNode`.

## Graph Body

All graph nodes share id, domain, title, description, objective ids, course module, portrait dimensions, and status. All graph edges share id, domain, source, target, relation, strength, and rationale.

Knowledge nodes represent stable course facts and methods. Capability nodes represent observable performance expectations over one or more knowledge nodes. Quality nodes represent engineering responsibility, evidence integrity, model-boundary awareness, AI-use responsibility, and mission-oriented dispositions.

## Overlay Boundary

Graph body data must not include learner score, class distribution, or resource coverage status. Those belong to separate overlay payloads keyed by graph node id and domain.

## Validation

Validation should reject orphan edges, objective ids that are unknown to the objective taxonomy, invalid portrait dimensions, capability nodes without knowledge-node binding, and quality nodes without observable behavior or rubric levels.

## Data Source Strategy

Initial implementation should use TypeScript catalog/seed data plus adapters for existing runtime knowledge graph data. Prisma tables can be considered later, after the schema and graph-center surface stabilize.
