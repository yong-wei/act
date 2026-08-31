# 作业批改闭环最终交接（2026-08-31）

## 本轮结论

代码级闭环已完成，相关测试和静态门禁通过。真实 PostgreSQL/WSL MinIO 写入回读、校验和验证和发布指针复核已完成。2026-08-31 已补充真实桌面浏览器验收：正式教师批改页与学生已发布结果页通过；教师实验室的失败态与重试通过，正常概览曾被旧数据集的 0.5 分粒度契约错误阻断（reconciliation 后已按隔离处置，见下）。移动设备验收仍为 `DEFER`，不被解释为发布质量通过。

## Integration Reconciliation 补录（2026-08-31 晚，PR #1731 接手整改）

该分支落后 `integration` 458 个提交；首次审查给出 1 个 P1（并行批改状态机）与 1 个阻断性 P2（验收记录失实）。接手后完成：

- **P1 整改**：合并 `origin/integration`（解决 9 处 git 冲突）；按 `assignment-review-feedback-authority` spec 删除 `AssignmentSubmissionGrade`/`Confirmation`/`Release`/`AssignmentQuestionConclusion` 表、enum、迁移与物化 facade。作业级状态、总分与学生结果包全部改为从题级 canonical 审批快照、`TeacherAssignmentQuestionExemption` 豁免与 `RELEASE_STUDENT_FEEDBACK` outbox 派生（`src/lib/assignments/assignment-grading-closure.ts`）。批改编排、人工批改、批注资产与 grade 路由全部经 `public-api` 薄壳化，架构守卫测试恢复通过。
- **P2 整改**：教师实验室数据集 listing 改为逐份隔离违反量规契约（含 0.5 分粒度）的旧数据集并在 overview 显式上报原因，单个旧数据集不再阻断概览；新增 `tests/teacher-assignment-grading-closure-1731.spec.ts` Playwright 验收 13/13 通过（教师批改控制台、整份审阅确认/发布、学生已发布结果；桌面 768/1024/1440 与移动 320/375 视口，全部通过无横向溢出守卫），截图与宽度证据在 `artifacts/commercial-ui/teacher-assignment-grading-closure-1731/playwright/`。
- **验证基线**：`npm run typecheck` TS 错误为零（web 图剩余边界失败与 `origin/integration` 基线逐字一致，为基线既有状态）；assignment/grading 域 Vitest 全部通过；`openspec validate add-assignment-ai-grading-loop --type change --strict` 通过。原 fork 项目 `stage-a` 三个一次性运维脚本绑定其本地数据根，随并行状态机一并移除。

## 可复现证据

- 直接影响范围 Vitest：6 个文件、51 个测试，全部通过。
- TypeScript：`npx tsc --noEmit`，无错误。
- ESLint：`npx eslint . --max-warnings=0`，无问题。
- 敏感文件检查：`check-teacher-ai-grading-sensitive-files.ts` 通过（0 个 staged path）。
- `git diff --check`：无空白错误；仅有行尾转换警告。
- UI 组件测试覆盖教师 AI 批改实验室加载失败/重试、可访问名称、结果展示和发布状态；服务层覆盖 PDF、确认、发布隔离与回读门禁。
- 同版本 WSL MinIO 使用既有数据目录在 `127.0.0.1:9002` 提供服务；12 个候选 PDF 已以冻结校验和写入，事务性发布指针复核通过。3 份学生发布结果与 12 份 PDF 的页数和 SHA-256 全部匹配。
- Reconciliation 后：assignment/grading 域 Vitest（closure/route/投影/守卫/orchestration/console）全部通过；Playwright `teacher-assignment-grading-closure-1731` 13/13。

## 独立只读审查裁定

| finding 类别 | 裁定 | 依据 |
|---|---|---|
| 代码、类型、测试回归 | ACCEPT | 相关测试与静态检查均通过 |
| 真实 PostgreSQL/WSL MinIO 写入回读 | ACCEPT | 既有数据目录恢复后完成 12 个不可变 PDF 写入、回读校验和和发布指针复核；端点为 `127.0.0.1:9002` |
| 桌面真实浏览器验收 | PARTIAL → ACCEPT（reconciliation 后） | 正式教师批改页、学生已发布结果页及键盘焦点通过；教师实验室失败态与重试通过，正常概览的旧数据集契约错误已按「逐份隔离 + 显式上报」处置，并以本项目 Playwright 证据（13/13，含 320px 视口与无横向溢出守卫）重新验收 |
| 移动真实设备验收 | DEFER（320/375 视口已由 Playwright 补齐） | 物理设备矩阵按负责人决定保留 `DEFER`；视口级移动验收已覆盖 |
| 真实数据进入 Git | REJECT | 敏感文件检查通过，工作区仅含脱敏代码/文档和迁移 |

## 未执行范围

未执行 `npm test` 的全仓库长链路、扫描器/LibreOffice/Provider 边界的统一实际集成链路，以及移动真实物理设备矩阵。

## 后续唯一动作

后续只需完成扫描器/LibreOffice/Provider 边界集成测试；移动物理设备验收按负责人决定保留 `DEFER`。不得重新创建批次、重跑评分或覆盖已冻结结果。
