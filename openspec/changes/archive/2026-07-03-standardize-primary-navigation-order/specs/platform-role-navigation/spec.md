## MODIFIED Requirements

### Requirement: Role navigation is centrally defined
The system SHALL define role-specific navigation entries through a central schema rather than page-local header lists.

#### Scenario: Student navigation is rendered
- **WHEN** a student page renders primary navigation
- **THEN** it SHALL expose the configured student entries in the canonical first-level order: 首页, 知识资源, 互动学习, 学习路径, 竞技场, 虚拟仿真, 控制工作台, 个人中心.
- **AND** the collapsed desktop rail MAY show icons only, but the expanded rail, accessible names, focus order, and active state SHALL preserve the same order and labels.
- **AND** 个人中心 SHALL be treated as account and learner-record reachability rather than a core learning product module.
- **AND** Data Center SHALL NOT be visible as a student core, review, or fallback navigation destination.

### Requirement: Homepage and student cockpit expose complete core entries
The system SHALL migrate homepage and student cockpit entry surfaces to the unified role-navigation model with a complete core student entry matrix.

#### Scenario: Student opens homepage or dashboard
- **WHEN** a student-visible homepage, `/dashboard`, or cockpit entry surface renders
- **THEN** it SHALL expose student product entries in the canonical relative order: 知识资源, 互动学习, 学习路径, 竞技场, 虚拟仿真, 控制工作台
- **AND** personal center access SHALL be exposed through account/profile action semantics rather than as a duplicate homepage center link.
- **AND** mobile layouts at 320px SHALL provide drawer or menu access to the same visible entries without dead links.
- **AND** the Interactive Learning entry SHALL target `/interactive-learning`.

### Requirement: Navigation coverage is testable
The system SHALL provide tests or script checks that verify central navigation coverage for commercial student intent groups, core destinations, account/profile semantics, and route aliases.

#### Scenario: Navigation schema changes
- **WHEN** the central navigation schema is changed
- **THEN** tests SHALL verify that learn, practice, challenge, experiment, review, and account/profile intents remain represented where required
- **AND** Interactive Learning, Arena, Control Workbench, adaptive learning, knowledge/resource workspace, simulations, and profile/cockpit access remain reachable according to route configuration.
- **AND** homepage center links, AppShell collapsed rail, AppShell expanded rail, and account/profile entrypoints SHALL not diverge from the canonical first-level order.
