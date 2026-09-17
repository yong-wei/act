---
name: imagen
description: 使用 GPT Image 2.5 生成或编辑图像，保存图片与精确提示词。
---

# Imagen

## Purpose

Use GPT Image 2.5 through Codex-native image generation or an explicitly selected API model to create polished visual assets from user intent, then save both the generated image and the exact prompt used to create it.

This is a general image-production skill. For repository-specific knowledge-node infographics, prefer the `infograph` skill first; use `imagen` when the request is broader, such as posters, diagrams, product visuals, visual metaphors, UI mockups, editorial images, icons, story scenes, or generic high-quality graphics.

## Output Contract

Default output directory:

```text
<project-root>/generated-images/
```

If the user specifies a path, use that directory instead. Save:

```text
<summary-slug>.png
<summary-slug>.prompt.md
```

Naming rule:

- Use a concise content summary, not a generic timestamp.
- If the user request is Chinese, use a Chinese summary filename, for example `船舶航向控制超调示意.png`.
- If the user request is English, use an English summary filename, for example `ship-heading-overshoot-diagram.png`.
- Keep names filesystem-safe: remove slashes, colons, quotes, and control characters.
- If a filename already exists, append `-2`, `-3`, and so on.

## Model and editing contract

Read [GPT Image 2.5 generation and editing](references/gpt-image-2.5.md) when generating or editing. Keep the target model separate from any model actually reported by the tool. Do not silently use GPT Image 2 or rewrite historical provenance.

## Workflow

### 1. Identify Intent

Classify the request before writing the prompt. Choose one primary reference file:

| User intent | Reference |
| --- | --- |
| information graphic, concept explainer, educational visual, knowledge card replacement | `references/infographic.md` |
| technical diagram, system diagram, mechanism drawing, process schematic | `references/technical-diagram.md` |
| poster, key visual, event visual, course cover, hero artwork | `references/poster-keyvisual.md` |
| product shot, object render, packaging, device, material-focused visual | `references/product-object.md` |
| editorial illustration, metaphor scene, article image, story visual | `references/editorial-scene.md` |
| UI mockup, app screen, dashboard, website visual | `references/ui-mockup.md` |
| icon set, logo-like mark, simple symbolic asset | `references/icon-symbol.md` |

If the request spans multiple types, use the dominant output surface first, then borrow constraints from one secondary reference.

### 2. Collect Constraints

Infer reasonable defaults if the user has not specified them:

- canvas: landscape 16:9 for teaching, posters, dashboards, and general web assets; square for icons and social cards; portrait only when requested or when the use case clearly requires it
- language: visible text should match the user's request language
- style: choose a concrete visual style suited to the object, not a generic "beautiful" style
- text: keep visible text short; avoid paragraphs unless the user explicitly wants a document-like graphic
- facts: do not invent formulas, product claims, people, logos, names, data, or citations
- generation count: generate one image unless the user asks for variants

Ask the user only when a missing choice would materially change the result, such as an unknown target path, brand identity, exact person likeness, mandatory dimensions, or whether text must be visible. Otherwise proceed.

### 3. Write The Prompt

Read the selected reference file and produce an executable visual specification, not a vague art request. A strong prompt should specify:

- subject and purpose
- canvas and composition
- visual hierarchy and focal point
- camera/viewpoint or diagram geometry
- material, lighting, color, and rendering style
- allowed visible text
- required technical details or labels
- negative constraints

State the learning or communication goal and essential visual relationships. Specify exact text and important placement; leave ordinary composition choices open instead of fixing every panel.

### 4. Generate

Call the built-in image generation tool with exactly the final prompt:

```text
image_gen.imagegen({ "prompt": "<final prompt>" })
```

For a new image, omit reference arguments. For an edit, inspect the original, then pass `referenced_image_paths` or the smallest necessary `num_last_images_to_include`, never both. The current tool does not expose model, size, quality or output format parameters; prompt wording does not set those API parameters.

### 5. Save Image And Prompt

After generation, run:

```bash
python3 .agents/skills/imagen/scripts/save_latest_image.py \
  --summary "<content summary>" \
  --image /absolute/path/returned-by-this-call.png \
  --prompt-text "<exact final prompt>"
```

For long prompts or prompts containing formulas, quotes, or many line breaks, save the final prompt to a temporary `.md` file first and use:

```bash
python3 .agents/skills/imagen/scripts/save_latest_image.py \
  --summary "<content summary>" \
  --image /absolute/path/returned-by-this-call.png \
  --prompt-file /path/to/final-prompt.md
```

Use `--output-dir <path>` if the user specified a target directory.
Use `--language zh` or `--language en` when the language is not obvious.

Use `--image` with the exact output from this call, particularly during concurrent work and edits. The script retains newest-image discovery for compatibility; use it only after verifying which file belongs to this task. It copies the image and saves the exact prompt without overwriting the original.

### 6. Review

Open the saved image and check:

- subject and composition match the request
- visible text is correct and not overlong
- technical labels, formulas, arrows, and diagrams are coherent
- the image is not a flat card if the user asked for a rich visual asset
- no unsupported facts, logos, people, or claims were added
- the output file and prompt file are both present

Prefer a targeted edit for a material local defect; regenerate when the whole composition or scientific representation is wrong. If the user asked for a fast draft, report the limitation instead of iterating silently.

## Common Mistakes

- Do not paste prompt metadata into the image as visible headings.
- Do not use generic icon-card layouts when the request calls for a visual asset.
- Do not suppress formulas by default; render concise formulas when they are central, then visually review them.
- Do not overwrite the original Codex-generated image under `~/.codex/generated_images`; copy it to the project output path.
- Do not save only the image. The exact prompt is part of the deliverable.
