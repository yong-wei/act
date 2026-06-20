# 互动课程教师等待页与投影运行态全集审计续篇

日期：2026-06-20
范围：29 个 `/interactive-learning/courses/*/teacher/demo/waiting` 与 29 个 `/interactive-learning/courses/*/teacher/demo` 页面。
用户状态：`test_teacher` 教师登录态，`sessionId=demo`。
截图证据：`screenshots/25-course-teacher-waiting-demo-all/`、`screenshots/26-course-teacher-runtime-demo-all/`。
采集清单：`screenshots/course-teacher-demo-all-manifest.json`。

## 1. 覆盖范围

本轮从 29 个课程目录派生教师等待页和教师投影运行态路径，采集桌面 1440x1000 与移动 390x844 首屏，共 116 张截图。

结果：

- 29 个教师等待页桌面/移动均返回 200。
- 29 个教师投影运行态桌面/移动均返回 200。
- 教师等待页 58 张截图均未出现 `Not found`。
- 教师投影运行态 58 张截图中 54 张出现 `Not found` 文本；只有 1-2 与 5-6 的教师运行态未出现该文本。
- 停止 dev server 时，运行日志还显示教师 demo 运行态存在后端同步错误：`GET /api/session/demo` 返回 404，`POST /api/session/demo/state` 返回 500 并触发 `StudentState_sessionId_fkey` 外键错误，`POST /api/interactive/events` 返回 500 并触发 `unsupported Unicode escape sequence`。

## 2. 教师使用顺序

教师从课程入口进入授课链路时，页面应支持：

1. 创建或确认课堂。
2. 展示课堂码和二维码，等待学生加入。
3. 开始上课后进入投影运行态。
4. 在投影运行态释放步骤、查看学生在线状态、结束课堂。

当前等待页和运行态都能访问，但 `demo` 会话下的关键课堂码、二维码和教师投影内容存在明显风险。

## 3. 教师等待页

证据：

- `screenshots/25-course-teacher-waiting-demo-all/desktop-interactive-learning-courses-unit-4-1-design-task-expression-teacher-demo-waiting.png`
- `screenshots/25-course-teacher-waiting-demo-all/mobile-interactive-learning-courses-unit-4-1-design-task-expression-teacher-demo-waiting.png`

健康度：中等。

观察：

- 等待页能清楚表达“扫码加入课堂”“等待学生加入”“开始上课”的流程。
- 桌面和移动均返回 200，说明教师等待页路由基础健康。
- 页面提供复制课堂码、复制加入链接和开始上课入口。

问题：

- P1：`demo` 会话下二维码区域长时间显示“二维码生成中”，课堂码为 `------`，教师无法判断这是演示限制、数据缺失还是生成失败。
- P1：移动端底部浮层覆盖“复制课堂码 / 复制加入链接”等关键开课操作。
- P2：等待页顶部面包屑和标题在移动端截断，教师难以确认当前课次。
- P2：如果等待页必须依赖真实 session 才能生成二维码，应在 demo 状态显式说明，而不是展示类似加载中的占位。

建议：

- demo/无效 session 下应显示受控空态：“演示会话不生成真实课堂码”，并提供返回课程或创建课堂按钮。
- 二维码、课堂码、复制按钮必须在移动端避开全局浮层。
- 教师等待页应保留完整当前课次名称，至少在主卡片中展示。

## 4. 教师投影运行态

证据：

- `screenshots/26-course-teacher-runtime-demo-all/desktop-interactive-learning-courses-unit-4-1-design-task-expression-teacher-demo.png`
- `screenshots/26-course-teacher-runtime-demo-all/mobile-interactive-learning-courses-cruise-comfort-boppps-teacher-demo.png`
- `screenshots/26-course-teacher-runtime-demo-all/desktop-interactive-learning-courses-unit-1-2-modeling-from-object-to-system-teacher-demo.png`

健康度：差，存在阻断级内容缺失风险。

观察：

- 教师投影页能显示课堂码区域、在线学生数、结束课堂、当前页标题和正文内容。
- 路由全部返回 200，说明不是访问权限或路由级失败。
- 运行态在 1-2 与 5-6 两门课上未出现 `Not found`，说明并非所有教师运行态都天然损坏。

问题：

- P0：27/29 门教师投影运行态在桌面和移动均出现 `Not found` 文本块。它位于投影内容主体上方，教师投屏时会直接暴露给学生。
- P1：移动端教师投影页中 `Not found` 显示为红色告警块，并伴随左下 `1 Issue` 浮层，破坏授课可信度。
- P1：课堂码仍显示 `------`，当前在线学生为 0；如果 demo 会话不能代表真实课堂，页面需要明示状态边界。
- P1：教师 demo 运行态仍会向 `/api/session/demo/state` 和 `/api/interactive/events` 写入；日志显示前者触发 `StudentState_sessionId_fkey` 外键错误，后者因 `\u0000 cannot be converted to text` 写入失败。页面返回 200 不代表课堂同步健康。
- P1：底部控灵/问题浮层覆盖内容下缘和课堂统计区域。
- P2：教师投影页的本页工具面板默认折叠是合理的，但当主体有 `Not found` 时，没有给教师可执行修复或回退路径。

建议：

- 立即追查教师运行态 `Not found` 来源，至少在 demo/缺资源状态下展示受控降级卡，不能在投影主体暴露裸错误文本。
- 教师投影态应区分真实课堂 session 和 demo session；课堂码、在线学生、提交计数缺失时显示明确原因。
- demo session 应禁止写入需要真实 `ClassSession` 外键的学生状态，或切换到 guest-safe 端点；互动事件写入前必须清理 `\u0000` 等数据库不接受的 Unicode escape。
- 投影运行态需要一套教师可理解的错误恢复动作：返回等待页、重新创建课堂、跳过当前模块或查看资源缺失详情。
- 移动投影态应隐藏或合并全局浮层，优先保证投影内容和课堂控制按钮不被覆盖。

## 5. 教师侧横向结论

1. 教师等待页和投影运行态路由均可访问，HTTP 层面健康。
2. 等待页的问题集中在 demo 会话课堂码/二维码未生成且说明不足。
3. 投影运行态的问题更严重：54/58 张运行态截图出现 `Not found`，这是教师课堂投影链路的阻断级体验风险。
4. 教师 demo 运行态还有同步/事件写入后端错误，说明截图里的 HTTP 200 只能证明页面壳层可访问，不能证明课堂状态链路可用。
5. 学生运行态 29 门课全部能显示内容，而教师运行态大面积出现 `Not found`，说明问题集中在教师投影特有层，而不是课程内容整体缺失。
6. 后续如果进入修复，应先定位教师投影渲染中缺失资源或模块查找逻辑，再处理 demo session 的后端写入边界，最后补视觉与移动避让。
