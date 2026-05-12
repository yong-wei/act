# 架构索引

状态: active
最后更新: 2026-03-17
摘要: 用于回答“系统是怎么跑起来的”，重点覆盖课堂运行时、鉴权会话、数据模型和资源注册。
上游:
- [../00-index.md](../00-index.md)
下游:
- [10-app-structure.md](10-app-structure.md)
- [20-course-runtime.md](20-course-runtime.md)
- [30-auth-and-session.md](30-auth-and-session.md)
- [40-data-model.md](40-data-model.md)
- [50-resource-registry.md](50-resource-registry.md)
相关:
- [../40-domain/10-lesson-framework.md](../40-domain/10-lesson-framework.md)

## 何时读这里

- 需要改课堂页、课程页、资源渲染器、会话接口
- 需要判断一个功能应该归到 `features`、`resources` 还是 `lib`
- 需要理解 session 与 student state 的数据流
