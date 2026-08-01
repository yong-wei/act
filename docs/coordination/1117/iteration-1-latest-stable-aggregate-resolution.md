# Issue #1117 Recovery Iteration 1：最新稳定 Aggregate 解析

```text
status=PASS
selection_policy=LATEST_STABLE_AGGREGATE
release_id=ctr:release:control-theory-engineering-v0.7
bundle_id=ctb:control-theory-engineering-v0.7:r1
resolution_digest=91cfe889f8c5329e6c26fc146062498e1fe8157f3e7887f92da943a8c9febc7f
```

## 不可变身份

```text
actkg_main_commit=034ee80a76a88562ada10d23f4b406f86cc0193a
source_commit=ef432d0faebb012b19382d71264d9b3e6a83440e
source_tag=control-theory-engineering-v0.7-source
packaging_commit=b1287a277735af9809c6c14e6daf881b716015be
stable_tag=control-theory-engineering-v0.7
release_hash=e46f854d7a05fd4ec840c5eaff69288e7ce34cb2119da501913cbf457ce91f8e
source_dataset_hash=21e957c750c29efaae3b7ec5d70f8155cc33221dae5faec24f3fda1d59c4f31c
bundle_digest=ad33ec039239fc89ff6d74aaa48daedab826344b84742d2a6563f6ae2a9ef1bc
manifest_sha256=14a54e0abd1bc1b7f7f35b0da6304b51dc364481ba194c0a81ca17fa5a0dc44d
sha256sums_sha256=ccadc2fe58d6492d1a7c2a4819081ccd1f75e1c2f21e74f4dbfce8d093d15a4f
validation_report_sha256=7b380e304a8717e6b4c76b6070a090ce6f2a8dee874143134cf8120ed8f83960
```

候选链：`ctb:control-theory-engineering-v0.3:r2` → `ctb:control-theory-engineering-v0.4:r1` → `ctb:control-theory-engineering-v0.5:r1` → `ctb:control-theory-engineering-v0.6:r1` → `ctb:control-theory-engineering-v0.7:r1`

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
