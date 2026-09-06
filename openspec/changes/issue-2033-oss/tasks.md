# Tasks

- [x] 1. 指标纯函数模块 `adaptive-path-differentiation.ts`：7 项两两指标计算与达标判定（Jaccard/TVD/顺序/时长/检查点结构/核心节点差），单测覆盖边界与阈值
- [x] 1.1 批次装配接入两两计算并持久化 metadata.differentiation（含 highDifferentiation 门禁与共享先修节点剔除）；策略映射与 strategy 元数据落到可序列化选项（进行中任务 2 的元数据部分）
- [ ] 2. 三策略语义装配：族→策略映射常量、薄弱点缺口排序与资源配额、偏好类型占比配额、优势迁移任务优先；候选携带 strategy 与画像依据；画像不可用标记 generic
- [ ] 3. 资源→Runtime 对象键 resolver 与批次定稿读取验证（存在性+校验值），验证记录持久化；失败剔除与资源不足真实限制
- [ ] 4. 批次两两指标计算、持久化与 `highDifferentiation` 门禁标记；响应返回指标；不复制路径凑数
- [ ] 5. 候选比较呈现：策略、画像依据、核心节点/资源、Runtime 读取状态、两两差异摘要（经 student-safe 投影三处审计）
- [ ] 6. 受控画像 fixture 与单变量对照测试（薄弱点/偏好/优势三组）+ 故障注入测试
- [ ] 7. 验收脚本产出证据包（界面证据、对比表、三组指标、对照结果、读取记录、故障注入、一致性报告）
- [ ] 8. 回归：typecheck、相关 vitest 套件、OpenSpec strict、验收脚本本地执行
