# 专业第六批：最优控制基础七张

7张已通过独立领域审核并接入本地b47，累计405/458。审查范围为本批7张正文及来源/模型工件；未发现新的P0/P1重大问题。无未解决阻断finding。空Authority描述仅负责身份，定理支持来自冻结补充教材，详见content-review.md。

## 接入与目标

- Binding release：control-theory-engineering-v0.48-b47。
- Binding hash：73aa8208b47723e0f7c0656fcd04a29544821287dc37dbb3a0ae1e56973180f7。
- Projection：proj-b10ef0e4a9b2b571648e6986a198f73f6126018c06888ff0a8d4a9a1c164f2e5。
- 新增“最优控制基础”目标，七张均绑定其精确Canonical端点；服务端、客户端与ID目录一致，保留既有路径与证据语义。
- 核心343、专业62；剩余53张。未发布服务器，未写学习者完成状态，无旧资源或文件退役。

## 验证

- verify-models.py：七组精确分数模型及冻结参考哈希通过；独立审核确认必要条件、充分性证明、端点条件和符号转换。
- verify-content.py：361项检查、7张真实解析、91个公式通过；物化正文与审核哈希一致。
- verify-author-markdown.ts：7张真实Markdown/KaTeX渲染通过。
- verify-consumption.ts：405/405可执行、图谱检查器可见且被实际路径选中，8083个公式与405张Markdown渲染通过，未知端点0、无效目标0。
- verify-http.ts：405条已认证学生页面通过。
- verify-browser.ts：权威最优控制领域→动态规划→卡片正文→自检通过；两张截图已检查，没有阅读完成操作。
- rtk npm run typecheck：最终目标注册版本web与worker均通过。
- 三个目标目录/映射Vitest文件共4项测试通过；修改的目标目录、注册、映射及测试文件eslint通过。
- 新目标测试曾检出前后端排序差异，已统一排序并更新29个目标的预期，定向复测通过。
- 指定OpenSpec strict与git diff --check通过。

## 后续

第七批八张二次型控制与端点条件已准备来源、模型并写前三张正文；未审核接入。详见teaching-professional-07a。
