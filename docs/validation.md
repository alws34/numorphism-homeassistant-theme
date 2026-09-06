# Validation — 6 September 2026

## Environment

An isolated local Home Assistant container with test helpers, accessed through the Codex in-app browser. No connection to the user's running Home Assistant or physical devices was used.

| Component | Version |
| --- | --- |
| Home Assistant | 2026.9.1 |
| Frontend | 20260826.6 |
| card-mod | 4.2.1 |
| Mushroom | 5.2.3 |
| Bubble Card | 3.3.0 |

## Automated checks

`python tests/check_theme.py` passes. It verifies YAML duplicate keys, CSS parsing, matching light/dark tokens, variable cycles, private token references, HACS file layout, example YAML, and dashboard content preservation.

The minimum contrast among the defined text/status colors against the main and recessed surfaces is **4.64:1 in light mode** and **6.66:1 in dark mode**. Primary and secondary text also pass 4.5:1 against the selected-control surface. Text on the primary accent passes 4.5:1; control edges pass 3:1 against the main surface. These are palette checks, not a certification of third-party card content.

The personal dashboard copy differs semantically only in its two view themes/backgrounds. Entities, actions, confirmations, and card configurations are unchanged.

## Browser checks

- Fresh sessions render both palettes with raised card surfaces, icon hosts, chips, and badges; native and Mushroom control groups have inset shadows.
- Changing Profile mode to Dark updates the palette without a page reload. Auto selects the dark palette when the browser reports a dark system appearance. Changing the operating system appearance itself was not automated.
- Toggling the native helper switch updates the native, Mushroom, and Bubble state displays.
- Keyboard ArrowRight on the native slider changes the helper from 62 to 63 and updates all three card families plus the badge and gauge.
- Mushroom number buttons render and respond visually. The full 0/100 boundary and persistence checklist remains part of installation testing.
- Bubble's menu opens, selecting Away updates the native helper field, and the menu closes.
- Bubble's standalone pop-up opens with nested Mushroom/native controls. Its computed surface matches the main light/dark material; Escape closes it.
- Width checks at **375, 768, and 1440 CSS pixels** show no document horizontal overflow. Phone and desktop screenshots were visually inspected; these are browser viewport checks, not physical-device tests.
- The final browser session reports no console errors.

## Compatibility finding

The first implementation used card-mod's `card-mod-card-yaml` to traverse deeper shadow roots. On a fresh Home Assistant 2026.9.1 session, card-mod 4.2.1's YAML bootstrap failed while resolving a frontend panel (`component_name` was undefined), leaving the deep styles unapplied. The final theme uses plain CSS strings and public custom-element hosts, which rendered successfully on a fresh session. It does not modify card-mod or Home Assistant.

## Remaining installation checks

The supplied dashboard's specialized map, printer, camera, scheduler, graph, and wrapper cards were inventoried and their theme inheritance considered, but were not all installed in the lab. Test them with real data on the user's installation. The theme cannot recolor embedded pages, video pixels, canvases, or hard-coded private card styles.

Mushroom light controls and Bubble media-player controls use verified upstream hooks but were not exercised with physical lights or players. Also complete the README checks for open dialogs, every slider endpoint, keyboard focus, reduced-motion preference, and companion-app behavior. Existing legacy Bubble pop-up migration notices are upstream behavior and remain in the preserved personal dashboard copy.

## Press-feedback follow-up

Added CSS press states for exposed card actions, badges, chips, and buttons, plus `frontend/lovelace-soft-press.js` for native buttons inside nested open shadow roots. The module changes only shadow/transition styles during a press and restores the previous inline values and priorities on release or cancellation. It does not cancel events or invoke Home Assistant actions.

`node tests/check_press.mjs` passes for pointer release/cancel, lost capture, keyboard press/release, window blur, disabled controls, theme opt-in, and exact restoration. The local frontend bootstrap imports the module. A real Mushroom plus-button click changed the helper from 55 to 56 across card families, and the button had no residual inline style afterward. The held-down intermediate frame was not captured by the browser automation; verify the visible press/release effect with the README checklist.
