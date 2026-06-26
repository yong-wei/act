# #676 Data Center and simulation workflow remediation evidence

整改变更：`audit-remediation-data-center-simulation-workflow`

关联审计章节：
- `chapters/45-function-state-flows-batch37.md`
- `chapters/51-function-state-flows-batch43.md`
- `chapters/55-function-state-flows-batch47.md`
- `chapters/58-function-state-flows-batch50.md`
- `chapters/44-function-state-flows-batch36.md`
- `chapters/47-function-state-flows-batch39.md`

## 覆盖的 finding id

- 201：学生访问数据中心被静默改道。
- 202：数据中心演示数据与正式工作区边界不足。
- 203：教师数据中心治理动作落点过于泛化。
- 204：数据中心导出按钮被全局浮层干扰。
- 205：数据中心导出缺少完成状态播报。
- 256、304、330、343、390：数据中心快照导出、returnTo 和治理交接没有形成可验证闭环。
- 192：任务启动后缺少任务上下文继承。
- 194：任务完成回写路径不清。
- 197：仿真设计空态动作没有保存回流合同。
- 220：仿真命令甲板 `bottom-tools` 合同存在但不可见。
- 223：仿真目录筛选结果缺少状态播报。
- 224：仿真目录空态缺少恢复动作。
- 225：`/virtual-lab` 重定向缺少兼容说明。

## 覆盖范围

- 学生访问 `/data-center` 时，重定向目标携带 `origin=/data-center`、`reason=student-role-boundary`、`targetScope=learner-evidence-review` 和来源边界说明。
- 数据中心导出快照声明来源表族、来源窗口、请求角色、来源质量和脱敏策略，并排除原始学习事实、能力快照、风险标记、班级快照、直接学生标识和私有证据正文。
- 数据中心导出命令栏提供 preparing、ready、downloaded、failed、retry 状态合同，并为底部全局浮层预留安全区。
- 数据中心治理 handoff 保留 origin route、target scope 和 source quality。
- 仿真 shell 声明的 `bottom-tools` 可见，并保留局部工具区域语义。
- Destroyer mission/task 入口显示任务 id、任务标题、目标、完成标准、返回目标、写回目标和 saved/queued/unsupported/failed 状态合同。
- 仿真目录筛选结果使用 `role=status` 和 `aria-live` 播报；空状态提供清除筛选和返回全部仿真。
- `/virtual-lab` 兼容入口跳转到 `/simulations?compat=virtual-lab`，并在目录顶部显示兼容说明。

## 本地验证

- `rtk npm run test:unit -- src/app/__tests__/data-center-page.test.ts src/features/data-center/__tests__/data-center-contracts.test.ts src/app/__tests__/simulation-workflow-contracts.test.ts`
- `rtk npm run lint`
- `rtk openspec validate --specs --strict`
- `rtk openspec validate --changes --strict`

## 浏览器证据

- `playwright/browser-evidence.json`
- `playwright/downloaded-data-center-snapshot.json`
- `playwright/data-center-export-1440.png`
- `playwright/destroyer-mission-context-1440.png`
- `playwright/destroyer-written-back-context-1440.png`
- `playwright/virtual-lab-compatibility-1440.png`
