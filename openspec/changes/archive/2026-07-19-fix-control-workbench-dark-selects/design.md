## Context

`ParameterDrawer` uses `DialogPrimitive.Portal`, so its content is mounted outside the page-local `.premium-lesson-shell` that owns the `--premium-lesson-*` theme variables. Both “响应类型” and “结构” are native `<select>` elements styled by `.premium-lesson-select`; the closed element can therefore resolve incomplete variables, while Chromium paints the expanded option popup using native color-scheme behavior that is not fully specified by the current CSS. Existing Playwright coverage proves that the structure value changes, but it does not cover both selects, theme-specific computed colors, popup readability, disabled styling, or keyboard selection.

The fix is a presentation-only change. The current values, change callbacks, correction enablement rules, analysis requests, and Rust/WASM control calculations remain authoritative and unchanged.

## Goals / Non-Goals

**Goals:**

- Keep the “响应类型” and “结构” selects readable in light and dark themes when closed, expanded, hovered, focused, or disabled.
- Preserve selection and keyboard behavior through an accessible shared primitive.
- Add focused automated checks for portal theme scope and Chromium acceptance for both controls.
- Define an evidence-based fallback if native popup rendering remains unreliable.

**Non-Goals:**

- Changing response types, correction structures, default values, enablement rules, callbacks, or persisted state.
- Changing analysis requests, chart behavior, controller artifacts, or Rust/WASM code.
- Replacing other selects or migrating unrelated controls to the shared primitive.
- Redesigning the parameter drawer beyond the affected control states.

## Decisions

### Start with native selects and activate the evidence-gated fallback

The implementation retained both native `<select>` elements first. Native controls already provided the required value model, form semantics, and keyboard behavior, so a custom popup was not justified without browser evidence.

The portal content receives the complete premium-lesson theme-token scope already used by the page rather than duplicating a partial palette. After Chromium showed that the native popup still could not provide auditable state evidence, the same scope was applied to the Radix popup portal and the native-only `color-scheme` treatment was removed.

### Specify control and option colors explicitly

The existing `.premium-lesson-select` styling defines readable foreground, background, border, hover, focus-visible, and disabled treatments from governed theme tokens. Radix popup items receive explicit foreground, background, hover, highlighted, selected, and disabled colors so every rendered state remains inspectable and theme-consistent.

Computed-style assertions will compare foreground and background values for each select in both themes and verify focus and disabled state signals. These checks complement, but do not replace, visual popup inspection because browser-owned menus are not fully represented by ordinary DOM computed styles.

### Gate any custom-select fallback on Chromium evidence

Chromium acceptance will open each select in light and dark themes, inspect option readability visually, change values by keyboard, and confirm the selected values are reflected by the existing callbacks. If this proves the scoped native solution reliable, no custom control will be introduced.

Only a reproducible Chromium failure after the native fix permits replacing the affected controls with the repository's existing accessible select primitive or an equivalent custom select. That fallback must preserve the same labels, values, disabled rules, callbacks, and keyboard semantics; it must not create a second state model or alter analysis behavior.

Chromium acceptance reproduced that failure: the browser-owned native option popup does not expose inspectable option-state DOM and cannot provide auditable popup contrast, hover, focus, or selected evidence. The fallback is therefore active. A shared shadcn-style wrapper over `@radix-ui/react-select` supplies the accessible popup primitive, while only the two parameter-drawer controls consume it. Their values and callbacks remain controlled by the existing workbench state.

### Keep verification focused on the affected boundary

Source/unit checks protect portal theme-token scope, explicit select/item state styling, and the unchanged controlled values and callbacks. Playwright extends the existing multi-representation linkage journey to exercise both controls in light and dark themes, including closed, expanded, hover, focus, disabled, and keyboard paths. No numerical simulation tests are required because this change does not touch the numerical boundary.

## Risks / Trade-offs

- [Risk] Native option popup styling differs across operating systems. → Use explicit option colors plus `color-scheme`, and require Chromium visual acceptance before considering the change complete.
- [Risk] Reusing the page token owner on portal content could carry unrelated layout rules. → Apply the narrowest existing theme-scope class or extract only the established token scope without creating a second palette; verify drawer dimensions and positioning remain unchanged.
- [Risk] A custom fallback could diverge from native accessibility or state behavior. → Allow it only after a reproducible native failure and require parity tests for labels, values, disabled state, focus order, arrow-key selection, Enter/Escape behavior, and callbacks.
- [Trade-off] Browser popup screenshots are less portable than DOM assertions. → Keep computed-style assertions deterministic and use Chromium popup evidence as the browser-specific acceptance layer.
