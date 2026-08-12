## Why

当前 Authority 工作区把 4,891 个权威对象显示为卡片网格，并把 2,409 条关系再次显示为卡片列表；用户无法从空间结构、关系方向和局部邻域理解知识图谱。页面还把 ReleaseSet、Release、Snapshot、Activation、对象/关系 ID、原始枚举及内部来源定位作为产品内容显示，违反了面向人的语义表达边界。

## What Changes

- 将当前 Authority 主区域从对象卡片墙和关系卡片列表改为可平移、缩放、选择和沿边探索的语义节点—关系画布。
- 使用稳定形状、颜色、图标和中文类型名称区分异质权威对象；长定义、公式、可读来源和关系摘要进入选中后的详情面板。
- 只绘制当前 Authority 已发布的真实关系，并以线型、箭头和中文关系词表达谓词与方向；不得补造、推断或随机聚合关系。
- 采用局部邻域和渐进展开保持大图可读，同时保证当前 Authority 中所有可展示对象均可经搜索、筛选或关系探索抵达。
- 对学生、教师和管理员的当前 Authority 产品界面统一隐藏 Release/ReleaseSet、版本哈希、Snapshot/Activation/Projection、对象/关系 ID、原始枚举、内部来源定位和实现状态；运维身份只允许进入独立受控诊断界面。
- 为未知对象类型、谓词、方向和来源建立失败关闭的可读状态，禁止以内部字符串填补缺失名称、说明或关系端点。
- 补充节点—边拓扑、渐进探索、角色信息边界、辅助技术文本、窄屏交互和真实产品 QA 验收。

## Capabilities

### New Capabilities

- `active-authority-semantic-graph-presentation`: 规定当前 Authority 如何以语义节点—关系画布呈现真实工程对象和关系，并阻止系统身份进入产品界面。

### Modified Capabilities

无。本变更在既有 active Authority 解析和三模式工作区之上增加独立的产品呈现合同，不改变 selector、Authority API 身份校验或 Legacy/candidate 隔离语义。

## Impact

- 主要影响 `src/features/knowledge/active-authority-graph.tsx`、浏览器安全的 Authority 展示适配、节点详情与相关组件测试。
- 可能复用 `src/features/knowledge/graph/` 现有画布、布局、相机和焦点管理能力，但不得把 Legacy 数据或显示语义混入 Authority 合同。
- active Authority API 可以继续返回客户端建立拓扑所需的内部关联键；这些值不得进入可见文本、辅助技术名称、复制内容或回退文案。
- 需要刷新 `/knowledge` 产品 QA、三角色证据和独立视觉审查；不修改 Prisma schema、生产 selector、Authority 发布物、Legacy Archive、candidate 诊断或远端部署控制面。
