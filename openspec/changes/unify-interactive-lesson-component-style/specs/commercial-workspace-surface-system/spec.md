## ADDED Requirements

### Requirement: Interactive lesson courseware components share one visible panel exterior
Manifest-first interactive lesson runtime courseware components SHALL use the same visible exterior as the page title module.

#### Scenario: Courseware module renders with the title-panel exterior
- **WHEN** a manifest-first interactive lesson renders a page title, content module, visual module, activity module, compute panel, or analytics summary as a courseware component
- **THEN** the visible outer surface SHALL use the shared title-panel exterior
- **AND** the component SHALL NOT expose a second visible `commercial-module-chrome` shell, local card shell, or course-private wrapper outside that exterior.

#### Scenario: Module chrome remains metadata-only
- **WHEN** a standard manifest module is wrapped by `commercial-module-chrome`
- **THEN** the wrapper MAY keep standard data attributes, control-scope metadata, geometry markers, and governance markers
- **AND** it SHALL NOT create a visible panel shape when the renderer already provides the courseware panel exterior.

#### Scenario: Manifest-first module inventory proves coverage
- **WHEN** the courseware shell contract is implemented or changed
- **THEN** the runtime SHALL produce or test an inventory of manifest-first courseware module families covered by the shared exterior
- **AND** legacy non-manifest private course pages SHALL be listed as migration exceptions rather than counted as coverage.

### Requirement: Interactive lesson courseware spacing is layout-owned
Manifest-first interactive lesson runtime pages SHALL define vertical spacing between courseware components in the shared runtime layout rather than in individual pages, manifests, lesson adapters, or module renderers.

#### Scenario: A page contains multiple modules
- **WHEN** a manifest-first interactive lesson page renders two or more courseware components
- **THEN** the vertical spacing between sibling components SHALL be supplied by the shared lesson runtime layout
- **AND** individual page files, course-specific step panels, and module renderers SHALL NOT use page-local `mt-*`, `mb-*`, `space-y-*`, or ad hoc wrapper gaps to alter sibling component spacing.

#### Scenario: Component needs internal spacing
- **WHEN** a component contains title, body, controls, media, graph, table, or activity content inside its panel
- **THEN** internal spacing SHALL use shared courseware panel body, section, toolbar, and content spacing primitives
- **AND** that internal spacing SHALL NOT change the gap between this component and its sibling components.

### Requirement: Interactive lesson courseware typography follows semantic heading levels
Manifest-first interactive lesson runtime typography SHALL be derived from courseware semantic hierarchy rather than renderer-local text-size choices.

#### Scenario: Page and module titles render
- **WHEN** a manifest-first interactive lesson page renders its page title and module titles
- **THEN** the page title SHALL render as level 1 courseware typography and semantic heading level 1
- **AND** each top-level module title SHALL render as level 2 courseware typography and semantic heading level 2
- **AND** each in-module subsection title SHALL render as level 3 courseware typography and semantic heading level 3.

#### Scenario: Heading scale is ordered
- **WHEN** level 1, level 2, and level 3 courseware titles appear on the same page
- **THEN** level 2 and level 3 titles SHALL be visually larger than the former compact module-title treatment
- **AND** level 2 SHALL NOT exceed level 1
- **AND** level 3 SHALL NOT exceed level 2.

#### Scenario: Body copy renders
- **WHEN** a courseware component renders explanatory text, question text, figure notes, table notes, derivation text, card bodies, or activity prompts
- **THEN** the body copy SHALL use the shared courseware body typography
- **AND** the shared body typography SHALL match the current PPT-style derivation component body size token, equivalent to `text-base leading-7 md:text-lg md:leading-8`
- **AND** the renderer SHALL NOT choose page-local body font sizes.

#### Scenario: Compact text uses named exceptions
- **WHEN** a courseware component renders captions, toolbar controls, tabs, buttons, labels, or math glyphs
- **THEN** compact text SHALL use registered caption/control primitives or math-renderer sizing
- **AND** compact exceptions SHALL NOT be used for ordinary explanatory text, activity prompts, figure notes, or card body copy.
