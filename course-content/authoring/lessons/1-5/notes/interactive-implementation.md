# 1-5 课程实现笔记

## 课程信息

- 课次：1-5
- 标题：三域联动——一个增益如何改变稳定性
- 设计真源：`design/1-5-interactive-contract.yaml`
- 当前实现入口：`/interactive-learning/courses/unit-1-5-three-domain-gain-sweep`

## 当前状态

- manifest-first 学生端、教师端、演示端、等待页、课堂同步与课程注册已按本轮作者态合同复验。
- step 12 通用四行迁移表、steps 5—9 学习事实暂缓策略、同一步多次提交历史与 step 14 动态统计均已进入 runtime。
- `interactive-implementation-acceptance.json` 已记录实现验收事实；课程、数据治理、仿真/UI 与独立 reviewer 仍作为提交前清场门禁。

## 本次实现内容

- 14 步页面统一读取 1-5 runtime manifest，不建立课程私有内容映射或课程私有图表。
- 步骤 5—9 复用共享控制工作台与 Rust/WASM `useControlEngine`；固定增益与动态增益请求同步唯一启用 gain 和根轨迹当前增益。
- 步骤 6、7、9 使用共享 `comparisonRequests/comparisonMode`，复用时域与 Bode 比较面板，并保留当前根轨迹和性能视图。
- 步骤 9 从不可变学生响应历史按精确快照选择器回填五个代表增益；错配或缺失留空，学生已填值优先，其余空单元格继续接收后续证据。
- 步骤 5—8 仅由 `compute.panel` 提交；当前主请求与全部对照请求完成后才开放提交，并沿用 manifest submission controller、异步防重复、保存失败提示和重试链路。
- 步骤 5—9 暂不物化 LearningFact；`validationScope=engine_result_only` 只说明数值引擎结果可用，不表示学生答案正确。
- 步骤 14 学生端读取个人状态，教师端读取班级聚合，只展示证据完成度/提交完成度，并将目标 5 课后进度单列。
- 全程只更新 Global AI 隐藏页面上下文，不增加页内 AI 入口；目标 5 作为课后拓展单列。

## 与设计稿一致性

- 已消除差异：课程入口、14 步顺序、canonical 模块、教师控制、学生提交、知识卡抽屉、课堂同步和答案揭示均由共享 runtime manifest 驱动。
- 有意实现方式：步骤 9 表格由通用 `activity.workspace` renderer 扩展承载，不增加 1-5 专用表格组件。
- 比较与精确预填能力状态已更新为 `implemented`；步骤 12 的附加结构化字段与步骤 14 的角色化统计均由通用 runtime 消费。

## 媒体资源状态

- runtime manifest 保留设计声明的媒体与 fallback 路径。
- 本轮未新增或替换媒体资源。

## 验证记录

- runtime 导出成功；manifest 审计为 14 步、58 模块、0 issues。
- 课程审查 Python 测试 37 项通过；1-5 与共享 runtime 定向 Vitest 244 项通过；Rust 3 项覆盖共享默认 2%、1-5 显式 5% 与临界/不稳定指标边界；TypeScript typecheck 通过。
- 数据治理集成测试 3 项通过，2 项因鉴权/缺少班级数据按脚本设计跳过；`git diff --check` 通过。
- Rust 1-5 定向测试确认课程显式采用 5% 调节时间、共享默认仍为 2%，临界/不稳定状态不输出有限稳定瞬态指标；WASM 构建通过。
- 浏览器复验步骤 5、12、14：step 12 显示 20 个四行迁移表输入及 3 个迁移结论输入，step 14 显示动态个人摘要和 1672 px 总结信息图；页面无横向溢出，仅出现既有 favicon 404。

## 下次优化建议

- 后续可补真实教师/学生双端压力联调，持续观察多标签页同时作答时的服务端版本冲突。
