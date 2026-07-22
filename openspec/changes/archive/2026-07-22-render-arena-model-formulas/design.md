## Context

Arena transfer-function models already carry both a plain `display` string and an optional `latex` string. The challenge detail uses `BlockMath`, while `ArenaModelSelectorPanel` outputs `model.display` directly in its locked summary and model cards. The inconsistency exposes notation such as `s^2` to students even though the repository already has the required KaTeX stack.

## Goals / Non-Goals

**Goals:**
- Render available transfer functions as compact inline mathematics throughout the model selector.
- Preserve readable fallback text for models without LaTeX.
- Preserve selection, locking, compatibility, and accessibility behavior.

**Non-Goals:**
- Rewriting model formulas or deriving LaTeX from plain strings.
- Changing the block formula on the challenge detail page.
- Introducing a repository-wide formula abstraction.
- Changing model data, analysis, evaluation, or submission behavior.

## Decisions

### Use inline KaTeX in the selector

The selector is a compact comparison surface, so `InlineMath` matches its layout better than `BlockMath`. The component will import the existing KaTeX stylesheet and use `model.latex` when present.

Alternative considered: replace `^2` with the Unicode character `²`. Rejected because it handles only one exponent and leaves fractions and grouping as plain source notation.

Alternative considered: create a global formula renderer. Rejected because only this local surface is inconsistent and a global abstraction would expand the change without demonstrated need.

### Keep the authored plain display as fallback

Models without `latex` continue to show `model.display`; models without any transfer function retain the current absence labels. The renderer will not attempt unsafe or lossy string-to-LaTeX conversion.

### Test user-visible output and interaction

A focused React test will verify that a second-order model produces KaTeX superscript markup without exposing `s^2`, that a display-only model remains readable, and that clicking a compatible model still calls the selection callback.

## Risks / Trade-offs

- [Risk] KaTeX markup may increase card width. -> Keep formulas inline inside the existing compact text container and allow the card layout to retain its current wrapping behavior.
- [Risk] Rendering changes could accidentally interfere with button interaction. -> Exercise the selection callback in the focused component test.
