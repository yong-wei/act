# 零极点九卡独立领域审核

范围仅本批九卡、来源、固定模型及验证。审核者 /root/review_core_poles_zeros_nine。

首次发现两项P1：复极点虚部说明含裸pm；开环零点node_id被截短。均ACCEPT并修复；唯一受限复核PASS，两项关闭，未发现整改引入的新P0/P1。详情见review-findings.md。

其余D=0、约简零极点、隐藏不稳定模态、K=1与K=3闭环根、完整环路H、MIMO秩下降和前置滤波关系独立复算正确。来源与真实关系一致。最终接受字节见review-acceptance.json。

整改后的内容870项检查、9parser、254KaTeX、实际Markdown通过。node_id一致性在作者校验和导出前验证，裸pm/qquad在渲染前拦截。运行态消费另行验收。
