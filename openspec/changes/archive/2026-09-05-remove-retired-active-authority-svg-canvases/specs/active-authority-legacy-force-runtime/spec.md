## ADDED Requirements

### Requirement: Retired Active SVG implementations are removed

系统 SHALL 删除已无生产调用的 `active-authority-force-canvas.tsx`、`active-authority-root-canvas.tsx` 及其孤立颜色和几何辅助函数。Active 与 Legacy SHALL 继续使用现有共享 Force Graph 运行时及各自独立的数据和状态。

#### Scenario: An old canvas remains referenced by tests or evidence

- **WHEN** 旧画布只被其专属测试或 QA 文件列表引用
- **THEN** 旧画布及失效测试 SHALL 一起删除，当前 QA 引用 SHALL 改为实际运行时
- **AND** 系统 SHALL NOT 为满足旧测试而保留转发组件或旧几何函数

#### Scenario: Current graph behavior is exercised

- **WHEN** 用户在当前图谱切换 2D/3D、筛选、选择节点并打开或关闭详情
- **THEN** 关系语义、选择状态、焦点恢复及 force 生命周期 SHALL 保持现有行为
- **AND** Legacy 模式及其共享实现 SHALL 保留

### Requirement: Current QA follows current rendering code

当前图谱 QA SHALL 检查实际参与渲染的共享运行时。受影响的当前证据 SHALL 通过现有捕获流程更新，历史归档 SHALL 保留其原修订含义。

#### Scenario: A retired source path is removed

- **WHEN** 旧源码路径从当前 QA 捕获与校验脚本移除
- **THEN** 当前检查 SHALL 覆盖现役运行时并通过相关浏览器回归
- **AND** 旧路径的存在性或旧实现源码字符串 SHALL NOT 作为当前产品正确性的条件
