// Momentary press feedback for anything clickable, across open shadow roots.
// Active only while the current theme defines --soft-shadow-inset (Neumorphism).
// Never cancels events: the card's own tap, hold, and keyboard actions still run.
(() => {
  let releasePressedSurface = () => {};

  const EXPLICIT_BUTTON_SELECTOR =
    'button, [role="button"], [role="switch"], a[href], input[type="button"],' +
    ' input[type="submit"], input[type="checkbox"], input[type="radio"],' +
    ' ha-button, ha-icon-button, mwc-button';

  function isDisabled(element) {
    return (
      element.disabled ||
      element.hasAttribute('disabled') ||
      element.getAttribute('aria-disabled') === 'true' ||
      element.hasAttribute('inert')
    );
  }

  // The innermost real button wins; otherwise the innermost element the frontend
  // renders as clickable. Home Assistant, Mushroom and Bubble all set
  // cursor:pointer on actionable surfaces (tiles, entity rows, badges, chips,
  // card tap targets) and never on inert ones, so this covers every card type
  // including the built-in ones. Inline elements (text links) are excluded.
  function findPressableSurface(eventPath, isPointerEvent) {
    for (const element of eventPath) {
      if (element.matches(EXPLICIT_BUTTON_SELECTOR)) return element;
    }
    if (!isPointerEvent) return null;
    for (const element of eventPath) {
      const computedStyle = getComputedStyle(element);
      if (computedStyle.cursor === 'pointer' && !computedStyle.display.startsWith('inline')) {
        return element;
      }
    }
    return null;
  }

  function onPressStart(event) {
    if (event.type === 'pointerdown' && event.button !== 0) return;
    if (
      event.type === 'keydown' &&
      (event.repeat || (event.key !== ' ' && event.key !== 'Enter'))
    ) {
      return;
    }

    const eventPath = event.composedPath().filter((node) => node instanceof Element);
    if (eventPath.some(isDisabled)) return;

    const surface = findPressableSurface(eventPath, event.type === 'pointerdown');
    if (!surface) return;

    const insetShadow = getComputedStyle(surface).getPropertyValue('--soft-shadow-inset').trim();
    if (!insetShadow) return;

    releasePressedSurface();

    const savedInlineStyles = ['box-shadow', 'transition'].map((property) => [
      property,
      surface.style.getPropertyValue(property),
      surface.style.getPropertyPriority(property),
    ]);
    surface.style.setProperty('box-shadow', insetShadow, 'important');
    surface.style.setProperty('transition', 'none', 'important');

    releasePressedSurface = () => {
      for (const [property, value, priority] of savedInlineStyles) {
        if (value) surface.style.setProperty(property, value, priority);
        else surface.style.removeProperty(property);
      }
      releasePressedSurface = () => {};
    };
  }

  document.addEventListener('pointerdown', onPressStart, true);
  document.addEventListener('keydown', onPressStart, true);
  for (const endEvent of ['pointerup', 'pointercancel', 'lostpointercapture', 'keyup']) {
    document.addEventListener(endEvent, () => releasePressedSurface(), true);
  }
  window.addEventListener('blur', () => releasePressedSurface());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releasePressedSurface();
  });

  // Load marker for support: `window.__neumorphismPress` is true iff this file
  // actually loaded. If it is undefined, the extra_module_url entry is missing
  // or wrong and no clickable element will show the press effect.
  window.__neumorphismPress = true;
})();

// Work around a Home Assistant core bug (frontend `src/state/themes-mixin.ts`):
// when a non-"default" theme resolves to light mode, HA sets
// <meta name="color-scheme"> to "dark light" instead of "light". WebKit (Safari,
// iOS Companion app) uses that hint for native UA colors on sliders, switches and
// other form controls independently of the page's own CSS, so those controls can
// render with dark native colors while the rest of the page is light-themed —
// most visible inside dialogs (which concentrate native-styled controls), and
// often only after a light/dark flip while the app was backgrounded. HA only
// rewrites the tag when its own resolved mode changes, so a wrong value can also
// persist across a plain refresh.
// Runs only while Neumorphism is active (gated like the press module above, via
// --soft-shadow-inset) and derives the correct value from the text color HA
// actually applied, so it stays correct even if the palette above changes.
(() => {
  const schemeMeta = document.querySelector('meta[name="color-scheme"]');
  if (!schemeMeta) return;

  function parseColor(value) {
    value = value.trim();
    let match = /^#([0-9a-f]{3})$/i.exec(value);
    if (match) {
      return [...match[1]].map((c) => parseInt(c + c, 16));
    }
    match = /^#([0-9a-f]{6})$/i.exec(value);
    if (match) {
      const hex = match[1];
      return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    }
    match = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(value);
    if (match) return match.slice(1, 4).map(Number);
    return null;
  }

  function syncColorScheme() {
    const rootStyle = getComputedStyle(document.documentElement);
    if (!rootStyle.getPropertyValue('--soft-shadow-inset').trim()) return;

    const textColor = parseColor(rootStyle.getPropertyValue('--primary-text-color'));
    if (!textColor) return;

    const [r, g, b] = textColor;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const correctScheme = luminance > 128 ? 'dark' : 'light';

    if (schemeMeta.getAttribute('content') !== correctScheme) {
      schemeMeta.setAttribute('content', correctScheme);
    }
  }

  syncColorScheme();
  // HA applies theme changes as inline custom properties on <html>; catching
  // that mutation is the general-purpose trigger, independent of exactly when or
  // why HA decided (or failed) to touch the scheme meta itself.
  new MutationObserver(syncColorScheme).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['style'],
  });
  new MutationObserver(syncColorScheme).observe(schemeMeta, {
    attributes: true,
    attributeFilter: ['content'],
  });
  // Safety net for iOS: WKWebView can suspend observers/timers while
  // backgrounded, so re-check explicitly on foreground.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncColorScheme();
  });
  window.addEventListener('pageshow', syncColorScheme);
})();
