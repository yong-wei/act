# Authority DomainConcept Infograph — GPT/Grok Image Gen Spec

Generate ONE landscape teaching infographic for the control-theory concept below.
Provider: Grok image_gen (or latest native image generation). Treat output as a polished visual teaching asset, not a flat electronic knowledge card.

## Subject
- Title: root of the denominator (modeling_v2r_split_8f6ccd6e0cf66fa155c20aeb)
- Concept kind: theoretical_construct
- One-line definition (source of truth): root of the denominator：A root of the denominator polynomial of a transfer function
- Core intuition: 在图谱邻接中可把握：前置 → 闭环极点、poles of l s、开环极点 · 后续 → 传递函数、BIBO stability。
- Relation summary: 前置 → 闭环极点、poles of l s、开环极点 · 后续 → 传递函数、BIBO stability
- Extended explanation (do not paste verbatim on image): A root of the denominator polynomial of a transfer function

## visual_archetype
科普百科图鉴

## layout_contract
- Canvas: landscape 16:9
- Layered composition: (1) main visual scene or engineering metaphor for the concept, (2) 1–3 technical insets (diagram / axes / mechanism cutaway), (3) compact formula or symbolic anchors only if already present in the definition text, (4) a boundary/judgment strip
- Reading order: left-to-right or top-to-bottom, clear visual hierarchy
- Main visual occupies ~45–55% of frame; insets and labels share remaining space without clutter

## text_contract
- Clean Chinese typography; short labels only
- Allowed visible labels (max ~10, each preferably ≤10 Chinese characters): 「root of the…」、「是一种·闭环极点」、「一种·poles」、「是一种·开环极点」、「用于分析·根轨迹法」、「派生自·传递函数」
- Do NOT paste the full definition paragraph onto the image
- Do NOT render prompt metadata, source labels, entity ids, batch names, or English instruction headers
- Translate relation cues to Chinese short phrases already listed
- No decorative fake UI chrome, no watermark, no invented numbers or formulas

## technical_insets_contract
- Provide 1–3 insets that explain mechanism, readback, or boundary judgment
- Prefer control-engineering visuals when supported by the concept name/definition: ship heading, tank level, compass, dashboard, Bode axes, root-locus plane, Nyquist curve, step response, block diagram fragments
- Visual richness must explain the concept, not decorate randomly

## negative_constraints
- No electronic handout screenshot look
- No generic icon-card grid with long paragraphs
- No invented engineering examples, parameters, or stability claims not in the source text
- No malformed Chinese or broken formulas; if no formula is in the source, omit formula panels
- No lesson-id / group / knowledge-type chrome

## Style
Premium educational infographic: crisp lines, calm academic palette (deep navy, teal accents, warm paper-white panels), high information density with breathing room, magazine-quality illustration meeting engineering teaching standards.
