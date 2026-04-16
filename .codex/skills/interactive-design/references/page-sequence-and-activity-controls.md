# 页面顺序、公式表格排布与作答控制约束

## 1. 页面必须自包含到可脱离讲稿独立阅读

- 每一步至少回答四个问题：对象是什么、正在判断什么、关键证据在哪里、它如何接回本课主线。
- 若学生离开讲稿后无法回答这四问，说明页面缺少题面、前提、图后解释、结论桥接或目标提示。
- 任何“课堂上教师会补充说明”的默认假设，都不能当成作者态设计成立的前提。

## 2. 页面顺序以讲义证据链为准

每一步都要写成明确顺序：

`先出现什么 -> 再出现什么 -> 最后出现什么`

不得只写“主阅读顺序”或“内容见讲义”。

## 3. 图片不得默认抢占页面顶端

- 只有当图片本身就是题面或首个证据时，才允许放在最上方。
- 若讲义顺序是“公式 -> 文案 -> 图片 -> 表格”，互动页必须照此落页。
- 若讲义顺序是“原理 -> 题面 -> 推导 -> 图像验证”，互动页不得改成“图像 -> 原理 -> 题面”。

## 4. 公式与表格必须拆开命名

- 公式密集区必须按条目或成组关系拆开，并配名称或说明文案。
- 表格默认保留名称、作用与适用边界。
- 若讲义要求并排比较，两张表可左右并排，但不得挤成一整块文字。

## 5. 后测与收束默认分离

- 后测是检查学生判断链是否形成。
- 收束是总结与去向说明。
- 默认应分成两个步骤；若必须同页，必须在设计稿中写明理由与语义边界。

## 6. 学生作答默认隐藏

若页面存在作答区，必须写明：

- `default_visibility: hidden | locked`
- `release_required: true | false`
- `browse_required: true | false`

默认推荐：

- `default_visibility: hidden`
- `release_required: true`
- `browse_required: false`

## 7. 作答卡约束

每个作答卡至少写清：

- `id`
- `prompt`
- `response_kind`
- `submit_scope`
- `layout_span`

推荐取值：

- `response_kind`: `fill_text` / `single_choice` / `multi_choice` / `match` / `drag_sort`
- `submit_scope`: `per_card`
- `layout_span`: `one_third` / `half` / `full`

## 8. 教师控制字段

`teacher_controls` 至少明确：

- `release_activity`
- `open_browse`
- `teacher_step_reveal`
- `reveal_reference_answer`

若页面不需要其中某项，也要显式写明 `not_applicable`，不要留空让实现侧猜测。

## 9. 学生访问字段

若页面有浏览限制或作答限制，`interactive-contract.yaml` 中至少写清：

- `student_access.default_visibility`
- `student_access.release_required`
- `student_access.browse_required`
- `student_access.can_view_problem_statement`
- `student_access.can_view_derivation_steps`
- `student_access.can_submit_without_browse`

## 10. 人读稿最低结构

每一步至少包含：

- 页面骨架
- 模块清单
- 静态承载内容
- 混合证据顺序
- 互动升级点
- 教师控制
- 学生默认状态
- 本页脱离讲稿后的自包含检查
- 预览口径

## 11. 典型禁例

- 统一媒体槽位把图片自动插到正文前面
- 一整页只给一个“学生作答区”标题和一个统一提交按钮
- 例题题面、原理说明、作答区三者边界不清
- 机读契约里没有教师控制与学生访问字段，只写互动类型
- 页面只写“见讲义”“教师补充说明”“学生讨论后理解”，却没有把关键证据真正落在当前页
