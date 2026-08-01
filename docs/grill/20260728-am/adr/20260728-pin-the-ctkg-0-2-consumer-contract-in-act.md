---
status: accepted
context: authoritative-knowledge-graph-migration
---

# 在 ACT 中固定 CTKG 0.2 消费合同

ACT 从固定 ActKG 提交取得由上游 Schema 生成的 CTKG 0.2 公开包消费合同，并在仓库中记录上游提交、合同文件哈希和适配器版本。导入过程离线校验 `schema_version`、`SHA256SUMS`、组件身份与哈希，以及 ReleaseEntry、GraphProjection V2、上游 RAG Crosswalk 和组件清单的结构与交叉引用。

ACT 不在构建、数据库迁移或生产运行时安装和调用 ActKG Python 校验器。后续 Schema 变化必须显式增加新的合同快照、适配器和兼容性测试，不能让既有解析器宽松接收未知版本。

该方案保留上游 Schema 血缘和关闭式校验，同时避免 Next.js 部署链路增加跨语言运行依赖。
