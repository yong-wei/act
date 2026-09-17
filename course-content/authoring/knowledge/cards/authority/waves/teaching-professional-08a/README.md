# 专业第八批：离散模型与控制作用七张

7张完成独立领域审核与一次限定整改复核，接入本地b49，累计420/458。首次P1为将负反馈中的正比例增益误写成正反馈增益；已接受并修正，原审核者定向复核通过，未发现整改直接引入的新P0/P1。

## 本地接入

- Binding release：control-theory-engineering-v0.48-b49。
- Binding hash：0ad383e72fc22b94781ece6d36dde289dc5648b7d7fc63b2c1f3e6c82bfef016。
- Projection：proj-6abc5884f0229909532becadaf9dbe86d6540ddf15db6b3b344b8c0dab2af43e。
- 目标：既有离散控制基础；保留不同领域的独立Canonical身份。
- 核心343、专业77，剩余38张。未发布服务器、未写学习者完成状态，无旧资源退役。

## 验证

- verify-models.py：7组原始动态、精确矩阵与控制器递推通过。
- verify-content.py：392项检查、7张真实解析、58个公式通过；物化正文与整改后审核哈希一致。
- verify-author-markdown.ts：7张真实Markdown渲染通过。
- verify-consumption.ts：420/420可执行、图谱检查器可见且被实际生成路径选中，8240个公式及420张Markdown渲染通过；未知端点0、无效目标0。
- verify-http.ts：420条已认证学生页面通过。
- verify-browser.ts：数字设计领域→采样周期→正文→自检通过，两张截图已检查，无阅读完成操作。
- rtk npm run typecheck：web与worker通过。三个目标目录/映射测试文件共4项测试通过，目标映射eslint通过。
- 冻结来源如实保留MathWorks原页无法本地下载的限制；未冒充原页快照。

第九批6张数字补偿器正文与模型已完成，独立审核进行中。第十批最小拍与采样间行为7张已捕获来源。
