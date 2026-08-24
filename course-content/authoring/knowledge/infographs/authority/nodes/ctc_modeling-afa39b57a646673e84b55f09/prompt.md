# Authority DomainConcept Infograph — GPT/Grok Image Gen Spec

Generate ONE landscape teaching infographic for the control-theory concept below.
Provider: Grok image_gen (or latest native image generation). Treat output as a polished visual teaching asset, not a flat electronic knowledge card.

## Subject
- Title: 在电位器输出端接有负载时所产生… (modeling_afa39b57a646673e84b55f09)
- Concept kind: theoretical_construct
- One-line definition (source of truth): 在电位器输出端接有负载时所产生的影响，导致输出电压与电刷角位移不再保持线性关系；在无源网络级联中，后级网络的输入阻抗不够大或前级网络输出阻抗不为零时，直接连接会使传递函数不同于空载时各自传递函数的乘积。
- Core intuition: 在无源网络级联中，后级网络的输入阻抗不够大或前级网络输出阻抗不为零时，直接连接会使传递函数不同于空载时各自传递函数的乘积。
- Relation summary: （权威图邻接待补充）
- Extended explanation (do not paste verbatim on image): 在电位器输出端接有负载时所产生的影响，导致输出电压与电刷角位移不再保持线性关系；在无源网络级联中，后级网络的输入阻抗不够大或前级网络输出阻抗不为零时，直接连接会使传递函数不同于空载时各自传递函数的乘…

## visual_archetype
科普百科图鉴

## layout_contract
- Canvas: landscape 16:9
- Layered composition: (1) main visual scene or engineering metaphor for the concept, (2) 1–3 technical insets (diagram / axes / mechanism cutaway), (3) compact formula or symbolic anchors only if already present in the definition text, (4) a boundary/judgment strip
- Reading order: left-to-right or top-to-bottom, clear visual hierarchy
- Main visual occupies ~45–55% of frame; insets and labels share remaining space without clutter

## text_contract
- Clean Chinese typography; short labels only
- Allowed visible labels (max ~10, each preferably ≤10 Chinese characters): 「在电位器输出端接有负载…」
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
