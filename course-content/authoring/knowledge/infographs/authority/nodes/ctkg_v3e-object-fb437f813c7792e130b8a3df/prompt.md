# Authority DomainConcept Infograph — GPT/Grok Image Gen Spec

Generate ONE landscape teaching infographic for the control-theory concept below.
Provider: Grok image_gen (or latest native image generation). Treat output as a polished visual teaching asset, not a flat electronic knowledge card.

## Subject
- Title: 给定稳定度检验方法
- Concept kind: unknown
- One-line definition (source of truth): 为了使稳定的系统具有良好的动态响应，我们常常希望在 s 左半平面上系统特征根的位置与虚轴之间有一定的距离。
- Core intuition: 为此，可在 s 左半平面上作一条 s=-a 的垂线，而 a 是系统特征根位置与虚轴之间的最小给定距离，通常称为给定稳定度，然后用新变量 s1=s+a 代入原系统特征方程，得到一个以 s1 为变量的新特征方程，对新特征方程应用劳斯稳定判据，可以判别系统的特征根是否全部位于 s=-a 垂线之左。
- Relation summary: 后续 → 通过变量替换检验给定稳定度的方法、稳定性、特征方程
- Extended explanation (do not paste verbatim on image): 为了使稳定的系统具有良好的动态响应，我们常常希望在 s 左半平面上系统特征根的位置与虚轴之间有一定的距离。

## visual_archetype
s 平面机理板

## layout_contract
- Canvas: landscape 16:9
- Layered composition: (1) main visual scene or engineering metaphor for the concept, (2) 1–3 technical insets (diagram / axes / mechanism cutaway), (3) compact formula or symbolic anchors only if already present in the definition text, (4) a boundary/judgment strip
- Reading order: left-to-right or top-to-bottom, clear visual hierarchy
- Main visual occupies ~45–55% of frame; insets and labels share remaining space without clutter

## text_contract
- Clean Chinese typography; short labels only
- Allowed visible labels (max ~10, each preferably ≤10 Chinese characters): 「给定稳定度检验方法」、「包含组件·通过变量…」、「用于分析·稳定性」、「应用于·特征方程」
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
