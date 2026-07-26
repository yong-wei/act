# Textbook visual retrieval evaluation decision

## Decision

Do not create a production visual-retrieval change from this experiment.

The text baseline achieved the best overall Recall@10 (`0.70`). Image-only
retrieval reached `0.45`, while multimodal retrieval reached `0.60`. The
multimodal variant produced a meaningful root-locus gain (`0.25` to `0.75`),
but that gain was not stable across strata: block diagrams and response curves
both regressed from `1.00` to `0.50`. The observed benefit therefore does not
justify the additional provider dependency and latency.

## Frozen evaluation inputs

- Source revision: `5a0ddb5141e0c4a4e3fc22d8ffb61101084b6ddb`
- Candidate population: 100 reviewed illustrations, 20 in each of five strata
- Queries: 20, four in each stratum, with one accepted illustration per query
- Candidate population hash:
  `sha256:182ccb9a50ab8a0a64f09f382af3273ddec53c9501e4c6ab705a9b7424989b3f`
- Sample hash:
  `sha256:0ebb32b93d39b7754e2faa206bd352700aae203abbd93dfc03ad546361b17d9e`
- Benchmark hash:
  `sha256:d7c444e56b7e3233c154dbd86fa4f12e9da017ed89a1b1a1642a793d67bab5b2`
- Full canonical report: `evaluation-report.json`
- Full report SHA-256:
  `bf29edb3f78c2e863d6ab515b0a9b8060e93ad52a99996fe02e36351ba2fc9c0`

The final run used a cold cache. All 85 provider operations report
`cacheHit=false`, all have distinct safe trace identifiers, and the report
contains no provider failures.

## Results

| Variant | Overall | Block diagram | Frequency domain | General | Response curve | Root locus | End-to-end latency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Text | 0.70 | 1.00 | 0.50 | 0.75 | 1.00 | 0.25 | 7,891 ms |
| Image | 0.45 | 0.00 | 0.50 | 0.75 | 0.50 | 0.50 | 40,861 ms |
| Multimodal | 0.60 | 0.50 | 0.50 | 0.75 | 0.50 | 0.75 | 55,860 ms |

Total evaluation latency was 64,608 ms. The 85 calls consumed 199,035
provider-reported tokens: 103,399 text-candidate, 71,730 image-candidate,
22,132 description-candidate, 791 text-query, and 983 visual-query tokens.
The account endpoint resolved the balance delta as `0.0000 CNY`; this is the
observed resolution of that endpoint, not evidence that the service is free.

## Representative behavior

- Root-locus queries `rl-01` and `rl-03` moved from text ranks 80 and 11 to
  multimodal rank 1. This explains the only clear stratum-level gain.
- For block diagrams, `bd-03` and `bd-04` were text rank 1 but multimodal ranks
  70 and 31. Image-only retrieval missed every block-diagram answer at top 10.
- For response curves, `rc-01` and `rc-03` were text ranks 7 and 1 but
  multimodal ranks 77 and 22. The visual channel therefore removed useful
  textual discrimination in two of four cases.
- General illustrations were unchanged at the aggregate level (`0.75`) and do
  not offset the extra latency.

The multimodal candidate vector is a deterministic normalized mean of two
separate Qwen vectors: the image vector and its description vector (or title
when the description is absent). This experiment does not claim support for a
provider-specific joint image-and-text input object.

## Verification and residual limits

- Dataset and report validators bind the sample, benchmark, candidate
  population, source revision, cold-cache operations, rankings, metrics,
  latency, cost, and safe traces.
- Production isolation checked 2,465 production files and found zero
  references to the experiment index, cache, or evaluation dependency.
- A preliminary non-final run exposed nondeterministic duplicate-input vectors;
  identical inputs are now deduplicated before provider calls.
- Independent review found that a warm or partial cache could understate cost
  and latency. Formal evaluation now fails closed unless the cache is empty;
  the final report was regenerated after that correction.
- The sample and query count support a bounded engineering decision, not a
  research-level claim about every textbook or visual-query distribution.

The existing title, description, owning text, structure unit, and illustration
anchor remain the appropriate production retrieval and citation boundary.
