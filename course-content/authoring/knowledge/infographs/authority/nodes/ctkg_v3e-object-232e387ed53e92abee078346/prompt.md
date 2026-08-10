# Authority DomainConcept Infograph — GPT/Grok Image Gen Spec

Generate ONE landscape teaching infographic for the control-theory concept below.
Provider: Grok image_gen (or latest native image generation). Treat output as a polished visual teaching asset, not a flat electronic knowledge card.

## Subject
- Title: 截止频率
- Concept kind: unknown
- One-line definition (source of truth): 开环幅频特性A(ω)=1时的频率，记为ω_c。
- Core intuition: 抓住定义核心与邻接关系，不扩展未给出的事实。
- Relation summary: 前置 → 对数幅频渐近特性曲线、利用开环频域指标估算时域性能方法、相角裕度 · 后续 → 带宽频率、利用开环频域指标估算时域性能方法
- Extended explanation (do not paste verbatim on image): 开环幅频特性A(ω)=1时的频率，记为ω_c

## visual_archetype
频域仪表盘

## layout_contract
- Canvas: landscape 16:9
- Layered composition: (1) main visual scene or engineering metaphor for the concept, (2) 1–3 technical insets (diagram / axes / mechanism cutaway), (3) compact formula or symbolic anchors only if already present in the definition text, (4) a boundary/judgment strip
- Reading order: left-to-right or top-to-bottom, clear visual hierarchy
- Main visual occupies ~45–55% of frame; insets and labels share remaining space without clutter

## text_contract
- Clean Chinese typography; short labels only
- Allowed visible labels (max ~10, each preferably ≤10 Chinese characters): 「截止频率」、「用于分析·对数幅频…」、「用于分析·利用开环…」、「关联·相角裕度」、「关联·阻尼自然频率」、「关联·带宽频率」
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
