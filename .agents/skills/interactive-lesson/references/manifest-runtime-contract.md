# Manifest-first 运行时合同

## 目标

本文件只约束新编排互动课的运行时兑现链：

`interactive-page.md + interactive-contract.yaml -> reviewed/exported interactive-manifest.json -> shared template registry -> shared module registry -> shared activity registry`

实现阶段的任务是让共享渲染器忠实消费这条链，而不是再写一份课程私有平行契约。

当前共享层目录固定为：

- `src/features/interactive/shared/manifest-runtime/layout-renderer.tsx`
- `src/features/interactive/shared/manifest-runtime/content-renderers.tsx`
- `src/features/interactive/shared/manifest-runtime/activity-renderers.tsx`
- `src/features/interactive/shared/manifest-runtime/types.ts`

根级 `interactive-manifest-renderer.tsx`、`manifest-content-renderers.tsx`、`manifest-activity-renderers.tsx` 只保留兼容导出。新组件、新活动类型和 renderer 修复优先进入 `manifest-runtime/`。

## 一、真源与职责

- 作者态真源仍是 `interactive-page.md` 与 `interactive-contract.yaml`。
- runtime 真源是 review/export 后的 `interactive-manifest.json`。
- `layout-renderer.tsx` 只负责区域骨架、区域顺序、模板级保留规则和 module registry 编排。
- `content-renderers.tsx` 只负责把静态内容类 `module.kind` 渲染成对应节点。
- `activity-renderers.tsx` 只负责 `interaction_spec` 对应的学生提交、教师控制、答案揭示和提交汇总。
- `types.ts` 复用 `src/lib/interactive-lesson-manifest.ts` 的 manifest 类型，不另起一套局部类型。

课程目录里的 `step-panels.tsx` 若仍存在，只能是薄适配器：读取 manifest、合并共享 registries、注入会话状态和极少量课程窄适配器。若某个页面必须依赖课程特殊能力，应新增窄适配器模块或活动类型；不要把整门课重新做成私有 `switch (step.id)`。

共享 renderer 中禁止写课程 id、step id 或 module id 特判。标题、选项、参考答案、图片路径、表格行列、显影文本、路径项等必须来自 manifest payload；缺字段时应显示可诊断问题或回退作者态补 payload，不能在共享层写 `4-6`、`4-3` 映射。

活动模块归属 activity runtime，不归 content runtime。`activity-card`、`activity-card-set`、`single-choice-card`、`quiz-card`、`quiz-group` 等模块不得在 `content-renderers.tsx` 中渲染题面列表；它们只作为 layout 中的活动锚点和 `interaction_spec` 的结构提示，由 `activity-renderers.tsx` 渲染学生作答、教师控制与结果汇总。

manifest 课堂页必须在区域内容前渲染独立页面标题模块，显示页序、步骤标题和本页主要内容描述；描述优先取 `ai_context_spec.page_goal`，其次取 `interaction_spec.student_task` 或页面介绍内容。后测页不需要“后测说明”模块；后测标题模块文案只写本页主要检查的知识和能力点。课堂页下拉页面菜单必须显示页序与标题，默认格式为`第 03 页 · 标题`。

## 二、必显模块规则

- 只要模块标记为 `must_be_visible: true`，它就必须真实落页。
- 下列情况都算实现失败：
  - 模块注册表缺少该 `kind`
  - renderer 返回 `null`
  - 共享渲染器在过滤节点时静默丢弃该模块
  - 模板把两个独立必显模块压成一个笼统壳层
- `must_be_visible` 模块不能靠“后续补齐”“仅教师端可见”“隐藏在别的组件内部”来规避。

## 三、模板区域语义

- 模板名不仅是视觉样式名，还意味着区域拓扑。
- `layout.regions` 定义了区域顺序；模板注册表必须按此顺序保留区域。
- 若同一区域存在多个模块，模板应保留多个独立节点，除非 contract 明确把它们声明为一个复合模块。
- 共享模板可以复用骨架，但不能因为省实现而抹平区域边界。

## 四、模块注册表覆盖

- 共享模块注册表必须覆盖 contract 中实际出现的 canonical `kind` 集合。
- 新课和已迁移课程只能使用标准模块类：`content.rich`、`content.cardSet`、`content.formula`、`content.code`、`content.table`、`content.figure`、`content.reveal`、`content.stageMap`、`activity.panel`、`activity.workspace`、`compute.panel`、`analytics.summary`、`layout.support`。
- 代码示例使用 `content.code`，内容块写 `language` 与 `code`；MATLAB/Octave 代码不得降级为公式、正文或 markdown fenced code。
- 旧内容名、活动名或面板名只能写入 `payload.legacyKind` 作为历史渲染提示，不能继续作为 `modules[].kind`。
- 不得新增课程私有 `modules[].kind`。若标准组件库不能表达当前页面能力，必须先提出组件库扩展变更；实现阶段不得通过单课 `step-panels.tsx`、课程常量、共享 renderer 特判或 `switch (step.id)` 绕过 module registry gate。
- 作答卡 `response_kind` 必须使用共享 canonical 响应词表：`choice.single`、`choice.binary`、`choice.multi`、`text.short`、`text.long`、`text.structured`、`parameter.set`、`ordering.sequence`、`matching.pairs`、`table.builder`、`simulation.result`、`training.result`。
- `single_choice`、`multi_select`、`fill_text`、`drag_match`、`parameter_set` 等旧响应别名只属于迁移工具的输入兼容层，不能进入新课或已迁移 runtime manifest。
- `interaction_kind` 可以继续表达页面交互形态，例如 `single_choice`、`binary_choice`、`activity_card_set`、`quiz_group`、`parameter_slider`、`table_builder`、`teacher_reveal_only`；不要把它误写为 `response_kind`。
- Rust/WASM 共享分析模块属于正式覆盖面。新实现应采用 `compute.panel + capabilityRef`；现有旧面板名对应的兼容能力包括但不限于：
  - `rust-analysis-panel`
  - `rust-time-compare-panel`
  - `rust-bode-compare-panel`
- 上述旧面板名只能作为迁移兼容或 `payload.legacyKind`，不能作为新课 `modules[].kind`。
- Rust 链条替换后的缺口应修共享模块或其窄适配器；不要以静态图、旧图表组件或课程私有面板作为默认回退。
- Rust 驱动面板的 `title` 必须写成学科对象或观察任务，不能写成“Rust 面板”“三标签面板”“对照面板”“原生统一面板”等工程或形式标签；面板标题之外不再追加解释运行时、四面板板式、Rust/WASM 引擎等无关文案。标题字号统一采用课堂模块标题规格 `text-base font-semibold leading-7 tracking-normal`，与“个人课堂表现”“班级整体表现统计”等模块保持一致。

## 五、Payload-first 规则

组件式 runtime 的默认数据流是 `module.payload` 与 `step.contentBlocks`。实现时按下列顺序处理缺口：

1. 先补作者态 `interactive-contract.yaml`，再重新 review/export 生成 `interactive-manifest.json`。
2. 若 payload 已完整但共享层不支持，补 `content-renderers.tsx` 或 `activity-renderers.tsx`。
3. 只有能力确实课程专属，且标准组件已通过 `compute.panel`、`activity.workspace` 或 `activity.panel` 表达清楚时，才在课程适配器中注入窄能力；窄适配器不得新增 runtime `kind`，不得替代 manifest payload。

禁止项：

- 在课程 `step-panels.tsx` 写 `QUIZ_OPTIONS`、`SINGLE_CHOICE_OPTIONS` 或参考答案映射来弥补 manifest 缺字段。
- 在共享 renderer 中按课程 id 或 module id 改标题、选项、参考答案。
- 把选择题、题组、路径图、表格、显影链的关键内容放在 JSX 常量里，而不是 manifest payload 里。
- 为了复用旧课常量，把 manifest-first 课程重新接回本地平行页面契约。

## 五点五、Manifest audit 规则

manifest-first 课程必须让脚本可明确审计，而不是只靠人工浏览器检查。推荐生成或等价计算以下字段：

- `step_id`
- `module_id`
- `kind`
- `renderer_owner`: `content` / `activity`
- `resolved_content_source`: `module.payload` / `content_blocks.<key>` / `implicit:<resolver>`
- `resolved_content_type`: `formula` / `table` / `image` / `summary` / `reveal` / `activity`
- `is_empty`
- `diagnostic`

最低审计规则：

- `must_be_visible: true` 的 content 模块必须有 renderer，且 renderer 的输入内容非空。
- `must_be_visible: true` 的 activity 模块不得因为 content registry 缺 renderer 而报错，也不得进入正文 layout。
- `activity_cards[].prompt` 默认在最终页面只出现一次；重复出现通常说明 content/activity 双重消费。
- `activity_cards[].prompt` 必须非空；共享教师活动汇总必须显示完整题面，并在选择题、排序题、多选题等场景显示选项，不能只显示回收结果。
- `interaction_spec.interaction_kind` 若不是 `none` / `display` / `summary`，共享学生与教师 activity registry 都必须有对应 renderer；课程窄适配器只能扩展具体工作区，不能替代教师控制入口。
- 共享教师活动汇总默认只显示答案聚合统计与提交人数，不显示提交人姓名；提交人姓名与逐条答案只能在教师点击该互动模块的`查看细节`后展示。
- `formula-card` 使用 `content_blocks.key_formulas` 隐式消费时，公式数应与同页公式模块数匹配，或由 payload 指定索引。
- `image-panel` 使用 `content_blocks.media` 隐式消费时，媒体数应与同页图片模块数匹配，或由 payload 指定索引。
- `figure_explanation`、`figure_reading`、`figure_explanations`、`parameter_explanation` 等图后说明不得留在 `content_blocks` 中未消费；若确实不展示，契约必须显式标记允许未消费。
- 图片下方文案不得直接使用页面标题、模块标题、图片标题或文件名。无读图价值时不显示 caption；需要显示时，必须写成图片具体内容、可观察证据、读图顺序或基于图片的分析判断。
- 不允许只渲染模块标题而无正文、公式、表格、图片、图后说明或显影文本的壳层通过审计。

## 六、验证要求

- 渲染层检查不能只看“页面能显示”。
- 至少额外核对：
  - required module ids 全部落页
  - 模板区域顺序与 manifest 一致
  - 同区域多模块的顺序与独立节点仍然保留
  - 标题、选项、参考答案、表格内容、图片路径、显影文本来自 manifest payload
  - 图后说明来自 manifest payload 或 `content_blocks` 并已显示
  - 图片下方文案没有复用页面标题、模块标题、图片标题或文件名；若存在 caption，内容是具体描述或分析判断
  - activity 模块只由 activity registry 消费，正文区没有额外“本页作答”题面列表
  - 每个 `activity_cards[].prompt` 默认只出现一次
  - 教师活动汇总在释放互动后仍显示题面和选项
  - 教师活动汇总默认只显示聚合统计，未点击`查看细节`时不出现提交人姓名
  - 页面顶部存在独立标题模块，且下拉菜单选项含页序
  - 后测页不存在独立“后测说明”模块，主要检查的知识和能力点写在标题模块文案中
  - `?step=` 预览与正式课堂页都不丢模块
  - 教师控制、逐步显影、答案揭示仍绑定到 manifest 对应步骤
  - 页面不存在 `data-manifest-render-error` 或“互动页模块渲染缺失”

默认测试组合：

- `src/features/interactive/__tests__/interactive-manifest-runtime.test.tsx`
- 对应课程测试，例如 `src/features/interactive/__tests__/unit-4-6-course.test.ts`、`src/features/interactive/__tests__/unit-4-3-course.test.ts`
- `npm run test:unit -- src/features/interactive/__tests__/interactive-module-taxonomy.test.ts src/features/interactive/__tests__/interactive-module-registry-gate.test.ts`
- `python3 course-content/scripts/review_lesson_content.py --lesson <lesson> --skip-export --strict-implementation-contract`
- manifest-first 模块消费审计运行 `python3 .agents/skills/interactive-design/scripts/audit_interactive_manifest.py --lesson <lesson>`；该脚本归属 `interactive-design` 技能目录，不能迁入全局 `scripts/tests/` 作为技能私有规则的存放点。
- 浏览器至少验证 4-6 回归与被迁移课程关键页面，确认无 `data-manifest-render-error`、无 `data-manifest-missing-field`、无重复题面，教师控制和学生提交仍可用。

## 七、正反例

### 正例

某一步使用 `boundary_case_board`，在 `media` 区域声明两个必显模块：

- `roll-native-time-compare`
- `roll-native-bode-compare`

合格实现应让它们作为两个独立节点同时落在 `media` 区域，并保留该区域在模板中的位置。

### 反例

- 模板把 `media` 区域合并成一个“综合比较面板”，只保留一个模块。
- `rust-bode-compare-panel` 暂时返回 `null`，页面依旧继续渲染。
- 共享渲染器用 `filter(Boolean)` 静默吞掉必显模块，再宣称页面已可用。

这些都属于合同未兑现，不是可接受的简化。
