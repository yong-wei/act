## Context

控制理论课程中的推导往往需要在左侧保留定义、右侧展开变换、下方写结论，中间用箭头和括号建立关系。线性卡片列表会破坏这种空间结构，也无法支撑教师按课堂节奏跳转和局部强调。

## Design Contract

本变更引用 Product Design 合同第 4.4 节 `visual.derivation-stage`。其中非线性显影、LaTeX 真源、公式分块、语义变色、长公式逐步显影、教师任意跳转和学生证据记录均为硬闸门。

## Decisions

1. `visual.derivationStage` 基于视觉舞台坐标运行，但作为独立 module kind 或 stage layer renderer 注册。
2. 每个公式、公式块、文本块、连接线和显影步骤都有稳定 id。
3. 公式必须由 KaTeX/LaTeX 渲染结果呈现，LaTeX 源保存在 manifest payload。
4. 公式块颜色使用语义 role，而不是任意局部样式字符串。
5. 教师控制状态必须可持久化并可刷新恢复。
6. 学生提交必须带上当前显影步骤和已浏览显影状态。

## Acceptance Evidence

- 视觉稿或方向稿路径。
- 学生端浅色/深色截图。
- 教师端浅色/深色截图。
- 教师任意跳转显影截图。
- 学生已释放显影截图。
- 长公式分块逐步显示截图。
- manifest audit 和后台证据样本。
