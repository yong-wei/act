## Decision

不把应用部署与 Runtime 发布合并为一个锁域。Runtime activator 在 consumer smoke 前后捕获同一套部署身份：app 与 worker 的 image/revision 一致性，以及数据库迁移集摘要。前一快照必须与 proof capture 的事实完全相同；随后既有 proof verify 继续在选择前验证当前环境。这样覆盖 smoke 期间的应用或迁移漂移，且不改变独立发布边界。

## Failure handling

任一快照失败或两份身份不同都发生在 lifecycle desired/selector 修改前，激活器的既有错误恢复保留原 active 与 rollback Runtime。
