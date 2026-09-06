## MODIFIED Requirements

### Requirement: Domain concept labels are readable before selection
The bounded domain overview SHALL present governed names of ordinary DomainConcept nodes without requiring selection or hover. Visible canvas labels SHALL remain on after camera fit, up to an explicit maximum count that prefers labels nearest the viewport center after selected and hovered nodes. Collision MAY defer labels beyond that budget while preserving accessible names. Ordinary labels SHALL NOT be hidden solely because projected font size falls below a zoom threshold. 当权威名称超出画布标签预算（多行换行仍不可读的定义句）时，画布标签 SHALL 在子句或词边界截断并以省略号收尾；截断只影响画布绘制，hover 预览、详情抽屉、可浏览目录与无障碍名称 SHALL 保留完整名称。

#### Scenario: Domain overview becomes usable
- **WHEN** the force layout reaches its accepted settlement milestone
- **THEN** labels nearest the viewport center SHALL be visible up to the configured maximum
- **AND** ordinary labels SHALL not be reduced to selected-only or hovered-only presentation

#### Scenario: Far camera still shows labels
- **WHEN** the viewer zooms out below the previous readable-font threshold
- **THEN** the center-priority budget SHALL still paint labels
- **AND** hover SHALL NOT trigger a camera fit to keep those labels readable

#### Scenario: Mobile large-domain overview stays identifiable
- **WHEN** a bounded overview larger than the compact threshold is fitted on a mobile viewport
- **THEN** the browsable node directory SHALL remain the selection-independent readable-name channel
- **AND** a selected concept's canvas label SHALL stay visible through the viewport clamp fallback

#### Scenario: Density prevents one label
- **WHEN** one label cannot fit after force separation, camera fitting and the maximum visible count
- **THEN** the policy MAY defer that label while preserving its accessible name
- **AND** the evidence SHALL record the deferred count against the accepted budget

#### Scenario: Overlong authoritative name is truncated on canvas
- **WHEN** a governed node name exceeds the canvas label budget
- **THEN** the canvas label SHALL be truncated at a clause or word boundary with a terminal ellipsis within the configured line count
- **AND** the hover preview, node drawer, browsable directory and accessible name SHALL present the complete untruncated name

## ADDED Requirements

### Requirement: Domain entry presents a settled first frame
进入领域视图时，画布 SHALL 在数据就绪且布局达到接受沉降里程碑后再呈现首个可见帧；加载期间 SHALL 显示有界加载占位。中间扩张阶段 MUST NOT 以可见的部分节点集合、中间相机缩放或未完成布局呈现给用户。

#### Scenario: Entering a domain shows the final layout once
- **WHEN** the user enters a domain from the root overview
- **THEN** the canvas SHALL present a loading state until the bounded domain payload is ready and the layout has reached its settlement milestone
- **AND** the first visible frame SHALL already show the final settled arrangement without subsequent visible re-layout or camera re-fit

#### Scenario: Settlement evidence stays observable
- **WHEN** the settled first frame is presented
- **THEN** the settled-layout milestone SHALL remain the single source that unlocks label placement and camera fit
- **AND** reduced-motion or static-layout environments SHALL treat layout computation completion as the settlement milestone
