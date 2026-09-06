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
})();
