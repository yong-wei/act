## MODIFIED Requirements

### Requirement: Disposition action buttons carry distinct visual hierarchy

教师处置操作按钮 SHALL 呈现为明确的按钮，而不是无边框、无背景的文字链接。每个按钮的默认态 SHALL 同时具有清晰可见的边框和非透明背景。「待处理」SHALL 使用醒目警示色边框与实色/浅实色背景，「已完成处置」SHALL 使用成功色边框与背景，「已查看」SHALL 使用清晰的中性实色按钮，「进入备课工作台」SHALL 使用明确的主色导航按钮。主要结论卡片内的处置按钮与页面底部「报告处置」按钮 SHALL 使用同一套视觉语义。按钮 SHALL 具备足够的高度、水平内边距和间距，并覆盖 hover、active、focus-visible、disabled 与记录中状态。当前已记录的处置状态除文字说明外，SHALL 在对应按钮上提供非颜色单一依赖的选中提示（例如图标、实心态或 `aria-pressed`）。浅色与夜间主题下轮廓与文字对比度 SHALL 保持可辨，且不得被全局 ghost 样式抵消。打印输出 SHALL NOT 包含处置控件。视觉验收 SHALL 包含浏览器 computed style 断言（非透明背景、可见边框、可见焦点）以及浅色主题截图；仅 className 断言不足以证明通过。

#### Scenario: Teacher scans disposition controls

- **WHEN** an authorized teacher opens the teacher delivery version
- **THEN** each disposition control SHALL render as a button with a visible border and a non-transparent background
- **AND** pending, completed, viewed, and preparation actions SHALL be distinguishable by tone, label, and (when recorded) a non-color-only pressed state
- **AND** each control SHALL expose visible hover, keyboard-focus, disabled, and recording states without losing its action semantics.

#### Scenario: Browser computed style confirms button chrome

- **WHEN** the teacher delivery page is opened in a real browser
- **THEN** the computed style of each disposition control SHALL show a non-transparent background, a visible border, and a visible focus ring when focused
- **AND** a light-theme screenshot of the disposition controls SHALL be retained as acceptance evidence.

#### Scenario: Printing keeps excluding disposition controls

- **WHEN** the teacher prints the report deliverable
- **THEN** the print output SHALL NOT contain disposition buttons or delivery action links.
