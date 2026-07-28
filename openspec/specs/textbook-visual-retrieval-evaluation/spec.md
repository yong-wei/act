# textbook-visual-retrieval-evaluation Specification

## Purpose

Define the bounded, reproducible comparison used to decide whether textbook
illustration image or multimodal embeddings justify a separately governed
production retrieval change.

## Requirements
### Requirement: Textbook illustration retrieval is evaluated with stratified samples

The system SHALL evaluate textbook illustration retrieval on a reviewable sample stratified across block diagrams, response curves, root-locus plots, frequency-domain plots, and general instructional illustrations. Each sample SHALL retain its textbook edition, owning textbook structure unit, illustration anchor, title, and available description.

#### Scenario: The evaluation sample is assembled

- **WHEN** the visual-retrieval evaluation dataset is generated
- **THEN** it contains samples from every declared illustration stratum
- **AND** every sample resolves to its owning textbook structure unit and illustration anchor

### Requirement: Text, image, and multimodal retrieval use one comparison contract

The evaluation SHALL run the same labeled queries against a text baseline built from illustration titles, descriptions, and owning text; an image embedding produced by `Qwen/Qwen3-VL-Embedding-8B`; and a multimodal image-plus-description embedding. The three variants SHALL use the same candidate population, accepted-answer labels, and Recall@10 calculation.

#### Scenario: A labeled query is evaluated

- **WHEN** a query is included in the illustration retrieval benchmark
- **THEN** all three retrieval variants run against the same eligible illustrations
- **AND** their Recall@10 results are computed from the same accepted answers

### Requirement: The evaluation records operational cost and retrieval value

The evaluation SHALL report overall and per-stratum Recall@10, end-to-end latency, external-service cost, and representative failure types. A recommendation to build a production visual index SHALL require stable and explainable improvement over the text baseline in representative illustration strata.

#### Scenario: Visual retrieval improves only an isolated example

- **WHEN** the image or multimodal variant improves one query but does not show repeatable per-stratum benefit
- **THEN** the evaluation SHALL NOT recommend production visual indexing
- **AND** the report records the isolated improvement as a non-adopting result

### Requirement: Visual retrieval evaluation remains outside production runtime

The evaluation artifacts, indexes, and caches SHALL NOT be consumed by production textbook retrieval. Completion or failure of the experiment SHALL NOT block structured textbook runtime, text hybrid retrieval, citation, reader, or Konling integration delivery.

#### Scenario: The text retrieval series is ready before the experiment concludes

- **WHEN** the production text retrieval, citation, and reader acceptance criteria pass
- **THEN** those changes may proceed without waiting for the visual experiment
- **AND** no visual experiment artifact is required by the production application

### Requirement: Production adoption requires a separate governed change

If the evaluation demonstrates material visual-retrieval value, production indexing and retrieval integration SHALL be proposed in a separate OpenSpec change. If it does not, the platform SHALL retain text retrieval plus illustration titles, descriptions, owning text, and anchors without adding a production visual dependency.

#### Scenario: The experiment demonstrates a repeatable gain

- **WHEN** the final report recommends production visual retrieval
- **THEN** the recommendation identifies the proven strata, measured benefit, cost, and latency
- **AND** production code remains unchanged until a separate change is approved
