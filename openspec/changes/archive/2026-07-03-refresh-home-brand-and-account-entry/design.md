## Design Notes

The homepage remains the public-entry variant of the platform shell. It may use a branded topbar, but it must consume the central navigation metadata and should not invent a separate route hierarchy.

The brand lockup should contain:

- Image2-generated calligraphic “深蓝智控” art logo.
- Supporting text: “基于学科垂类大模型的船舶智控教学平台”.
- A compact/mobile behavior that preserves legibility without clipping the subtitle.

Asset location:

```text
public/assets/platform-brand/
  deepblue-smart-control-logo.<ext>
  deepblue-smart-control-logo-meta.json
```

The implementation may choose PNG/WebP/SVG wrapper output depending on image2 output and rendering quality, but the generated raster source and metadata should stay in the governed brand asset directory. The metadata should record generation model, prompt summary, intended UI usage, light/dark treatment, and fallback behavior.

The right side of the homepage should match module-page semantics: `个人中心` is the account/learner-record entry, and theme switching lives beside it. It should not keep a second “进入驾驶舱” label that competes with personal center.

Homepage code should consume the new asset through a shared brand lockup/component or platform-brand helper so future login, shell, and report surfaces can reuse the same governed identity without scattering direct image paths across page code.
