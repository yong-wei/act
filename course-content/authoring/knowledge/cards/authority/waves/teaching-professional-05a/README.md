# 专业第五批：李雅普诺夫稳定性十五张

15张已通过独立领域审核并接入本地b46，累计398/458。审查范围为本批15张正文及来源/模型工件；未发现新的P0/P1重大问题。此前没有本批待修复finding。MIT补充来源未冻结本地网页的非阻断限制记录在content-review.md。

## 本地运行态

- Binding release：control-theory-engineering-v0.48-b46。
- Binding hash：1891c58e4595e8f37259107b2126a002fcb246813cb7238089eb4287f86e1b8b。
- Projection：proj-1f7a5f8a9a60639512c1bf45a96c55acd9cef8b964c5931f7f1f92060493a392。
- 核心343、专业55，剩余60张。未发布服务器，未写学习者完成状态。本批无旧资源或文件退役。
- 15张目标均纳入既有“稳定性概念与边界”，保留12步路径预算，使用初学及内存补缺场景验证。

## 验证

- verify-models.py：11组原创模型验证通过；独立审核核对全部正文及60个来源引用/备份哈希。
- verify-content.py：861项检查、15张真实解析、236个公式通过；物化内容与独立审核正文一致。
- verify-author-markdown.ts：15张真实Markdown/KaTeX渲染通过。
- verify-consumption.ts：398/398可执行、图谱检查器可见、被实际生成路径选中，7992个公式与398张Markdown渲染通过；未知绑定端点0、无效目标0。
- verify-http.ts：398条已认证学生页面通过。
- verify-browser.ts：李雅普诺夫稳定性领域→李雅普诺夫方程→卡片正文→自检通过；两张截图已人工视觉检查，无阅读完成操作。
- rtk npm run typecheck：web与worker通过。
- goal-canonical-knowledge.test.ts：1个测试文件、1项测试通过；映射文件eslint通过。
- 指定OpenSpec变更strict验证通过；git diff --check通过。

## 后续

第六批teaching-professional-06a已选择七张最优控制基础卡，保存精确来源与旧作者卡备份、补充教学参考及待复核模型方案；尚未制作正文或接入。
