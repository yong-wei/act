## ADDED Requirements
### Requirement: Runtime media and handouts declare reviewed dispositions
Runtime media, slides, audio, video, PDF, and handout resources SHALL declare reviewed path-planning dispositions before they can affect path generation.

#### Scenario: Media is citation support
- **WHEN** a media or handout resource is used only to support explanation or citation
- **THEN** it SHALL declare supporting-citation or embedded-asset disposition, parent PlanningUnit where available, anchor or transcript requirements, source version, and limitation state.

#### Scenario: Media is path-plannable
- **WHEN** a media or handout resource is promoted to path-plannable
- **THEN** it SHALL include verified launch target, graph binding, LearningGoal fit, estimated time, evidence behavior, privacy policy, route/access semantics, and review metadata.
