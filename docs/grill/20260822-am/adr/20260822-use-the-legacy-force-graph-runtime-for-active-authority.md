---
status: accepted
context: active-authority-legacy-engine-migration
---

# 以旧版 Force Graph 运行底座承载 Active Authority

## 背景

旧版知识图谱由 `KnowledgeGraphSystem`、`react-force-graph-2d` 和 `react-force-graph-3d` 组成，已经具备全工作区无限画布、滚轮缩放、拖拽平移、节点拖拽与固定、力导向布局、动态连线、小型图例、悬停预览、详情检查器、相机适配和 2D/3D 切换。

新版 `ActiveAuthorityGraph` 没有复用这套运行底座，而是独立实现固定高度、固定 `viewBox`、静态坐标和按钮缩放的 SVG。两套画布分别维护布局、筛选、标题、工具栏和详情状态，导致新版形成右舷视窗，旧版操作习惯、动效和状态保持能力均无法自然继承。继续扩展 SVG 会永久维护第二套图谱引擎。

## 决策

Active Authority 与 Legacy 数据模式共用旧版 Force Graph 运行底座和操作 UI。Active Authority 通过独立、类型化的视图模型适配器接入；适配器只消费当前 Authority、Teaching Projection、工程关系和正式资源投影，不读取或拼接 Legacy DTO、Legacy 关系、Legacy 选择状态或 Legacy 缓存。

新版默认进入 2D，并完整保留 3D。两种画布共同支持全工作区、滚轮缩放、平移、拖拽、节点固定、力导向重排、动态关系、悬停快速预览、小型图例、节点与关系类型可逆筛选、焦点和详情抽屉。旧版数据模式与 Authority 数据模式分别保存布局、视口、筛选、选中节点和抽屉状态，切换时恢复各自现场，不进行模糊身份映射。

页面只保留一个标题拥有者。返回上一层、Legacy/Authority 数据模式切换和 2D/3D 切换合并到同一右上角工具栏。Authority 新增属性只进入详情抽屉；节点内部只放可验证的资源类型族标识、知识卡星标和跨领域动态光环。节点尺寸只为容纳内部状态在受控范围内变化，并同步进入碰撞、命中、边端点、标签和相机计算，不按资源数量或重要度无限放大。

显示名称不可用节点从正式运行态投影中失败关闭。开发期另生成不依赖项目服务、不进入部署包和 Runtime Release 的静态审核工件；该工件复用同一 Authority 适配器和旧版 2D/3D 引擎，提供仅正常、全部、仅占位三态过滤。

## 结果

- 当前独立 SVG 不再作为 Active Authority 的产品画布引擎；只保留迁移所需的适配或测试代码，最终不得形成第二套运行路径。
- 旧版引擎缺少资源感知动态半径、2D 碰撞或 3D 命中一致性时，在原引擎中做兼容升级，并以 2D/3D 同一语义和回归测试验收。
- Authority 中文显示继续依赖进行中的完整 locale qualification receipt；本 ADR 不建立本地权威翻译或平行语言门禁。
- 只复用旧版渲染引擎和 UI 组件，不复用授权不足的 Legacy 图谱或通用资源 API。

## 未采用方案

- 继续在 `ActiveAuthorityGraph` SVG 中逐项复刻旧版交互：形成长期双引擎并重复修复布局、命中、相机和筛选问题。
- 把 Active Authority 数据转换为 Legacy DTO：会丢失异质节点、工程谓词、版本身份和治理状态。
- 只保留 2D：不满足已经确认的旧版双模式体验，也会让数据模式切换继续承担引擎切换职责。
