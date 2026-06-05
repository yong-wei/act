## Context

Current pages expose useful links, but the user still has to interpret implementation modules. Browser review showed `/interactive-learning` as another card directory and homepage as a strong hero followed by a generic entry matrix.

## Goals / Non-Goals

**Goals:**

- Make public and student entry pages route users into learn, practice, challenge, experiment, and review/account paths.
- Preserve auth callback and role cockpit semantics.
- Provide mobile-first entry flows with one primary action per first viewport.

**Non-Goals:**

- Do not change auth implementation.
- Do not change Arena scoring, adaptive algorithms, or course runtime content.

## Decisions

### Decision 1: Homepage is not the full product sitemap

Homepage should present brand, role split, and intent split. It should not give every platform module equal visual weight.

### Decision 2: Interactive Learning becomes a learning control page

Interactive Learning should show course, practice, and challenge paths first. Component library access remains available but secondary.

## Risks / Trade-offs

- Reducing visible links may feel like hiding features. -> Provide consistent mobile drawer and secondary navigation.
- Login redesign can break callback clarity. -> Callback destination must be visible and tested.
