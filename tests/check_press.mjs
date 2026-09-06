// Run: node tests/check_press.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const documentListeners = new Map();
const windowListeners = new Map();

class FakeElement {
  constructor(options = {}) {
    Object.assign(this, { isExplicitButton: false, cursor: 'auto', display: 'block', disabled: false }, options);
    this.inlineStyles = new Map([['box-shadow', ['original-shadow', 'important']]]);
    this.style = {
      getPropertyValue: (property) => this.inlineStyles.get(property)?.[0] || '',
      getPropertyPriority: (property) => this.inlineStyles.get(property)?.[1] || '',
      setProperty: (property, value, priority) => this.inlineStyles.set(property, [value, priority]),
      removeProperty: (property) => this.inlineStyles.delete(property),
    };
  }
  matches(selector) { return this.isExplicitButton && selector.includes('button,'); }
  hasAttribute() { return false; }
  getAttribute() { return null; }
}

let themeDefinesInsetShadow = true;
runInNewContext(readFileSync(new URL('../frontend/neumorphism-press.js', import.meta.url), 'utf8'), {
  Element: FakeElement,
  document: { addEventListener: (name, handler) => documentListeners.set(name, handler) },
  window: { addEventListener: (name, handler) => windowListeners.set(name, handler) },
  getComputedStyle: (element) => ({
    getPropertyValue: (property) =>
      property === '--soft-shadow-inset' ? (themeDefinesInsetShadow ? 'inset 3px 3px 6px #171d25' : '') : '',
    cursor: element.cursor,
    display: element.display,
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
  fire(endEvent, button);
  assert.equal(boxShadow(button), 'original-shadow');
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

// Inline text link: clickable but must not get a card press.
const inlineLink = new FakeElement({ cursor: 'pointer', display: 'inline' });
fire('pointerdown', inlineLink); assert.equal(boxShadow(inlineLink), 'original-shadow');

// Keyboard activation only applies to explicit buttons, not generic pointer surfaces.
fire('keydown', badge, { key: 'Enter' }); assert.equal(boxShadow(badge), 'original-shadow');

console.log('PASS: explicit + generic clickable surfaces, inline links skipped, keyboard scope, cancellation, blur, disabled, theme opt-in, exact style restoration');
