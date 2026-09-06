# Neumorphism

A neumorphic Home Assistant theme: pale ceramic in light mode, slate in dark mode, with raised cards and icons, recessed control surfaces, and teal accents. One theme contains both palettes and follows Home Assistant's **Auto / Light / Dark** preference.

Runtime: one YAML theme plus **card-mod**, with a small press-feedback module for buttons inside nested component shadow roots. Mushroom and Bubble Card are optional unless your dashboard uses them. No fonts, polling, automations, or Bubble modules are needed.

## Install and try it now

1. In HACS, install/update **card-mod**, **Mushroom**, and **Bubble Card**. Tested versions: Home Assistant **2026.9.1**, frontend **20260826.6**, card-mod **4.2.1**, Mushroom **5.2.3**, Bubble Card **3.3.0**.
2. Copy [`themes/neumorphism.yaml`](themes/neumorphism.yaml) to `/config/themes/neumorphism.yaml` on Home Assistant. Copy [`frontend/neumorphism-press.js`](frontend/neumorphism-press.js) to `/config/www/neumorphism-press.js` (create `www` if needed).
3. Merge this into your existing `/config/configuration.yaml`; keep a single `frontend:` section:

   ```yaml
   frontend:
     themes: !include_dir_merge_named themes
     extra_module_url:
       - /hacsfiles/lovelace-card-mod/card-mod.js
       - /local/neumorphism-press.js?v=2
   ```

   **Use your actual card-mod resource URL.** Find it under **Settings → Dashboards → ⋮ → Resources**. If its URL has a `?hacstag=...` suffix, copy that exact URL into `extra_module_url` too. Retain the HACS-managed resource entry and keep both URLs identical after updates. See [card-mod installation](https://github.com/thomasloven/lovelace-card-mod#installation).

4. Check your HA configuration, then restart Home Assistant once for the `frontend` change. For subsequent theme-only edits, run **Developer tools → Actions → `frontend.reload_themes`**, then refresh the browser if necessary.
5. Open your **Profile → General → Theme**, select **Neumorphism**, then set **Theme mode → Auto**. Home Assistant selects the light or dark palette from the device appearance. These are native [frontend theme modes](https://www.home-assistant.io/integrations/frontend/#dark-mode-support).

## Test without controlling real devices

The supplied sample uses only three test helpers.

1. Copy [`examples/test-helpers.yaml`](examples/test-helpers.yaml) to `/config/packages/lovelace_soft_test.yaml`.
2. If you do not already load packages, merge this into the existing `homeassistant:` section and restart:

   ```yaml
   homeassistant:
     packages: !include_dir_named packages
   ```

   If packages are already configured differently, use your existing package layout. Do not add a second package loader. See [Home Assistant packages](https://www.home-assistant.io/docs/configuration/packages/).
3. Create a new empty dashboard called **Neumorphism test**. Open its **Edit dashboard → ⋮ → Raw configuration editor** and paste [`examples/test-dashboard.yaml`](examples/test-dashboard.yaml). This example assumes Mushroom and Bubble Card resources are loaded.
4. Run this checklist:

   | Check | Expected result |
   | --- | --- |
   | Light, then Dark in Profile | Canvas, sidebar, cards, badges, and open menus use the corresponding palette. |
   | Auto, then change device appearance | Palette follows the device without choosing another theme or running an automation. |
   | Test switch / Modern template / Bubble switch | The helper toggles; the on/off label and state color update. |
   | Native, Mushroom, and Bubble sliders | Moving one updates the same percentage everywhere. Try 0%, 50%, and 100%. |
   | Mushroom number buttons | Minus/plus update the helper; controls remain legible at both limits. |
   | Bubble menu | Menu opens above other cards; Home/Away/Night can be selected. |
   | Open test pop-up | Its background matches the theme; nested controls work; Escape/back closes it. |
   | Entity more-info | Dialog remains readable and close controls work. |
   | Keyboard | Tab focus stays visible; existing keyboard controls continue working. |
   | Press feedback | Hold any clickable element — entity row, tile, badge (native and Mushroom template), chip, Mushroom plus/minus, native button, Bubble action, or a card with a tap action: its surface goes inset and returns on release. Space/Enter work on keyboard-focusable buttons; disabled and non-clickable elements stay unchanged. |
   | Phone / tablet / desktop | Check approximately 375px, 768px, and 1440px widths; no new horizontal scrolling or clipped controls. |
   | Reduced motion | Theme-added transitions stop; upstream cards retain their own motion behavior. |

After testing, remove the test dashboard and the helper package if no longer needed, then restart HA. The helpers have no connection to devices.

## Apply it to your existing dashboard

The accompanying local `lovelace.neumorphic.yaml` is a copy of the supplied `lovelace.yaml`. Only the two view-level settings changed:

```yaml
theme: Neumorphism
background: var(--lovelace-background)
```

The Home and 3D Printer views previously selected fixed wallpaper images. A matching canvas is essential for the raised-surface effect. Import the copy into a **new dashboard** first; keep the original dashboard as your rollback.

Entities, service calls, confirmation prompts, navigation hashes, visibility conditions, layouts, custom logo images, and existing card-specific styles are preserved. This copy still controls your real devices; use the helper dashboard above for interaction testing.

Your export contains **15 legacy Bubble pop-ups**. Bubble 3.3 may display its migration notice. Use Bubble's **Migrate to standalone** option separately if prompted; this theme does not rewrite those structures. The sample dashboard already uses the current `card_type: pop-up` plus nested `cards:` format. See [Bubble Card's migration release notes](https://github.com/Clooos/Bubble-Card/releases/tag/v3.2.0).

## Coverage

The supplied dashboard has 109 Bubble cards, 55 Mushroom cards, and 12 Mushroom template badges. Coverage is based on their actual theme variables and public component surfaces, with shared Home Assistant colors for the other card families.

| Components in the supplied dashboard | Treatment |
| --- | --- |
| Native tiles, entities, gauges, clocks, weather, history, alarm panel, to-do, picture cards | Shared raised card surface, palette, state colors, rounded geometry; native control groups get recessed surfaces. |
| Mushroom entity, template, light, number, update | Raised cards/icon containers and styled exposed control surfaces. Current template cards use HA tile styling; classic cards use Mushroom variables. |
| Mushroom chips and template badges | Individual raised pills; the chip row itself remains transparent. |
| Bubble buttons, sliders, sub-buttons, media players, separators, pop-ups | Bubble theme variables plus scoped card-mod CSS; raised interactive surfaces, quieter separators, themed menus and opaque pop-up surfaces. |
| Button-card, mini-graph, ApexCharts, uptime, calendar-card-pro | Inherited card shell and palette where the card uses HA theme variables; existing data/series colors and custom content remain. |
| Scheduler, custom to-do, Bambu Lab cards, Dreame map, UniFi map, WebRTC, more-info-card | Theme-aware outer surfaces. Their private controls, canvas drawings, maps, video overlays, and data colors require individual card support. |
| Grid, sections, horizontal/vertical stacks, auto-entities, decluttering, config-template, restriction, simple-swipe, conditional | Structural wrappers stay transparent; their child cards inherit the theme. |
| Iframes, remote logos, photos, video | Surrounding surface is themed; embedded pages and image/video pixels cannot be recolored by an HA theme. |

**Press feedback is not limited to that list.** With `neumorphism-press.js` loaded, the inset press effect applies to any element the frontend renders as clickable (computed `cursor: pointer`) — default entity rows, tiles, native and Mushroom badges, chips, Bubble actions, and cards with a `tap_action` — regardless of card type. Inline text links and non-clickable elements are left alone.

**A YAML theme cannot guarantee every internal element of every third-party card.** Hard-coded inline styles, closed shadow roots, canvases, and cross-origin iframes are outside the common theme interface. This package styles the exposed surfaces and preserves state/action semantics. The specialized cards above still need a visual pass on your installation with their real data.

## HACS distribution

This folder has the required structure for a **Theme** repository: one file under `themes/`, a root `hacs.json`, and this README. See [HACS theme requirements](https://www.hacs.xyz/docs/publish/theme/).

To distribute it, create a public GitHub repository from the package files, add a description and the `home-assistant`, `hacs`, `theme`, and `neumorphism` topics. In HACS, open **⋮ → Custom repositories**, paste that repository URL, choose **Theme**, then download **Neumorphism**. [HACS custom repositories](https://www.hacs.xyz/docs/faq/custom_repositories/).

The package has not been published to GitHub or added to the HACS default store. HACS installs the theme; install card-mod separately and copy the press-feedback module using step 2. HACS's Theme category does not install or update frontend JavaScript. When updating that module, replace the file and increment its `?v=` suffix, then restart/refresh. Personal dashboard exports are intentionally excluded by `.gitignore` and from the distribution ZIP.

## Tuning and troubleshooting

- **Too much depth:** reduce the offsets/blur in `soft-shadow-raised` and `soft-shadow-small` near the top of the theme. Keep upper-left highlights and lower-right shadows in both modes.
- **Wrong canvas:** clear the view's wallpaper override or use `background: var(--lovelace-background)`.
- **Raised cards but flat icons/controls:** verify card-mod is loaded through the exact `extra_module_url`, then refresh. The base theme works without card-mod, but its extra surface styling does not.
- **A clickable element does not press inward:** verify `/local/neumorphism-press.js?v=2` loads. The module follows the event path through open shadow roots and briefly changes the shadow of the innermost element the frontend renders as clickable (computed `cursor: pointer`), which covers default entity rows, tiles, badges, chips, and any card tap target. It restores existing inline styles on release, cancellation, or window blur and leaves actions unchanged. Closed shadow roots and cross-origin embedded pages remain outside its reach.
- **Only one card differs:** inspect its local `styles`, `card_mod`, background, and Bubble module settings. Explicit card overrides can take precedence over the theme.
- **Mode does not follow your device:** choose **Auto**, remove a per-card mode override, and check the companion app's appearance setting. `frontend.set_theme` selects a default theme for a mode; it does not force every user's current light/dark preference.
- **Pop-up colors briefly lag:** update Bubble Card and refresh the browser. Existing JavaScript-generated RGB/state colors remain the card's responsibility.
- **Keep the exact theme name:** `Neumorphism` and `card-mod-theme: Neumorphism` must match.
- **Rollback:** select your previous profile theme and return to the original dashboard. You can then remove this theme file and reload themes.
  The press module is inactive when the selected theme does not expose `soft-shadow-inset`; remove its frontend entry/file too if uninstalling.

## Validation and design references

Run the local structural checks:

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python tests/check_theme.py
node tests/check_press.mjs
```

These check duplicate YAML keys, CSS syntax, light/dark token parity, variable cycles, contrast, HACS layout, example syntax, and preservation of the personal dashboard's content. They do not claim to replace rendering tests. The light/dark text and status palette meets 4.5:1 against the main and recessed surfaces; this does not certify every third-party card's own colors or images.

The JavaScript check verifies press/release, cancellation, keyboard activation, window blur, disabled controls, theme opt-in, and exact restoration of existing inline styles.

Live checks used an isolated Home Assistant 2026.9.1 instance with dummy entities. See [`docs/validation.md`](docs/validation.md) for the scope and results. During testing, card-mod 4.2.1's `*-yaml` bootstrap failed on a fresh 2026.9 session. This theme uses plain `card-mod-card` CSS and public component hosts instead, avoiding that loader entirely.

The requested [UI/UX Pro Max skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) informed the dual-shadow, visible-focus, contrast, and reduced-motion choices. Its broad design-system query suggested glassmorphism; the narrower **neumorphism** result matched this request, so that result guided the design. Home Assistant's own typography is retained.

Visual references reviewed: [costachung's raised/inset SwiftUI controls and screenshots](https://github.com/costachung/neumorphic), [etnlbck's HA theme and reference assets](https://github.com/etnlbck/hacs-neumorphic-template), and the [community themes index](https://community.home-assistant.io/c/projects/themes/29/l/top), including [Soft UI themes](https://community.home-assistant.io/t/so-i-made-some-soft-ui-themes/220908). Implementation hooks were checked against [Mushroom](https://github.com/piitaya/lovelace-mushroom), [Bubble Card](https://github.com/Clooos/Bubble-Card), [card-mod](https://github.com/thomasloven/lovelace-card-mod), and the [HA frontend source](https://github.com/home-assistant/frontend/tree/20260826.6).
