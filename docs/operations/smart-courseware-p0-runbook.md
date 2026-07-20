# 智能课件发布 P0 运行手册

本手册描述 `publish-smart-courseware-to-classroom` 的 P0 验收口径。发布证据、不可变版本、目录投影、`ClassSession` 精确绑定和学生运行态已经通过自动化与迁移验证；完整端到端演示仍须满足下文的确定性与真实 provider 证据要求。

## 发布合同

发布针对一个确定的课件内容哈希，必须同时具备静态验证回执和浏览器验证回执。静态回执覆盖结构、时长、活动、角色泄漏、来源状态、AI 标签及教案基线；浏览器回执使用仓库固定的 Chromium、Noto Sans SC 字体文件、视口与验证 profile 检查渲染几何。任一 profile 版本或课件内容哈希变化都要求重新验证，AI 审阅不替代这两份确定性回执。

每个 `ai_generated_source_pending` 或 `teacher_created_source_pending` 教学目标、课件模块必须由教师逐项确认。确认绑定稳定 gap identity；目标或模块内容、来源绑定集合、来源状态以及删除后重建会产生新 identity，原确认随即失效。无关的教案修订、同级模块或排序变化不撤销该项确认，但会使绑定旧课件整体哈希的两份回执失效。

基于旧教案修订版的课件还需要单独的 stale-baseline acknowledgement，记录比较的两个版本、教师、时间和理由。教案批准、编辑器审阅、整课批准和目录投影均不自动生成来源缺口或陈旧基线确认。

发布后形成不可变的 `互动课件第N版（基于教案第M版）`。继续编辑必须回到可变草稿并产生后续版本，不得改写已发布 revision。目录中的 `LessonPlan`、`LessonItem`、`TeachingResource` 与 publication 在同一事务中建立学生安全投影；`ClassSession` 保存精确 revision、manifest hash、显示版本和教案基线。运行态只解析该绑定版本，身份损坏时记录幂等 incident 并显示恢复状态，不能查询或替换为最新版本。未绑定 publication 的既有课堂继续使用 legacy `planId` 路径。

## 角色与隐私

教师或管理员可以查看发布回执、逐项确认、来源与 provider generation audit。学生只能读取与课堂绑定的已发布学生投影；学生响应不得包含教师答案、provider audit、私有控灵记忆、可变备课草稿或未绑定的新版本。缺失 revision 或 manifest hash 不一致时必须进入完整性恢复状态，不能替换为最新版本。

回执和演示证据不得保存 API key、Cookie、Authorization header、原始 provider trace 或学生答案正文。需要保留 provider 证据时，只记录 provider/model 标识、请求关联标识、时间、版本和经过脱敏的结果摘要。

## 环境配置

数据库与应用运行需要 `DATABASE_URL`，浏览器回执还需要：

- `SMART_COURSEWARE_PUBLICATION_REVIEW_BASE_URL`：应用可访问的固定回执页面 origin。
- `SMART_COURSEWARE_PUBLICATION_REVIEW_SECRET`：仅服务端和验证 worker 持有的回执访问密钥。
- `SMART_COURSEWARE_ORDERING_SECRET`：学生投影排序 HMAC 密钥；生产值至少 32 bytes，不能使用示例占位值。
- `NEXTAUTH_URL` 或 `APP_URL`：发布服务生成应用 origin 时使用。
- `SMART_COURSEWARE_REDIS_PREFIX`：共享 Redis 时可选的课件队列命名空间。

真实 provider 通过 `/admin/config` 选择运行时支持的 OpenAI-compatible provider，secret 仅通过环境引用提供。不得把 provider key 写入文档、fixture、截图或录屏。`SMART_COURSEWARE_E2E_FIXTURE_TOKEN=smart-courseware-real-browser-v1` 只允许确定性自动化使用，不能作为真实 provider 演示证据。

## 验证命令

在仓库根目录执行：

```bash
rtk npx prisma validate
rtk npm run test:smart-courseware
rtk npx playwright test tests/generated-courseware-slide-runtime.spec.ts
rtk npx playwright test tests/smart-courseware-public-seam.spec.ts
rtk node scripts/tests/test-smart-courseware-deploy-contract.mjs
rtk npm run typecheck
rtk openspec validate publish-smart-courseware-to-classroom --strict
```

浏览器回执失败时，先核对 Playwright Chromium、`@fontsource-variable/noto-sans-sc` 文件哈希和固定 profile 常量，不得通过改变期望值或使用非固定本机字体绕过失败。上述命令用于验证发布与固定浏览器合同；目录、课堂绑定、学生渲染和完整性恢复还应运行 smart-courseware、session route、ResourceRenderer 及隔离 PostgreSQL migration 测试。

## 45 分钟根轨迹人工证据

task 3.2 的真实 provider 证据尚未录制。完成时应记录一次连续的 45 分钟根轨迹课程：在 Konling `prep-coauthor` 中以自然语言创建任务，完成一次歧义澄清和后续轮次约束修订，导入普通课程依据，形成幅值条件、相角条件和基本绘制规则的来源锚点，生成六个 BOPPPS 环节，完成静态与浏览器验证、发布、目录选择、课堂启动和学生交互。

录制证据还应包括三项内容质量对照、零个未处理的目标/模块来源缺口、逐项确认记录和真实 provider audit 的教师或管理员视图。若现场使用预生成 revision，画面和证据清单必须明确标记“备份：非本次生成”。确定性 fixture、测试 provider 或先前录制片段不能冒充本次真实 provider 运行。

人工证据未完成时，只能报告已通过的自动化与迁移结果，不能宣称真实 provider P0 闭环完成。
