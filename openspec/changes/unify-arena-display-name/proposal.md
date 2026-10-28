## Why

导航把控制竞技场称为“竞技场”，但学生、教师和管理员页面的正文、按钮、恢复提示、证据标签、路径节点和控灵引用仍大量直接写英文 “Arena”，例如“Arena 终测”“返回 Arena”“Arena 官方评测”。同一产品中英混称，学生需要自己对应两种名称，也与学习者可见文案应使用中文名称的约定不符。

## What Changes

- 把面向用户的中文文案与单独显示的标签中的 “Arena” 统一为“竞技场”，覆盖学生、教师、管理员页面、服务端返回给界面的提示、控灵提示词与引用标签、课程资源登记名称和种子数据。
- 只改字符串字面量与 JSX 文本中的独立单词 “Arena”；路由、类型、模型名、事件名、`data-*` 属性、`ArenaSubmission` 等标识符不变。
- 保留整组为英文的标签（架构章程领域列表、管理员看板英文栏目），以及按 Prisma 模型名前缀匹配的错误判定逻辑。
- 同步更新单测、Playwright 用例与证据采集脚本中的对应断言。

## 非目标

- 不改数据库中已有记录（如已写入的教学资源标题），不做历史数据回填；种子再次应用后新记录才使用新名称。
- 不改已通过语义审核、按内容哈希冻结的检查点与终结验证题干和选项（`learning-goal-checkpoint-question-sets.ts`、`learning-goal-terminal-validation-question-sets.ts`）；直接改字会使冻结哈希漂移，题目退回未审核、终端验证变为不可用。需走重新审核后再改。
- 不改路由路径、权限模型、竞技场评测与证据逻辑。
- 不翻译其他英文产品词。

## Impact

- 受影响代码：`src/app/arena/**`、`src/app/assessment/adaptive-practice`、`src/app/teacher/arena/**`、`src/features/arena/**`、`src/features/personalization/**`、`src/lib/data-governance/**`、`src/lib/konling-agent-runtime.ts`、`src/lib/resource-registry*.ts(x)` 等约 50 个文件，及对应测试。
- 无 API 契约、数据库结构或运行时发布变化。
