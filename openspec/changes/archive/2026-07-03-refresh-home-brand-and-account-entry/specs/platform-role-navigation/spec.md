## ADDED Requirements

### Requirement: Homepage account action uses personal-center semantics
The homepage SHALL expose product module links separately from account or learner-record access.

#### Scenario: Homepage navigation renders
- **WHEN** the homepage topbar renders for a guest or authenticated user
- **THEN** the center navigation SHALL include only 知识资源, 互动学习, 学习路径, 竞技场, 虚拟仿真, and 控制工作台 in canonical order
- **AND** the right side SHALL expose 个人中心 and theme switching using shared account/action semantics
- **AND** it SHALL NOT render “进入驾驶舱” as a separate primary action.
