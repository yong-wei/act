本次交付是 fail-closed 发布/解析合同：ESA PoC 与流量基线均为 incomplete，因此不发出生产 ESA URL，也不执行阿里云上传或应用部署。

## 1. Freeze the first asset cohort

- [x] 1.1 Capture the implementation commit/tree and enumerate the seven Git-managed original simulation GLBs plus every declared optimized output as included or excluded.
- [x] 1.2 Define `browser-delivery-manifest.v1` and publication/routing receipt schemas with source, generator, output, eligibility, key, cache/Range, fallback, tool, and denominator identities.
- [x] 1.3 Capture the optimizer name/version/configuration and update the optimized-model validator to prove each generated output against its exact Git source.
- [x] 1.4 Generate deterministic manifest data and typed registry input; reject filename-only, untracked-provenance, mismatched, duplicate, or unsupported assets.

## 2. Implement append-only Delivery publication

- [x] 2.1 Implement a publisher restricted to included public GLB entries, `act-course-delivery`, and derived `assets/<sha256>/<safe-basename>.glb` keys.
- [x] 2.2 Implement conditional no-overwrite upload, exact existing-object metadata reuse, full set verification, and terminal receipt creation.
- [x] 2.3 Add negative tests for arbitrary Bucket/key, non-GLB types, Runtime/knowledge/assessment prefixes, mutable overwrite, partial metadata, and incomplete cohorts.
- [ ] 2.4 Publish and verify the full qualified cohort without changing any application URL.

## 3. Centralize model resolution and fallback

- [x] 3.1 Introduce one shared logical model registry/resolver generated from the validated Delivery manifest.
- [x] 3.2 Require matching qualified ESA PoC, traffic baseline, manifest, and publication receipts before emitting an ESA-first production candidate.
- [x] 3.3 Preserve same-origin optimized and original candidates, local-development defaults, load progress, parse/integrity failure handling, and automatic ordered fallback.
- [x] 3.4 Migrate all seven simulation components/profiles and hard-coded path tests to the shared resolver without changing the Rust/WASM drive chain.

## 4. Verify asset and scene behavior

- [ ] 4.1 Verify exact Delivery URL, full-object SHA-256, size, media type, CORS, `206`/`Content-Range`, cache MISS-to-HIT, and negative-key behavior for every included model.
- [ ] 4.2 Run all seven simulation scenes in browser tests and verify progress, successful ESA load, forced local fallback, visual equivalence, and unchanged simulation state/evidence behavior.
- [x] 4.3 Run the optimized-model validator, focused simulation tests, local typecheck, production build, and strict OpenSpec validation.
- [ ] 4.4 Produce a before/after traffic observation that reports ECS, OSS, and ESA classes without double counting or hiding unresolved bytes.

## 5. Activate and preserve rollback

- [ ] 5.1 Deploy the exact qualified application/manifest revision with ESA-first resolution and same-origin fallbacks intact.
- [ ] 5.2 Emit a routing receipt only after all model, scene, fallback, traffic, and production health checks pass.
- [x] 5.3 Rehearse local-first rollback and verify it does not require deleting Delivery objects, image-local assets, Runtime data, or changing Runtime selectors.
- [x] 5.4 Retain prior application/fallback assets and immutable Delivery objects through the DNS/cache/rollback observation window.
- [x] 5.5 Confirm no video, audio, PDF, WASM, private media, Runtime, knowledge, assessment, or pull-request CI scope entered the change.
