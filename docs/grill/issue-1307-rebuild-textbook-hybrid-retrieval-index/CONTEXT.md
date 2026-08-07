# 教材混合检索索引重建语境

本语境描述教材资源包、混合检索索引、Loader Schema 与配置锁之间的版本一致性，范围限定为 `Issue #1307`。

## 语言

**教材资源包**：
由 `textbooks-v2` 构成的运行态教材源，是重新生成索引的唯一输入真源。
_避免_：教材文件、runtime 目录、本地缓存

**混合检索索引**：
由 `windows`、`segments`、`manifest` 与 index metadata 组成的检索产物，必须与教材资源包和 Loader Schema 属于同一版本。
_避免_：旧版索引、索引缓存

**Loader Schema**：
运行态加载混合检索索引的字段契约，当前要求 `segments` 等字段；修复不得绕过该契约。
_避免_：Loader 代码细节、校验开关

**配置锁**：
记录当前正式采用的 `sourceRevision` 与 `selectedIndexManifestHash` 的配置，必须与重新生成的索引 manifest 一致。
_避免_：环境变量、临时锁、示例值

**运行时引用**：
索引窗口指向的教材来源标识，必须能被当前教材资源包解析。
_避免_：错误引用、缺失章节、旧窗口
