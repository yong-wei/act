## Design

Consumer integration should use the Source Pack builder as an internal service boundary. Each consumer supplies profile, role, query, graph/objective context, and output budget. Consumers receive a pack plus limitations and decide how to display, store, or pass it to model prompts.

## Lesson And Homework

Lesson and homework skills should request source packs through the CLI or a local script. The default output for agents should be compact Markdown plus a JSON audit file. For durable authoring work, selected packs may be archived near the lesson or assignment authoring artifacts.

## Konling

Konling should build a `konling-answer` Source Pack from the user question and current page/graph context, then use verified Source Pack citations as candidate evidence. Missing learner state may limit personalization, but it must not block content-grounded cited answers when teaching-content citations are available.

## Path Planning

Path planning should use a `path-planning` Source Pack to explain and audit resource evidence against LearningGoal, knowledge, and capability targets. Actual path nodes still come from audited ResourceNode/PlanningUnit candidates.
