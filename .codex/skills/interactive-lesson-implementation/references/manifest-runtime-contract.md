# Manifest-first 运行时合同

## 目标

本文件只约束新编排互动课的运行时兑现链：

`interactive-page.md + interactive-contract.yaml -> reviewed/exported interactive-manifest.json -> shared template registry -> shared module registry -> shared activity registry`

实现阶段的任务是让共享渲染器忠实消费这条链，而不是再写一份课程私有平行契约。

## 一、真源与职责

- 作者态真源仍是 `interactive-page.md` 与 `interactive-contract.yaml`。
- runtime 真源是 review/export 后的 `interactive-manifest.json`。
- 模板注册表只负责区域骨架、区域顺序和模板级保留规则。
- 模块注册表只负责把单个 `module.kind` 渲染成对应节点。
- 活动注册表只负责 `interaction_spec` 对应的提交、显示与教师控制逻辑。

若某个页面必须依赖课程特殊能力，应新增窄适配器模块或活动类型；不要把整门课重新做成私有 `switch (step.id)`。

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

- 共享模块注册表必须覆盖 contract 中实际出现的 `kind` 集合。
- Rust/WASM 共享分析模块属于正式覆盖面，包括但不限于：
  - `rust-analysis-panel`
  - `rust-time-compare-panel`
  - `rust-bode-compare-panel`
- Rust 链条替换后的缺口应修共享模块或其窄适配器；不要以静态图、旧图表组件或课程私有面板作为默认回退。

## 五、验证要求

- 渲染层检查不能只看“页面能显示”。
- 至少额外核对：
  - required module ids 全部落页
  - 模板区域顺序与 manifest 一致
  - 同区域多模块的顺序与独立节点仍然保留
  - `?step=` 预览与正式课堂页都不丢模块
  - 教师控制、逐步显影、答案揭示仍绑定到 manifest 对应步骤

## 六、正反例

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
