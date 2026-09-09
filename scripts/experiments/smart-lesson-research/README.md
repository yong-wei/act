# 智能备课实验脚本

本目录用于智能备课模块的实验执行与结果导出。提交仓库时不包含任何真实账号密码。

## 环境变量

登录默认使用 `scripts/db/verified-test-accounts.mjs` 的三角色账号（教师 `test_teacher`，管理员 `admin`）。本地数据库若还没有这组账号，先运行 `node scripts/db/ensure-verified-test-accounts.mjs`。需要覆盖时再在 `.env` 或当前环境中设置：

- `SMART_LESSON_TEACHER_LOGIN_ID` / `SMART_LESSON_TEACHER_PASSWORD`：覆盖默认教师登录
- `SMART_LESSON_ADMIN_LOGIN_ID` / `SMART_LESSON_ADMIN_PASSWORD`：覆盖默认管理员登录（仅在需要 AI provider 配置操作时）
- `SMART_LESSON_COURSE_BASIS_ID` / `SMART_LESSON_SOURCE_VERSION_ID`：覆盖默认课程依据与来源版本（必须属于登录教师）

## 主要脚本

- `run-smart-lesson-experiment.mjs`：创建 task、启动 generation job、轮询 draft 状态并保存进度。
- `export-smart-lesson-results.mjs`：从数据库导出 task/draft/job/stage/attempt 原始记录。
- `dump-smoke-chain.mjs`：导出指定 task 的完整 smoke 链路 JSON。
- `provider-compat-tool.mjs`：管理端 AI provider/model 兼容性检查（只读测试，配置写操作需另行授权）。

## 纪律

- 正式实验不使用 fixture 结果。
- 失败记录原样保留，不 retry/resume 补造结果。
- `outputs/` 下仅保存真实生成与真实数据库导出。
