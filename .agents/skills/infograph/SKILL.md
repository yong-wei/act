---
name: infograph
description: 使用 GPT Image 2.5 制作或修订知识节点信息图，并审核、注册与导出。
---

# Infograph

## Purpose

This skill manages one infographic per knowledge node under `course-content/authoring/knowledge`.
It follows the knowledge-card model: authoring is the source of truth, review gates the asset, and runtime export mounts reviewed assets automatically.

Use this skill for requests like:

- `生成 3-8 的知识点信息图`
- `列出 4-5 尚未生成信息图的节点`
- `为第 1、3 个节点生成信息图`
- `把信息图挂载到互动课程入口或全局知识图谱`

## Storage Contract

Canonical node table:

```text
course-content/authoring/knowledge/canonical-nodes.json
```

Use this table as the source of truth before preparing or registering an
infographic. If the requested node id is an alias, resolve it to
`canonical_node_id`. If the canonical entry already has an accepted
`selected_infograph`, do not regenerate the node; reuse the recorded asset.
If the canonical entry has no `selected_infograph` but its `owner_lesson`
already contains an accepted infographic for the canonical node id, do not
generate a lesson-local duplicate. Reuse the owner asset and add an explicit
`selected_infograph` entry when export needs an unambiguous canonical choice.

Authoring node infographic directory:

```text
course-content/authoring/knowledge/infographs/lessons/<lesson>/nodes/<node_id>/
  source.json
  prompt.md
  generation.json
  review.json
  infograph.png
```

Runtime export target:

```text
course-content/runtime/knowledge/infographs/nodes/<node_id>.png
course-content/runtime/knowledge/infographs/manifest.json
```

The runtime `<node_id>` is always the canonical node id. Lesson-scoped
authoring directories may remain under the unit where the asset was produced,
but runtime export must mount only one selected asset per canonical node.

Only export nodes whose `review.json` has `status: "accepted"`.

## GPT Image 2.5

New generation and edits target GPT Image 2.5. Read [model, reference-image and edit guidance](../imagen/references/gpt-image-2.5.md). The current Codex tool supports reference-image editing but does not expose model selection; do not confuse the requested family with a reported model.

Final infographic assets must come from image generation or image editing, not programmatic drawing. Scripts may prepare source, prompts, metadata and exports. Scientific computation may supply validated reference geometry; it does not replace generation of the final asset. Leave failed images unaccepted.

Historical accepted assets remain reusable. Do not relabel their original model or regenerate them merely because the project default changed. For explicitly requested revisions of an accepted canonical asset, save a separate candidate and preserve the selected original; the existing registration guard does not authorize overwriting it.

## Workflow

### 1. List Missing Node Infographics

Run:

```bash
python3 .agents/skills/infograph/scripts/list_missing_infographs.py --lesson <lesson>
```

Report the 1-based sequence number, `node_id`, node name, group, and current status.

### 2. Prepare One Node

Run:

```bash
python3 .agents/skills/infograph/scripts/prepare_infograph_source.py --lesson <lesson> --node <node_id>
```

This writes `source.json` and `prompt.md`. The prompt must use repository facts only:

- the knowledge card
- lesson `sequence.json`
- lesson/base graph nodes and relations
- lesson manifest

If graph node JSON is missing but the knowledge card exists, proceed from the card frontmatter and body instead of blocking.
For card-only fallback, extract clean fields from `**一句话定义**`, `**核心直觉**`, and the first display formula; do not put the whole `## 首页` section into the definition.
Do not let the image model invent facts, formulas, examples, or relations.

### 3. Generate or edit with GPT Image 2.5

Read `prompt.md` and check its facts against `source.json`. Choose the composition from the learning goal; use [teaching composition guidance](../imagen/references/infographic.md) when needed. A mathematical concept may use a pure diagram; physical scenes and technical insets are optional when they aid understanding.

For a new image call `image_gen.imagegen({ "prompt": "<exact prompt>" })`. For a local correction, view the original and supply its path in `referenced_image_paths`; specify the correction and details to preserve. Never pass unsupported model/quality/size fields. Save each candidate and its exact prompt before accepting it.

Render exact concise labels, formulas and units from the source. Do not render lesson ids, source field names, prompt headings or relation identifiers as visible text. Text density follows legibility and instructional need, not a mandatory count of panels or labels.

### 4. Register The Image

Prefer `--image` with the exact output path. Only after identifying the current call’s image may legacy newest-image discovery be used:

```bash
python3 .agents/skills/infograph/scripts/register_infograph.py --lesson <lesson> --node <node_id> --latest-codex-image
```

If the image was saved elsewhere, run:

```bash
python3 .agents/skills/infograph/scripts/register_infograph.py --lesson <lesson> --node <node_id> --image /absolute/path/to/image.png
```

Registration records `requested_model` as the project target and leaves `model` null unless `--reported-model` is supplied from actual tool/API response evidence. `--reported-model` records provenance; it does not select a model. For an API-produced image use `--generation-path openai-image-api`.

Use `--accept` only after visual review confirms that:

- all visible Chinese text is correct
- formulas are not malformed
- arrows and relationships match `source.json`
- no unsupported factual claim was added
- the image contains concrete visual evidence or a meaningful visual metaphor, not only text boxes and arrows
- technical insets such as plots, instruments, or physical examples help explain the mechanism rather than serving as decoration
- the thumbnail communicates the topic, and exact text/formulas are readable in the actual expanded preview; do not claim all detail is readable in a small thumbnail
- `generation.json` records an actual image-generation path, not a
  programmatic drawing fallback

### 5. Review And Export

Run:

```bash
python3 course-content/scripts/review_lesson_content.py --lesson <lesson> --strict-implementation-contract
python3 course-content/scripts/export_runtime.py <lesson>
```

The review writes `runtime/lessons/<lesson>/review/infograph-check.json`.
Runtime export copies accepted node infographics and mounts them into runtime knowledge node resources.
Lesson-entry runtime display must keep infograph thumbnails clickable and open a larger preview dialog; do not rely on the card-sized image as the only readable view.

## Prompt Policy

### Prompt Architecture

Every generated `prompt.md` must describe the image as an executable visual specification, not as a prose request. Include these fields in the prompt body:

- `visual_archetype`: choose one of `科普百科图鉴`, `机制剖面图`, `流程板`, `对比板`, `频域仪表盘`, `s 平面机理板`, or `工程评审板`.
- `layout_contract`: specify canvas ratio, panel count, main visual position, technical inset positions, and reading order.
- `text_contract`: list the exact short labels and formula anchors that may appear; keep visible labels to about 8-12 and prohibit body paragraphs.
- `technical_insets_contract`: add only the insets needed for mechanism, readback or boundary judgment; zero is valid when the main diagram suffices.
- `negative_constraints`: prohibit electronic handout screenshots, generic icon-card layouts, long copied definitions, prompt metadata, and unrelated decoration.

Describe what the learner should understand and the essential geometry, labels and relationships. Panel counts are composition suggestions, not a requirement to add unnecessary content.

### Visual Archetypes

Select the archetype by node semantics:

- `科普百科图鉴`: concept overview nodes with a main object plus modular feature/boundary blocks.
- `机制剖面图`: nodes explaining an internal mechanism, such as integral accumulation, lag compensation, or low-frequency gain shaping.
- `流程板`: design path, procedure, or judgment-chain nodes.
- `对比板`: nodes centered on misconception, trade-off, or two-strategy comparison.
- `频域仪表盘`: Bode, margin, bandwidth, Nyquist/Bode, and frequency-band readback nodes.
- `s 平面机理板`: pole, zero, root-locus, dominant-pole, and stability-plane nodes.
- `工程评审板`: comprehensive synthesis nodes that compare root locus, Bode, step response, and task labels.

For concept nodes, prefer a visual teaching-asset composition:

1. main visual object or engineering scene
2. mechanism inset or mathematical diagram
3. formula or short symbolic anchor
4. boundary, misconception, or design judgment panel

Avoid generating images that look like an electronic note card with icons. The advantage of image generation is the ability to combine scene, object, diagram, material, and art direction in one frame. Use that ability deliberately.

For formula-heavy nodes, let GPT Image 2.5 render the exact key formula anchors when the formula is central to the concept. Keep the formula count small, usually one or two equations, and place formulas in uncluttered white space. Do not preemptively suppress formulas just because they contain fractions, subscripts, Greek letters, integrals, or exponentials; the historical 2026-04-28 GPT Image 2 test is not evidence of GPT Image 2.5 accuracy. Still reject or regenerate any image whose formula is malformed, truncated, or semantically changed.

For reused nodes from older lessons, explain the current lesson usage in `source.json`, but do not overwrite the node's original lesson truth.
When a lesson card supplies its own display formula, use that formula as the primary visible formula in the infographic prompt. Do not add secondary global formulas unless they are needed for the current lesson-specific visual explanation.

Do not reuse a node-specific phrase such as “左半平面零点改变主导极点路径” for unrelated nodes. If several generated images show the same wrong phrase, fix `prepare_infograph_source.py` before regenerating more images.

For `超调量`, the step-response visual must distinguish the reference input from the output steady value. Draw the unit-step reference signal `r(t)=1` as a separate line or inset, draw the actual output steady value as `y_\infty`, and make the final horizontal tail of the response coincide with the `y_\infty` line. Place the `y_\infty` label on that steady-state line, not on a separate curve height. The overshoot bracket must measure `y_{max}-y_\infty`, not `y_{max}` minus the reference input.

For `幅角原理`, center the visual on origin winding and zero-pole counting (`N=Z-P`), not on the Nyquist `-1` point. The `-1` point belongs to the Nyquist stability criterion.

When a node name is Bode/frequency/margin-specific (`截止频率`, `穿越频率`, `幅值裕度`, `相角裕度`, `带宽`), use Bode axes and margin markers even if the lesson group also mentions Nyquist.
For `带宽`, center the visual on the closed-loop magnitude curve and the `-3 dB / ω_b` boundary; do not reduce it to a generic three-band chart.

For `奈奎斯特与 Bode 统一判稳链`, show both views: Nyquist `-1` critical point and Bode `0dB / -180°` markers connected to the same stability boundary.
For `目标驱动超前校正`, use the design chain `目标裕度/目标频带 -> 补角 -> 参数 -> 时域验收`; do not draw only a generic three-band chart.
For comprehensive/readback nodes, prefer the chain `频域指纹 -> 判稳余量 -> 三频段任务 -> 闭环读回`; do not stop at a generic low/mid/high frequency split.
For `主导极点`, draw only a stable closed-loop pole map: all poles must be in the left half-plane. The concept is not meaningfully discussed as a design heuristic for an unstable closed-loop case, so do not place any closed-loop pole in the right half-plane. Highlight the pole pair or group closest to the imaginary axis, with slower decay and dominant response contribution; de-emphasize farther-left poles.
