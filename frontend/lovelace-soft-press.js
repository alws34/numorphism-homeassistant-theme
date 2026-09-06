// Momentary feedback across open shadow roots; active only with Lovelace Soft.
// No event cancellation: the original click, hold, and keyboard actions still run.
(() => {
  let release = () => {};
  const buttons = 'button, [role="button"], [role="switch"], a[href], input[type="button"], input[type="submit"], input[type="checkbox"], input[type="radio"], ha-button, ha-icon-button';

  function press(event) {
    if (event.type === 'pointerdown' && event.button !== 0) return;
    if (event.type === 'keydown' && (event.repeat || ![' ', 'Enter'].includes(event.key))) return;
    const path = event.composedPath().filter(node => node instanceof Element);
    if (path.some(node => node.disabled || node.hasAttribute('disabled') || node.getAttribute('aria-disabled') === 'true' || node.hasAttribute('inert'))) return;

    // Prefer the actual button inside a component, then its exposed action host.
    let surface = path.find(node => node.matches(buttons));
    if (!surface && event.type === 'pointerdown') {
      const action = path.find(node => node.matches('.bubble-action-enabled, .bubble-close-button, mushroom-state-item, mushroom-chip'));
      if (action?.matches('mushroom-state-item')) surface = action.closest('ha-card');
      else if (action?.matches('mushroom-chip')) surface = action.shadowRoot?.querySelector('ha-card');
      else if (action) surface = action.closest('.bubble-icon-container, .bubble-sub-button, .bubble-button, .bubble-media-button, .bubble-climate-button, .bubble-close-button') || action.closest('.bubble-container') || action;
      // Generic custom cards commonly expose actions through a pointer cursor.
      if (!surface) surface = path.find(node => node.matches('ha-card') && getComputedStyle(node).cursor === 'pointer');
    }
    if (!surface) return;
    const shadow = getComputedStyle(surface).getPropertyValue('--soft-shadow-inset').trim();
    if (!shadow) return;
    release();
    const saved = ['box-shadow', 'transition'].map(name => [name, surface.style.getPropertyValue(name), surface.style.getPropertyPriority(name)]);
    surface.style.setProperty('box-shadow', shadow, 'important');
    surface.style.setProperty('transition', 'none', 'important');
    release = () => {
      for (const [name, value, priority] of saved) {
        if (value) surface.style.setProperty(name, value, priority);
        else surface.style.removeProperty(name);
      }
      release = () => {};
    };
  }

  document.addEventListener('pointerdown', press, true);
  document.addEventListener('keydown', press, true);
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture', 'keyup']) {
    document.addEventListener(name, () => release(), true);
  }
  window.addEventListener('blur', () => release());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) release();
  });
})();
