## 1. Semantic Benchmark

- [x] 1.1 Build a lightweight GPT-reviewed benchmark covering concepts, formulas, figures, bilingual terminology, and cross-textbook expressions
- [x] 1.2 Record every directly supporting structure unit plus the preferred source for each benchmark query
- [x] 1.3 Create a stratified 80/20 tuning and fixed acceptance split, including the known unit-step-response failure case

## 2. Embedding Selection

- [x] 2.1 Evaluate `BAAI/bge-m3`, `Qwen/Qwen3-Embedding-0.6B`, and `Qwen/Qwen3-Embedding-4B` through SiliconFlow on the tuning split
- [x] 2.2 Compare Recall@10, latency, dimensions, memory cost, and API cost, then fix the selected model and version
- [x] 2.3 Record the selection evidence and keep the fixed acceptance split unused during parameter tuning

## 3. Offline Index Build

- [x] 3.1 Build the Chinese lexical index, normalized contiguous vector matrix, window metadata, and content-offset tables
- [x] 3.2 Cache embeddings locally by model, dimensions, and normalized window-content hash while rebuilding complete runtime indexes
- [x] 3.3 Emit index manifests with model identity, dimensions, content hashes, source-priority metadata, and format version
- [x] 3.4 Verify index references against the structured runtime and reject stale or unresolved units and offsets

## 4. Runtime Retrieval

- [x] 4.1 Load shared read-only index data within the 150 MiB per-process resident-memory budget
- [x] 4.2 Implement lexical and exact-vector candidate retrieval while reading textbook body content only after offset hits
- [x] 4.3 Fuse lexical and vector candidates without allowing retrieval scores to bypass source priority or direct-support adjudication
- [x] 4.4 Call the SiliconFlow reranker for bounded candidate sets and fall back deterministically to local fusion on failure
- [x] 4.5 Fall back to lexical retrieval with explicit development diagnostics when query embedding is unavailable

## 5. Verification

- [x] 5.1 Add index-format, cache-reuse, retrieval, rerank-fallback, and memory-budget tests
- [x] 5.2 Measure external retrieval latency and establish the background wait limit from observed P95
- [x] 5.3 Verify Recall@10 on the fixed acceptance split through `retrieveTextbookHybrid`, including the known failure hit and valid runtime unit resolution for every returned candidate
