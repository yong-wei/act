## 1. Evaluation Dataset

- [ ] 1.1 Inventory runtime illustrations and create a stratified sample of block diagrams, response curves, root-locus plots, frequency-domain plots, and general illustrations
- [ ] 1.2 Preserve each sample's textbook edition, owning structure unit, illustration anchor, title, description, and source image
- [ ] 1.3 Label lightweight visual-retrieval queries and accepted illustrations without changing the production text benchmark

## 2. Retrieval Experiments

- [ ] 2.1 Build the text baseline from illustration titles, descriptions, and owning text
- [ ] 2.2 Generate `Qwen/Qwen3-VL-Embedding-8B` image embeddings for the same sample through SiliconFlow
- [ ] 2.3 Generate image-plus-description multimodal embeddings and run the same queries over the same candidate population
- [ ] 2.4 Record raw ranked results, Recall@10, latency, and external-service cost for all three variants

## 3. Decision Report

- [ ] 3.1 Analyze overall and per-stratum gains and review representative successes and failures
- [ ] 3.2 Document whether visual or multimodal retrieval provides stable, explainable value over the text baseline
- [ ] 3.3 Recommend a separate production change only when the measured gain justifies its cost and latency
- [ ] 3.4 Verify that no experiment index, cache, or dependency is referenced by production runtime code
