# 验证记录

## 本轮范围

基线 `ac699f0957f289d07d8ae48282e3de6482bddf53` 到本change工作区变更。前置 v0.7.34 发布、部署及浏览器验收已完成，见 `artifacts/app-releases/v0.7.34/receipt.json`。本轮没有改写历史清单、Runtime或图谱选择器。

## 已通过的本地验证

- `python3 -m unittest scripts.tests.test_publish_runtime scripts.tests.test_runtime_doctor_gc scripts.tests.test_runtime_media_storage`：28项通过。
- `python3 -m unittest scripts.tests.test_activate_runtime scripts.tests.test_public_teaching_media scripts.tests.test_developer_runtime_gateway`：64项通过。网关HTTP夹具的既有HTTPError清理提示不影响结果。
- 媒体目录、路径、Bound读取、真实SDK适配器、课堂revision和课堂路由六个Vitest文件：71项通过；目录symlink新增回归后该文件7项通过，相关活动清单文件8项通过。未改测试证据复用，合计80项不同测试。
- 生产 `npm run typecheck`：web与worker零错误，收据 `bbd76ed9…` / `4ae4f8bc…`。
- 本轮TypeScript源文件及测试定向ESLint通过；Python编译通过；部署、双helper与配置脚本Shell语法检查通过。
- Docker迁移readiness与remote-deploy脚本回归通过；本change严格OpenSpec验证和 `git diff --check` 通过。

新Python回归覆盖：公开正文直接发布、无变化不重传、Git来源变化复用正文、单文件增量、未接受新图片仍私有、资格漂移与上传失败、GC后旧缓存拒绝及bootstrap、全部保留根、共享正文、范围外模型、坏清单/租约发现、进行中发布与GC互斥、进程中断保留、签名期与时钟倒退、原副本退役、doctor/网关Range读取、恢复副本、旧镜像门禁及损坏目标阻断。

## 只读生产核验

- 生产读取角色为 `act-runtime-oss-read`；开发者网关处于active，持久租约文件存在且schema正确，记录1份租约。未输出令牌或用户标识。
- PostgreSQL实际锁验证：独占锁持有时，同键事务共享锁尝试返回false；释放后返回true。未写入或修改数据库记录。此结果验证锁语义，不代表新代码已部署。
- 现有媒体桶未启用版本控制，Bucket保持私有。来源读取角色对规范媒体对象的Get返回403，需要补足声明前缀的只读权限。
- RAM控制台角色/策略主体加载失败，控制台出现iframe跨域SecurityError；一次重载和同浏览器新页面均未恢复。没有改变云权限、创建凭据、执行正文删除或新Runtime激活。

## 风险审查结论

本轮人工审查覆盖规范位置、资格入口、文件/签名/网关消费、发布与GC互斥、引用发现、复制迁移、恢复和旧镜像门禁。实施期间接受并修复：课堂引用在发现与正文删除之间写入的竞争、开发者心跳持久化与GC竞争、存储保留目录被误识别为Release、准备失败造成目录先提交、以及新helper验证晚于容器替换。上述整改都有直接回归或实际锁证据。

本轮增量审查未发现新的 P0/P1 重大问题。生产权限、双FUSE可见性、完整对象迁移及删除后的真实应用消费仍是未完成的执行验收，不能用本地夹具替代。

## 尚待执行

按两份已保存最小RAM策略核验并处理生产权限；部署支持规范目录的新应用和独立只读媒体挂载；生成绑定当前保护根与完整目标对象快照的迁移计划；验证全部受保护视图及真实消费后，执行原桶精确副本退役并保存实际释放字节与恢复证据。此阶段尚未发生，不将本change归档。
