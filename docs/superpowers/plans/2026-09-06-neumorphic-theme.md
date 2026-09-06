# Lovelace Soft implementation plan

**Goal:** Build a HACS theme with native light/dark modes, deep Mushroom/Bubble styling, and a safe way to test the supplied dashboard.

**Architecture:** One theme YAML, shared semantic CSS variables, and plain card-mod CSS for exposed component hosts. Use Home Assistant's own mode selection. Keep the supplied dashboard intact and produce a separate test copy with its two wallpaper overrides removed. Avoid the card-mod 4.2.1 YAML bootstrap failure found during live testing.

**Tech stack:** Home Assistant frontend 20260826.6, card-mod 4.2.1, Mushroom 5.2.3, Bubble Card 3.3.0; YAML and CSS only at runtime.

- [x] Inventory both views, all card types, inline CSS, wrappers, and wallpaper overrides.
- [x] Read the requested UI/UX skill, official docs, upstream component source, and reference images.
- [x] Create `themes/lovelace-soft.yaml` with complete light/dark palettes and native, Mushroom, Bubble, badge, and dialog styling.
- [x] Create `hacs.json`, README installation/testing notes, and a small helper-only test dashboard.
- [x] Create `lovelace.neumorphic.yaml`, changing only view themes and wallpapers; preserve actions and confirmations.
- [x] Validate YAML, embedded CSS, variable references, contrast, and dashboard semantic equivalence with `tests/check_theme.py`.
- [x] Exercise representative real components in an isolated local Home Assistant; record untested custom-card internals in `docs/validation.md`.

No publication or changes to the running home installation are part of this task.

Follow-up: the user's request for press feedback on every clickable button adds a small frontend module for nested open shadow roots, alongside CSS fallbacks. Installation and HACS distribution instructions now include its separate frontend resource entry.
