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

  // The innermost real button wins. Otherwise use the cursor: Home Assistant,
  // Mushroom, Bubble and button-card set cursor:pointer on actionable surfaces
  // (tiles, entity rows, badges, chips, card tap targets) and never on inert
  // ones, so this covers every card type including the built-in ones.
  // cursor is inherited, so the pointer elements from the tapped one outward
  // are one clickable thing plus its content (icons, pills, rings — even
  // raised ones a card template draws for decoration). Its surface is the
  // innermost raised card in that run — a nested card with its own action,
  // like a lock button-card inside a button-card — else the outermost element
  // with a box. Plain inline elements (text links) and display:contents wrappers have
  // no box to press; inline-block/-flex buttons do.
  function findPressableSurface(eventPath, isPointerEvent) {
    for (const element of eventPath) {
      if (element.matches(EXPLICIT_BUTTON_SELECTOR) && hasBox(getComputedStyle(element))) return element;
    }
    if (!isPointerEvent) return null;
    const start = eventPath.findIndex((element) => getComputedStyle(element).cursor === 'pointer');
    if (start < 0) return null;
    let surface = null;
    for (const element of eventPath.slice(start)) {
      const computedStyle = getComputedStyle(element);
      if (computedStyle.cursor !== 'pointer') break;
      if (!hasBox(computedStyle)) continue;
      if (element.localName === 'ha-card' && computedStyle.boxShadow !== 'none') return element;
      surface = element;
    }
    return surface;
  }

  function hasBox(computedStyle) {
    return computedStyle.display !== 'inline' && computedStyle.display !== 'contents';
  }

  function isOpaque(computedStyle) {
    return computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)';
  }

  // The element that takes the tap is often not the one that looks like the
  // button: tile and Bubble cards lay a full-size tap layer over the raised
  // card, Mushroom cards take taps on a state item inside it. When the tap
  // target is not raised itself, press the nearest raised ancestor it covers
  // most of. An opaque tap layer (a Bubble switch that is on) stays pressed
  // too, or it would hide that ancestor's inset.
  // ponytail: "covers most of" is an area ratio; an entities-card row covers
  // a small part of its card, so it keeps its own (rounded) press.
  const MIN_COVERAGE = 0.4;
  function visibleSurfaces(tapTarget, eventPath) {
    const targetStyle = getComputedStyle(tapTarget);
    if (targetStyle.boxShadow !== 'none') return [tapTarget];
    const targetArea = area(tapTarget);
    for (const ancestor of eventPath.slice(eventPath.indexOf(tapTarget) + 1)) {
      if (getComputedStyle(ancestor).boxShadow === 'none') continue;
      if (targetArea < area(ancestor) * MIN_COVERAGE) break;
      return isOpaque(targetStyle) ? [ancestor, tapTarget] : [ancestor];
    }
    return [tapTarget];
  }

  function area(element) {
    const { width, height } = element.getBoundingClientRect();
    return width * height;
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
    const tapTarget = findPressableSurface(eventPath, event.type === 'pointerdown');
    if (!tapTarget) return;
    // Only the control itself (and what was tapped inside it) can make the
    // press disabled. Ancestors cannot: sections dashboards wrap every card in
    // an <ha-sortable> whose `disabled` is true whenever you are not editing.
    if (eventPath.slice(0, eventPath.indexOf(tapTarget) + 1).some(isDisabled)) return;
    if (!getComputedStyle(tapTarget).getPropertyValue('--soft-shadow-inset').trim()) return;

    releasePressedSurface();

    const restorers = visibleSurfaces(tapTarget, eventPath).map(pressSurface);
    // Lets styles inside the tap target's own shadow root react to the press
    // (the ± rocker below); `:active` alone is unreliable on iOS touch.
    tapTarget.setAttribute('data-soft-pressed', '');

    releasePressedSurface = () => {
      for (const restore of restorers) restore();
      tapTarget.removeAttribute('data-soft-pressed');
      releasePressedSurface = () => {};
    };
  }

  const DEEP_PRESS_MIN_SIZE = 80;

  // Sinks one surface and returns a function restoring its exact inline styles.
  // Square surfaces (entity rows, state items) get rounded corners while held,
  // so the press reads as a soft well rather than a hard-edged box.
  function pressSurface(surface) {
    const computedStyle = getComputedStyle(surface);
    const saved = ['box-shadow', 'transition', 'border-radius'].map((property) => [
      property,
      surface.style.getPropertyValue(property),
      surface.style.getPropertyPriority(property),
    ]);
    // Read per surface: accent-filled buttons override it with a tinted inset.
    // A 3px inset that reads well on a pill vanishes on a large card, so big
    // surfaces sink as deep as they are raised.
    const { width, height } = surface.getBoundingClientRect();
    const deep = Math.min(width, height) >= DEEP_PRESS_MIN_SIZE &&
      computedStyle.getPropertyValue('--soft-shadow-inset-deep').trim();
    const inset = deep || computedStyle.getPropertyValue('--soft-shadow-inset').trim();
    surface.style.setProperty('box-shadow', inset, 'important');
    surface.style.setProperty('transition', 'none', 'important');
    if (computedStyle.borderRadius === '0px') {
      surface.style.setProperty('border-radius', 'var(--soft-control-radius)', 'important');
    }
    return () => {
      for (const [property, value, priority] of saved) {
        if (value) surface.style.setProperty(property, value, priority);
        else surface.style.removeProperty(property);
      }
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

// Styles for controls whose surfaces sit inside Lit shadow roots that card-mod
// theme CSS cannot reach. The sheets are appended to each component's static
// Lit styles, so every instance created afterwards adopts them. Shadows and
// tilt read Neumorphism variables, so they are inert under other themes (an
// undefined var() invalidates the declaration); the round-button geometry
// applies under any theme.
// ponytail: instances rendered before this module loads keep their old look
// until re-created; extra_module_url loads before Lovelace resources, so in
// practice none are.
(() => {
  // Mushroom's number/climate "buttons" control (.container > .minus / .plus).
  // The pill and its round buttons are raised; pressing one side rocks it like
  // a switch: that button sinks, the other lifts higher.
  const tilt = (sign) =>
    `perspective(var(--soft-rocker-perspective)) rotateY(calc(${sign} * var(--soft-rocker-tilt)))`;
  const ROCKER = `
    /* The host is the query container so the perspective (in cqw) scales with
       the control's width: a wide pill rocks as much as a narrow one. */
    :host { container-type: inline-size; }
    .container {
      border-radius: var(--soft-control-radius, var(--control-border-radius));
      box-shadow: var(--soft-shadow-small);
      overflow: visible; /* keep the buttons' shadows */
      transition: background-color 280ms ease-in-out, transform 120ms ease-out;
    }
    .button {
      padding: 4px;
      aspect-ratio: 1;
      border-radius: 50%;
      box-shadow: var(--soft-shadow-small);
    }
    .container:has(.plus[data-soft-pressed]) { transform: ${tilt(1)}; }
    .container:has(.minus[data-soft-pressed]) { transform: ${tilt(-1)}; }
    :host(:dir(rtl)) .container:has(.plus[data-soft-pressed]) { transform: ${tilt(-1)}; }
    :host(:dir(rtl)) .container:has(.minus[data-soft-pressed]) { transform: ${tilt(1)}; }
    .container:has(.plus[data-soft-pressed]) .minus,
    .container:has(.minus[data-soft-pressed]) .plus {
      box-shadow: var(--soft-shadow-raised);
    }
    @media (prefers-reduced-motion: reduce) { .container { transition: none; } }
  `;
  const DEEP_STYLES = {
    'mushroom-input-number': ROCKER,
    // HA's numeric tile feature: a raised bar with round raised ± buttons
    // (no rocker; tilting a full-width bar looked wrong).
    'ha-control-number-buttons': `
      :host {
        border-radius: var(--soft-control-radius);
        box-shadow: var(--soft-shadow-small);
      }
      .button {
        top: 4px;
        height: calc(100% - 8px);
        width: auto;
        aspect-ratio: 1;
        border-radius: 50%;
        box-shadow: var(--soft-shadow-small);
      }
      .button.minus { inset-inline-start: 4px; }
      .button.plus { inset-inline-end: 4px; }
    `,
    // The theme no longer recesses the whole number control (its buttons mode
    // is now raised), so recess only the slider mode's track.
    'mushroom-number-value-control': `
      mushroom-slider {
        display: block;
        border-radius: var(--soft-control-radius);
        box-shadow: var(--soft-shadow-inset);
      }
    `,
  };

  for (const [tag, css] of Object.entries(DEEP_STYLES)) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    customElements.whenDefined(tag).then((ElementClass) => {
      ElementClass.elementStyles?.push(sheet);
    });
  }
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
