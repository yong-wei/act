# 专业第七批：二次型控制与端点条件八张

8张已通过独立领域审核并接入本地b48，累计413/458。审查范围为本批8张正文及来源/模型工件，未发现新的P0/P1重大问题，无待整改阻断finding。来源局限与冻结制作前状态的含义见content-review.md。

## 本地接入

- Binding release：control-theory-engineering-v0.48-b48。
- Binding hash：764a01a2617780a19573264c4c26a60ea6f29c5aa5987c3899fbad05217e5198。
- Projection：proj-08efa426cf72a813c98216cecbe35598693607d14a9f8bd6cee9f440fa3c5c95。
- 八张均纳入既有最优控制基础目标；目标内超过12张时，通过原有补缺场景验证，未扩大步数预算。
- 核心343、专业70，剩余45张。未发布服务器、未写学习者完成状态，无旧资源或文件退役。

## 验证证据

- verify-models.py：8组标量模型、Riccati残差、积分成本、闭环极点和冻结来源哈希通过。
- 独立领域审核核对35项来源/备份/冻结参考哈希，确认半正定Q的可检测条件、端点自由度及1/2成本因子一致。
- verify-content.py：396项检查、8张真实解析、99个公式通过，物化正文与已审哈希一致。
- verify-author-markdown.ts：8张真实Markdown/KaTeX渲染通过。
- verify-consumption.ts：413/413可执行、图谱检查器可见且被实际生成路径选中；8182个公式与413张Markdown渲染通过，未知端点0、无效目标0。
- verify-http.ts：413条已认证学生页面通过。
- verify-browser.ts：最优控制领域→LQR→卡片正文→自检通过，两张截图已检查，无阅读完成操作。
- rtk npm run typecheck：web与worker通过。
- 三个目标目录/映射Vitest文件、4项测试通过；目标映射文件eslint通过。
- 指定OpenSpec strict验证沿用本轮第六批后的结果（规范未改变）；最终git diff --check通过。

## 后续

第八批离散模型与控制作用共7张，已完成来源、七组模型及前4张正文；剩余比例、积分、微分三张待制作，整批尚未独立审核。
