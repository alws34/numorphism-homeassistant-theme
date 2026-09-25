// Run: node tests/check_press.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const documentListeners = new Map();
const windowListeners = new Map();

class FakeElement {
  constructor(options = {}) {
    Object.assign(this, {
      isExplicitButton: false, cursor: 'auto', display: 'block', disabled: false,
      backgroundColor: 'rgba(0, 0, 0, 0)', boxShadow: 'none', borderRadius: '0px',
    }, options);
    this.inlineStyles = new Map([['box-shadow', ['original-shadow', 'important']]]);
    this.attributes = new Set();
    this.style = {
      getPropertyValue: (property) => this.inlineStyles.get(property)?.[0] || '',
      getPropertyPriority: (property) => this.inlineStyles.get(property)?.[1] || '',
      setProperty: (property, value, priority) => this.inlineStyles.set(property, [value, priority]),
      removeProperty: (property) => this.inlineStyles.delete(property),
    };
  }
  matches(selector) { return this.isExplicitButton && selector.includes('button,'); }
  hasAttribute(name) { return this.attributes.has(name); }
  getAttribute() { return null; }
  setAttribute(name) { this.attributes.add(name); }
  removeAttribute(name) { this.attributes.delete(name); }
}

// Lit component classes whose static styles the module extends.
const componentClasses = new Map();
const customElements = {
  whenDefined: (tag) => {
    componentClasses.set(tag, { elementStyles: [] });
    return Promise.resolve(componentClasses.get(tag));
  },
};
class FakeStyleSheet { replaceSync(css) { this.css = css; } }

let themeDefinesInsetShadow = true;
runInNewContext(readFileSync(new URL('../frontend/neumorphism-press.js', import.meta.url), 'utf8'), {
  Element: FakeElement,
  customElements,
  CSSStyleSheet: FakeStyleSheet,
  document: { addEventListener: (name, handler) => documentListeners.set(name, handler), querySelector: () => null },
  window: { addEventListener: (name, handler) => windowListeners.set(name, handler) },
  getComputedStyle: (element) => ({
    getPropertyValue: (property) =>
      property === '--soft-shadow-inset' ? (themeDefinesInsetShadow ? 'inset 3px 3px 6px #171d25' : '') : '',
    cursor: element.cursor,
    display: element.display,
    backgroundColor: element.backgroundColor,
    boxShadow: element.boxShadow,
    borderRadius: element.borderRadius,
  }),
});

const fire = (type, target, extra = {}) =>
  documentListeners.get(type)({ type, button: 0, composedPath: () => [target], ...extra });
const boxShadow = (element) => element.style.getPropertyValue('box-shadow');

// Explicit button: press / release / cancel / keyboard / blur / disabled / theme opt-in.
const button = new FakeElement({ isExplicitButton: true });
for (const endEvent of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  fire('pointerdown', button);
  assert.match(boxShadow(button), /^inset/);
  assert.ok(button.hasAttribute('data-soft-pressed'));
  fire(endEvent, button);
  assert.equal(boxShadow(button), 'original-shadow');
  assert.ok(!button.hasAttribute('data-soft-pressed'));
  assert.equal(button.style.getPropertyPriority('box-shadow'), 'important');
  assert.equal(button.style.getPropertyValue('transition'), '');
}
fire('keydown', button, { key: ' ' }); assert.match(boxShadow(button), /^inset/);
fire('keyup', button); assert.equal(boxShadow(button), 'original-shadow');
fire('keydown', button, { key: 'Enter' }); windowListeners.get('blur')();
assert.equal(boxShadow(button), 'original-shadow');
button.disabled = true; fire('pointerdown', button); assert.equal(boxShadow(button), 'original-shadow');
button.disabled = false; themeDefinesInsetShadow = false; fire('pointerdown', button);
assert.equal(boxShadow(button), 'original-shadow');
themeDefinesInsetShadow = true;

// Non-button clickable surface (badge / tile / entity row): cursor:pointer is enough.
const badge = new FakeElement({ cursor: 'pointer' });
fire('pointerdown', badge); assert.match(boxShadow(badge), /^inset/);
fire('pointerup', badge); assert.equal(boxShadow(badge), 'original-shadow');

// Icon inside a clickable div inherits cursor:pointer; the div, not the icon, is pressed.
const mediaButton = new FakeElement({ cursor: 'pointer', backgroundColor: 'rgb(37, 45, 56)' });
const icon = new FakeElement({ cursor: 'pointer', display: 'flex' });
documentListeners.get('pointerdown')({ type: 'pointerdown', button: 0, composedPath: () => [icon, mediaButton] });
assert.equal(boxShadow(icon), 'original-shadow');
assert.match(boxShadow(mediaButton), /^inset/);
fire('pointerup', mediaButton);

// Bubble's tap layer sits behind the text at half opacity; its visible pill is pressed.
const bubblePill = new FakeElement();
const bubbleLayer = new FakeElement({
  cursor: 'pointer', borderRadius: '24px',
  classList: { contains: (name) => name === 'bubble-background' },
  closest: (selector) => (selector === '.bubble-container' ? bubblePill : null),
});
fire('pointerdown', bubbleLayer);
assert.equal(boxShadow(bubbleLayer), 'original-shadow');
assert.match(boxShadow(bubblePill), /^inset/);
fire('pointerup', bubbleLayer);
assert.equal(boxShadow(bubblePill), 'original-shadow');

// Inline text link: clickable but must not get a card press.
const inlineLink = new FakeElement({ cursor: 'pointer', display: 'inline' });
fire('pointerdown', inlineLink); assert.equal(boxShadow(inlineLink), 'original-shadow');

// Keyboard activation only applies to explicit buttons, not generic pointer surfaces.
fire('keydown', badge, { key: 'Enter' }); assert.equal(boxShadow(badge), 'original-shadow');

// ± rocker: raised pill, tilt keyed to the pressed side, slider mode stays recessed.
await Promise.resolve();
const deepCss = (tag) => componentClasses.get(tag)?.elementStyles.map((sheet) => sheet.css).join('');
// HA's numeric feature: raised bar and round raised buttons, but no rocker tilt.
assert.match(deepCss('ha-control-number-buttons'), /:host \{[^}]*box-shadow: var\(--soft-shadow-small\)/);
assert.match(deepCss('ha-control-number-buttons'), /\.button \{[^}]*border-radius: 50%[^}]*box-shadow: var\(--soft-shadow-small\)/);
assert.doesNotMatch(deepCss('ha-control-number-buttons'), /transform/);
for (const tag of ['mushroom-input-number']) {
  assert.match(deepCss(tag), /\.container \{[^}]*box-shadow: var\(--soft-shadow-small\)/);
  assert.match(deepCss(tag), /\.button \{[^}]*box-shadow: var\(--soft-shadow-small\)/);
  assert.match(deepCss(tag), /\.container:has\(\.plus\[data-soft-pressed\]\) \{ transform: .*rotateY\(calc\(1 \*/);
  assert.match(deepCss(tag), /\.container:has\(\.minus\[data-soft-pressed\]\) \{ transform: .*rotateY\(calc\(-1 \*/);
}
assert.match(deepCss('mushroom-number-value-control'), /mushroom-slider \{[^}]*--soft-shadow-inset/);

console.log('PASS: explicit + generic clickable surfaces, inline links skipped, keyboard scope, cancellation, blur, disabled, theme opt-in, exact style restoration, pressed marker, inherited-cursor icons skipped, Bubble pill pressed, ± rocker styles');
