"""Run: python3 -m pip install pyyaml tinycss2 && python3 tests/check_theme.py."""
import json
import re
from pathlib import Path

import tinycss2
import yaml

ROOT = Path(__file__).resolve().parents[1]


class UniqueLoader(yaml.SafeLoader):
    """Reject duplicate keys instead of silently discarding theme settings."""


def mapping(loader, node):
    # `<<: *anchor` merges are allowed (the colour variants reuse Neumorphism);
    # an explicit key may override a merged one, but never repeat another explicit key.
    explicit = len([k for k, _ in node.value if k.tag != "tag:yaml.org,2002:merge"])
    loader.flatten_mapping(node)
    first_explicit = len(node.value) - explicit
    result, seen = {}, set()
    for index, (key_node, value_node) in enumerate(node.value):
        key = loader.construct_object(key_node)
        if index >= first_explicit:
            assert key not in seen, f"Duplicate key {key!r}, line {key_node.start_mark.line + 1}"
            seen.add(key)
        result[key] = loader.construct_object(value_node)
    return result


UniqueLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, mapping)


def load(text):
    return yaml.load(text, Loader=UniqueLoader)


def luminance(color):
    rgb = [int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    rgb = [c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in rgb]
    return sum(c * weight for c, weight in zip(rgb, (.2126, .7152, .0722)))


def contrast(a, b):
    light, dark = sorted((luminance(a), luminance(b)), reverse=True)
    return (light + .05) / (dark + .05)


def check_css(css):
    for rule in tinycss2.parse_stylesheet(css, skip_whitespace=True, skip_comments=True):
        assert rule.type != "error", rule
        if rule.type == "at-rule" and rule.content:
            check_css(tinycss2.serialize(rule.content))
        elif rule.type == "qualified-rule":
            for declaration in tinycss2.parse_declaration_list(rule.content, skip_whitespace=True, skip_comments=True):
                assert declaration.type != "error", declaration


def check_styles(value):
    if isinstance(value, dict):
        for child in value.values():
            check_styles(child)
    else:
        assert isinstance(value, str)
        check_css(value)


files = list((ROOT / "themes").glob("*.yaml"))
assert len(files) == 1, "HACS must manage one theme file"
themes = load(files[0].read_text())
assert list(themes)[0] == "Neumorphism"
assert all(name == "Neumorphism" or name.startswith("Neumorphism ") for name in themes)
assert json.loads((ROOT / "hacs.json").read_text())["name"] == "Neumorphism"
base = themes["Neumorphism"]
palette_keys = set(base["modes"]["light"])

for name, theme in themes.items():
    print(f"[{name}]")
    assert theme["card-mod-theme"] == name, f"{name}: card-mod-theme must repeat the theme name"
    assert not any(key.endswith("-yaml") for key in theme), "Avoid the broken card-mod 4.2.1 YAML bootstrap"
    # Variants change only the palette; material and card-mod rules stay shared.
    assert {k: v for k, v in theme.items() if k not in ("modes", "card-mod-theme")} == \
        {k: v for k, v in base.items() if k not in ("modes", "card-mod-theme")}, name
    assert set(theme["modes"]) == {"light", "dark"}
    assert set(theme["modes"]["light"]) == set(theme["modes"]["dark"]) == palette_keys, name
  
    for mode, palette in theme["modes"].items():
        merged = {k: v for k, v in theme.items() if k != "modes"} | palette
        assert all(isinstance(v, str) for v in merged.values()), "Theme values must be strings"
        # Resolve the entire variable graph so undefined private tokens and cycles fail.
        def resolve(key, trail=()):
            assert key not in trail, f"Variable cycle: {trail + (key,)}"
            def replace(match):
                target = match[1]
                assert not target.startswith("soft-") or target in merged, target
                return resolve(target, trail + (key,)) if target in merged else match[0]
            return re.sub(r"var\(--([\w-]+)\)", replace, merged[key])
        for key in merged:
            resolve(key)
        ratios = []
        for text in ("primary-text-color", "secondary-text-color", "primary-color", "error-color", "warning-color", "success-color", "info-color"):
            for background in ("soft-surface", "soft-recess"):
                ratio = contrast(palette[text], palette[background])
                assert ratio >= 4.5, (mode, text, background, ratio)
                ratios.append(ratio)
        assert contrast(palette["text-primary-color"], palette["primary-color"]) >= 4.5
        for text in ("primary-text-color", "secondary-text-color"):
            assert contrast(palette[text], palette["soft-active-surface"]) >= 4.5
        assert contrast(palette["soft-control-edge"], palette["soft-surface"]) >= 3
        print(f"{mode}: text/status contrast >= {min(ratios):.2f}:1; on-accent and control edges pass")

for key, value in theme.items():
    if key.startswith("card-mod-") and key != "card-mod-theme":
        check_styles(load(value) if key.endswith("-yaml") else value)
for path in (ROOT / "examples").glob("*.yaml"):
    load(path.read_text())

original = ROOT / "lovelace.yaml"
copy = ROOT / "lovelace.neumorphic.yaml"
if original.exists() and copy.exists():
    before, after = load(original.read_text()), load(copy.read_text())
    assert len(before["views"]) == len(after["views"])
    for old, new in zip(before["views"], after["views"]):
        assert new["theme"] == "Neumorphism"
        assert new["background"] == "var(--lovelace-background)"
        old.pop("background", None)
        old.pop("theme", None)
        new.pop("background")
        new.pop("theme")
    assert before == after, "Dashboard content/actions changed"
    print("Dashboard copy: only the two view themes/backgrounds changed")
print("PASS: theme YAML, CSS syntax, variable graph, palettes, HACS layout, and examples")
