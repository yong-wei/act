---
name: infograph
description: Use when generating, reviewing, or registering per-knowledge-node infographics for this repository, especially when the user names a lesson such as 3-8 and asks which knowledge nodes still lack infographics, asks to generate selected node infographics with Codex-native GPT Image 2, or wants node infographics exported to runtime and mounted in the interactive lesson entry knowledge graph.
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

Only export nodes whose `review.json` has `status: "accepted"`.

## Current Codex Image Generation Facts

Use Codex-native image generation first.

Verified local facts:

- `codex features list` exposes `image_generation` as `stable true`.
- The active session exposes the built-in `image_gen` tool.
- The built-in tool accepts only a `prompt` field in this environment.
- The built-in tool does not expose direct `model`, `quality`, `size`, `reasoning_effort`, or `output_format` parameters.
- Codex-native image generation may save images under `~/.codex/generated_images/<thread_id>/ig_*.png`; if no file appears, use the image returned in the session and register the saved image path manually.

Verified OpenAI API facts:

- Official model docs list `gpt-image-2` and snapshot `gpt-image-2-2026-04-21`.
- API usage can call `model="gpt-image-2"` for image generation/edit.
- API parameters are more explicit than Codex-native generation, including size, quality, background, and output format.
- Image generation does not expose a separate reasoning-depth parameter. Reasoning effort belongs to text/reasoning models; for image generation, express planning and quality requirements in the prompt.

If `OPENAI_API_KEY` is missing, do not attempt API generation. Use Codex-native image generation.

## Workflow

### 1. List Missing Node Infographics

Run:

```bash
python3 .codex/skills/infograph/scripts/list_missing_infographs.py --lesson <lesson>
```

Report the 1-based sequence number, `node_id`, node name, group, and current status.

### 2. Prepare One Node

Run:

```bash
python3 .codex/skills/infograph/scripts/prepare_infograph_source.py --lesson <lesson> --node <node_id>
```

This writes `source.json` and `prompt.md`. The prompt must use repository facts only:

- the knowledge card
- lesson `sequence.json`
- lesson/base graph nodes and relations
- lesson manifest

If graph node JSON is missing but the knowledge card exists, proceed from the card frontmatter and body instead of blocking.
For card-only fallback, extract clean fields from `**一句话定义**`, `**核心直觉**`, and the first display formula; do not put the whole `## 首页` section into the definition.
Do not let the image model invent facts, formulas, examples, or relations.

### 3. Generate With Codex-Native GPT Image 2

Open `prompt.md`, then call the built-in image generation tool with exactly that prompt content.

In this Codex environment, the direct tool call is:

```text
image_gen.imagegen({ "prompt": "<prompt.md content>" })
```

Because the tool schema only accepts `prompt`, model selection and quality controls are not set as formal parameters. Include these constraints inside the prompt:

- use GPT Image 2 / latest Codex-native image generation
- landscape infographic
- treat the output as a visual teaching asset, not a flat electronic knowledge card
- combine at least one concrete visual object with one abstract control diagram when the source supports it, for example ship heading, water tank, compass, dashboard, Bode plot, root locus, Nyquist curve, step response, or frequency-band panel
- use layered composition: a main visual scene or metaphor, small technical insets, concise formula anchors, and a boundary or judgment panel
- clean Chinese typography
- render concise formula anchors when they are central to the node; GPT Image 2 has been locally verified to render typical control formulas such as `G(s)=1/s`, `G_{PI}(s)=K\frac{T_i s+1}{T_i s}`, `G_{lag}(s)=K\frac{Ts+1}{\beta Ts+1}`, and `M_p=e^{-\frac{\zeta\pi}{\sqrt{1-\zeta^2}}}\times100\%` accurately enough for infographic use
- do not render prompt metadata such as lesson id, group name, knowledge type, source-truth labels, or instruction labels into the image
- do not render source labels such as `关键公式锚点` or `公式锚点`; render only the formula itself and nearby short meaning labels
- convert definitions into short labels instead of copying long source sentences into the artwork
- keep visible text compact: no more than about 12 labels, each preferably under 10 Chinese characters, with no explanatory paragraphs
- translate relation labels to Chinese before generation
- no invented labels
- no decorative text or imagery unrelated to the source; visual richness must explain mechanism, evidence, or boundary
- no hard-coded visual requirement from a previous node; the visual skeleton must match the current node name and lesson group

### 4. Register The Image

If the image is saved under `~/.codex/generated_images`, run:

```bash
python3 .codex/skills/infograph/scripts/register_infograph.py --lesson <lesson> --node <node_id> --latest-codex-image
```

If the image was saved elsewhere, run:

```bash
python3 .codex/skills/infograph/scripts/register_infograph.py --lesson <lesson> --node <node_id> --image /absolute/path/to/image.png
```

Use `--accept` only after visual review confirms that:

- all visible Chinese text is correct
- formulas are not malformed
- arrows and relationships match `source.json`
- no unsupported factual claim was added
- the image contains concrete visual evidence or a meaningful visual metaphor, not only text boxes and arrows
- technical insets such as plots, instruments, or physical examples help explain the mechanism rather than serving as decoration
- the graphic is readable at lesson-entry card size

### 5. Review And Export

Run:

```bash
python3 course-content/scripts/review_lesson_content.py --lesson <lesson> --strict-implementation-contract
python3 course-content/scripts/export_runtime.py <lesson>
```

The review writes `runtime/lessons/<lesson>/review/infograph-check.json`.
Runtime export copies accepted node infographics and mounts them into runtime knowledge node resources.

## Prompt Policy

For concept nodes, prefer a visual teaching-asset composition:

1. main visual object or engineering scene
2. mechanism inset or mathematical diagram
3. formula or short symbolic anchor
4. boundary, misconception, or design judgment panel

Avoid generating images that look like an electronic note card with icons. The advantage of image generation is the ability to combine scene, object, diagram, material, and art direction in one frame. Use that ability deliberately.

For formula-heavy nodes, let GPT Image 2 render the exact key formula anchors when the formula is central to the concept. Keep the formula count small, usually one or two equations, and place formulas in uncluttered white space. Do not preemptively suppress formulas just because they contain fractions, subscripts, Greek letters, integrals, or exponentials; the local 2026-04-28 test showed these render acceptably. Still reject or regenerate any image whose formula is malformed, truncated, or semantically changed.

For reused nodes from older lessons, explain the current lesson usage in `source.json`, but do not overwrite the node's original lesson truth.

Do not reuse a node-specific phrase such as “左半平面零点改变主导极点路径” for unrelated nodes. If several generated images show the same wrong phrase, fix `prepare_infograph_source.py` before regenerating more images.

For `幅角原理`, center the visual on origin winding and zero-pole counting (`N=Z-P`), not on the Nyquist `-1` point. The `-1` point belongs to the Nyquist stability criterion.

When a node name is Bode/frequency/margin-specific (`截止频率`, `穿越频率`, `幅值裕度`, `相角裕度`, `带宽`), use Bode axes and margin markers even if the lesson group also mentions Nyquist.
For `带宽`, center the visual on the closed-loop magnitude curve and the `-3 dB / ω_b` boundary; do not reduce it to a generic three-band chart.

For `奈奎斯特与 Bode 统一判稳链`, show both views: Nyquist `-1` critical point and Bode `0dB / -180°` markers connected to the same stability boundary.
For `目标驱动超前校正`, use the design chain `目标裕度/目标频带 -> 补角 -> 参数 -> 时域验收`; do not draw only a generic three-band chart.
For comprehensive/readback nodes, prefer the chain `频域指纹 -> 判稳余量 -> 三频段任务 -> 闭环读回`; do not stop at a generic low/mid/high frequency split.
For `主导极点`, draw only a stable closed-loop pole map: all poles must be in the left half-plane. The concept is not meaningfully discussed as a design heuristic for an unstable closed-loop case, so do not place any closed-loop pole in the right half-plane. Highlight the pole pair or group closest to the imaginary axis, with slower decay and dominant response contribution; de-emphasize farther-left poles.
