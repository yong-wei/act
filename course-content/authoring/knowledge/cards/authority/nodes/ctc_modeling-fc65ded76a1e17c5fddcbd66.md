---
node_id: ctc_modeling-fc65ded76a1e17c5fddcbd66
authority_entity_id: "ctc:modeling-fc65ded76a1e17c5fddcbd66"
name: 求解齐次状态方程的一种方法
name_en: modeling_fc65ded76a1e17c5fddcbd66
category: 程序性
coverage_role: explicit_extension
batch: A
concept_kind: analysis_method
release_tier: silver
tags:
  - analysis_method
  - silver
card_version: 1
source_docs:
  - course-content/authoring/knowledge/releases/control-theory-engineering-v0.12/domain-projection.json
authority_release_id: control-theory-engineering-v0.12
asset_refs: []
---

<!-- authority_source_sha256: d4878d2839e5130a58c3f59f1bdd56a2e542503ba3eba6c33fe512b917d661b8 -->

## 首页

# 求解齐次状态方程的一种方法 | modeling_fc65ded76a1e17c5fddcbd66

**一句话定义**：求解齐次状态方程的一种方法，对状态方程取拉普拉斯变换，得到 $\boldsymbol{X}(s)=(s \boldsymbol{I}-\boldsymbol{A})^{-1} \boldsymbol{x}(0)$，再取反变换得到 $\bo…

**关联**：（权威图邻接待补充）

---

## 详情

### 完整解释

求解齐次状态方程的一种方法，对状态方程取拉普拉斯变换，得到 $\boldsymbol{X}(s)=(s \boldsymbol{I}-\boldsymbol{A})^{-1} \boldsymbol{x}(0)$，再取反变换得到 $\boldsymbol{x}(t)$。

### 关联节点

| 方向 | 节点 | 关系说明 |
|------|------|---------|
| — | — | 权威图中暂无 DomainConcept 邻接 |

### 边界与使用说明

本卡内容严格来自权威发布 `control-theory-engineering-v0.12` 的 DomainConcept 描述与邻接关系（concept_kind=`analysis_method`，release_tier=`silver`）。未在权威源中出现的工程实例与常见误区不在此编造；后续可按证据补全。

### 关键词

analysis_method、silver
