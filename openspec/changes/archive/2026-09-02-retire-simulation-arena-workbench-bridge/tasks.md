## 1. Dependency and caller inventory

- [x] 1.1 验证 C22 已完成并提供 Artifact/Run contract readiness；在其完成前不删除 bridge。
- [x] 1.2 盘点 `experience-shell-contracts.ts` 的所有导出、生产/测试/动态 callers、路由参数和可见 status 行为，绑定当前 revision/tree。
- [x] 1.3 为每个导出指定 Platform UI、Control Workbench、Arena、simulation 或 lesson runtime 的唯一 owner、replacement 和 rollback。

## 2. Owner migration

- [x] 2.1 迁移 Control Workbench shell/session context，保持 task、publication、return target、role scope 和 submission context。
- [x] 2.2 迁移 simulation scene 与课程 resource launch provenance，保持 `ResourceRenderer`、registry/config merge、embedded/standalone 语义。
- [x] 2.3 迁移 Arena challenge/preview/official status 和 replay/model display，保持 preview≠official 与服务端 Arena authority。
- [x] 2.4 对无 owner、未使用或重复的 export 形成删除清单，不用纯搬文件伪装迁移。

## 3. Bridge retirement

- [x] 3.1 通过静态、动态和测试扫描证明 `simulation-arena-workbench` 无剩余 production caller。
- [x] 3.2 删除 `experience-shell-contracts.ts`、compatibility exports 和只保护旧 bridge 的测试；保留现有 owner 的行为覆盖。
- [x] 3.3 记录 C24 可消费的 bridge deletion、replacement、zero-caller 和 rollback receipt。

## 4. Verification and scope guard

- [x] 4.1 验证固定步长调度、Rust/WASM facade、Practice/preview non-official、Arena server evaluation 和课程 runtime 链路未改变。
- [x] 4.2 运行 Arena→Workbench、simulation→return、course-launch、replay/status 的 focused tests 与 1440px/320px 浏览器 smoke。
- [x] 4.3 运行 `rtk npm run typecheck`、`rtk openspec validate retire-simulation-arena-workbench-bridge --type change --strict` 和 `rtk git diff --check`。
