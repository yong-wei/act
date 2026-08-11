# Issue #1179：最新稳定 ActKG Aggregate binding

```text
status=PASS
protocol=act-latest-stable-aggregate-binding/1
selection_policy=LATEST_STABLE_AGGREGATE
release_id=ctr:release:control-theory-engineering-v0.9
release_version=control-theory-engineering-v0.9
bundle_revision=2
bundle_id=ctb:control-theory-engineering-v0.9:r2
actkg_main_commit=cb5b084acaec1dead6d2a5db19b4a4027815ce02
source_commit=83a0da8ca9944befcac9808812104b45bfb44eb2
source_tag=control-theory-engineering-v0.9-r2-source
packaging_commit=9ccbfdbf6bd455c70ecb9e8921755ec01496e2fd
stable_tag=control-theory-engineering-v0.9-r2
release_hash=bf885accc94ad95fea40a042600181606e076625ea3e9e6452137c261e4b1f92
source_dataset_hash=0e95d1e683c31ba503293c6a67f7446efcb36f101ffcc9b64c088f28d70ebd0a
bundle_digest=25eccfea581c79a83fa95ec9dd08fa98a9eeae1cc27da1d8549b57d1bf52c6b6
manifest_sha256=6446af841fefcfc356cb763639da06c0eb82d9fd39ad2ce2d39dee73c3667987
sha256sums_sha256=873b9812879b3ce1c11e759e2605ce4da75b7bec62925db7fefa0cfe78f2bdfc
validation_report_sha256=82ba6974ed23f9310f55727e52834171574f87f432f05ce490f351985ea84dec
schema_version=0.2.0
schema_sha256=3598f0c89f1f32ff1812e823454a17502873ccb5e9577656e6485a7e030233de
predecessor_bundle_id=ctb:control-theory-engineering-v0.8:r3
candidate_chain=["ctb:control-theory-engineering-v0.3:r2","ctb:control-theory-engineering-v0.4:r3","ctb:control-theory-engineering-v0.5:r3","ctb:control-theory-engineering-v0.6:r3","ctb:control-theory-engineering-v0.7:r3","ctb:control-theory-engineering-v0.8:r3","ctb:control-theory-engineering-v0.9:r2"]
candidate_chain_endpoints=["ctb:control-theory-engineering-v0.9:r2"]
statistics={"component_count":9,"knowledge_nodes":4891,"projection_links":2409,"projection_nodes":4891,"published_relations":2409,"rag_crosswalk_rows":9504,"relation_type_count":9,"release_entries":7417}
bundle_path=releases/control-theory-engineering-v0.9-r2
predecessor_root_closure={"path":"docs/coordination/m1j/v0.3-r1-predecessor-closure.json","artifactHash":"41745f666ae98bc7944bb9d5c5fd0045e3b06043df7e87b61d198bc4cb540138","bundleId":"ctb:control-theory-engineering-v0.3:r1","sha256sumsSha256":"f600413e68f2bcb69416b4a76ac2dabcf0838f76dc0a7a483ab1e43abbc9dc95","protocol":"actkg-legacy-predecessor-root-closure/1","algorithm":"sha256sums-legacy-exact-root/1","authorityProtocol":"ctkg-m1k-v1d-predecessor-closure/1"}
admitted_endpoint={"protocol":"actkg-admitted-endpoint/1","releaseSetId":"actkg-authoritative-candidate-v2","releaseId":"control-theory-engineering-v0.2","releaseVersion":"control-theory-engineering-v0.2","releaseHash":"3a897438ad8ff2ea5154befb1f8b6c783d843b430a39a128c654ebfa10ac2ffd","sourceDatasetHash":"0468a685d93ea6a727444ff1464b8c3472dc18014d4c4f6a834e33218c2dae6c","projectionId":"ctr:projection:control-theory-engineering-v0.2:domain-v2","projectionDigest":"f324255fd77cf5bf3bacf4cc55a7a082faca3339fff2b8410ddca37a00226255","candidateState":"CANDIDATE"}
resolved_at=2026-08-01T09:56:12.453Z
resolution_digest=203ce8a45352b66c67911c4e798e71e54e0686b00cf15c1659351d41db03c17e
```

## 门禁

```text
LATEST_STABLE_AGGREGATE_RESOLUTION_GATE=PASS
LATEST_BUNDLE_INTEGRITY_GATE=PASS
LATEST_CANDIDATE_IMPORT_GATE=NOT_RUN
LATEST_DELTA_RECEIPT_ALIGNMENT_GATE=NOT_RUN
LATEST_COURSE_COVERAGE_ALIGNMENT_GATE=NOT_RUN
PRODUCTION_SELECTOR_CHANGE=0
GRAPH_RAG_SELECTOR_CHANGE=0
TEACHING_RELATION_GENERATION=NOT_RUN
PROJECTION_GENERATION=NOT_RUN
ATTESTATION_GENERATION=NOT_RUN
```

本工件只冻结动态解析结果，不表示 ACT 已完成候选导入、Delta 或 CourseCoverage。
