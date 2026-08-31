# 阶段 A 恢复记录：教师确认与发布前置

日期：2026-08-28

## 执行范围

- 目标为本地专用阶段 A 作业，验收分母为 3 份提交 × 4 题 = 12 个逻辑项。
- Provider 保持为 `siliconflow / Qwen/Qwen3.5-35B-A3B`；视觉 Provider 保持为 `siliconflow / Qwen/Qwen3-VL-8B-Instruct`。
- 未读取隐藏验收集，未创建新 AI 批次，未修改 AI 分数、教师批注或审批快照。

## 已完成

- 12 条 `PROCESS_GOVERNED_EVIDENCE` 经正式 teacher-review outbox worker 成功处理。
- 12 条 `GENERATE_DERIVATIVE` 与 12 条 `RELEASE_STUDENT_FEEDBACK` 命令均为 `SUCCEEDED`。
- 已修复：反馈命令成功但治理证据失败时，`RETRY_DERIVATIVE` 可安全重排治理证据命令。
- 已增加整份结果快照投影，仅从当前提交和已批准题目生成确认快照，不创建 Provider 批次。
- 定向回归测试 `87/87` 通过，`npm run typecheck` 与 `git diff --check` 通过。

## 门禁阻断

- 三份提交的冻结截止时间为 `2026-08-28T05:45:13Z`；本次执行时系统时间为 `2026-08-28T01:30Z`。
- 整份结果快照投影按领域契约拒绝提前操作，错误为 `assignment-result-before-deadline`。
- 尚未执行整份结果 `CONFIRM`、最终 `RELEASE`、学生结果读取或 PDF 下载。
- `G.8` 保持 `FAIL`；不得据此宣称阶段 A 完成或启动阶段 B。

## 恢复顺序

1. 截止时间后生成 3 份整份结果确认快照。
2. 通过现有教师结果接口逐份执行 `REFRESH`、`CONFIRM`、`RELEASE`。
3. 以受控学生账号验证结果隔离、未发布状态反向拒绝和发布后读取权限。
4. 下载 12 份批注 PDF，逐页核验原文未遮挡、批注位置和文件可重开。
5. 更新 G.8 审计；仅在所有证据满足门禁后进入阶段 B。
