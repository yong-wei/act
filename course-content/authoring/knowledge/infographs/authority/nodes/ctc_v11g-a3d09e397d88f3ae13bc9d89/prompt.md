# Authority DomainConcept Infograph — GPT/Grok Image Gen Spec

Generate ONE landscape teaching infographic for the control-theory concept below.
Provider: Grok image_gen (or latest native image generation). Treat output as a polished visual teaching asset, not a flat electronic knowledge card.

## Subject
- Title: 参数根轨迹 (parameter_root_locus)
- Concept kind: representation_kind
- One-line definition (source of truth): 以非开环增益为可变参数绘制的根轨迹称为参数根轨迹，以区别于以开环增益 K 为可变参数的常规根轨迹。
- Core intuition: 在图谱邻接中可把握：前置 → 在绘制参数根轨迹之前引入的概念、常规根轨迹 · 后续 → 广义根轨迹、等效开环传递函数。
- Relation summary: 前置 → 在绘制参数根轨迹之前引入的概念、常规根轨迹 · 后续 → 广义根轨迹、等效开环传递函数
- Extended explanation (do not paste verbatim on image): 以非开环增益为可变参数绘制的根轨迹称为参数根轨迹，以区别于以开环增益 K 为可变参数的常规根轨迹。

## visual_archetype
s 平面机理板

## layout_contract
- Canvas: landscape 16:9
- Layered composition: (1) main visual scene or engineering metaphor for the concept, (2) 1–3 technical insets (diagram / axes / mechanism cutaway), (3) compact formula or symbolic anchors only if already present in the definition text, (4) a boundary/judgment strip
- Reading order: left-to-right or top-to-bottom, clear visual hierarchy
- Main visual occupies ~45–55% of frame; insets and labels share remaining space without clutter

## text_contract
- Clean Chinese typography; short labels only
- Allowed visible labels (max ~10, each preferably ≤10 Chinese characters): 「参数根轨迹」、「parameter ro」、「是一种·广义根轨迹」、「关联·在绘制参数根…」、「关联·常规根轨迹」、「关联·等效开环传递…」
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
