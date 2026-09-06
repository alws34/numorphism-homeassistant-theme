// Run: node tests/check_press.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const events = new Map();
const windowEvents = new Map();
class Element {
  disabled = false;
  values = new Map([['box-shadow', ['original-shadow', 'important']]]);
  style = {
    getPropertyValue: name => this.values.get(name)?.[0] || '',
    getPropertyPriority: name => this.values.get(name)?.[1] || '',
    setProperty: (name, value, priority) => this.values.set(name, [value, priority]),
    removeProperty: name => this.values.delete(name),
  };
  matches(selector) { return selector.includes('button,'); }
  hasAttribute() { return false; }
  getAttribute() { return null; }
}
let themed = true;
runInNewContext(readFileSync(new URL('../frontend/lovelace-soft-press.js', import.meta.url), 'utf8'), {
  Element,
  document: { addEventListener: (name, handler) => events.set(name, handler) },
  window: { addEventListener: (name, handler) => windowEvents.set(name, handler) },
  getComputedStyle: () => ({ getPropertyValue: () => themed ? 'inset 3px 3px 6px #171d25' : '' }),
});
const button = new Element();
const fire = (type, extra = {}) => events.get(type)({ type, button: 0, composedPath: () => [button], ...extra });
const shadow = () => button.style.getPropertyValue('box-shadow');
for (const stop of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  fire('pointerdown');
  assert.match(shadow(), /^inset/);
  fire(stop);
  assert.equal(shadow(), 'original-shadow');
  assert.equal(button.style.getPropertyPriority('box-shadow'), 'important');
  assert.equal(button.style.getPropertyValue('transition'), '');
}
fire('keydown', {key: ' '}); assert.match(shadow(), /^inset/);
fire('keyup'); assert.equal(shadow(), 'original-shadow');
fire('keydown', {key: 'Enter'}); windowEvents.get('blur')();
assert.equal(shadow(), 'original-shadow');
button.disabled = true; fire('pointerdown'); assert.equal(shadow(), 'original-shadow');
button.disabled = false; themed = false; fire('pointerdown'); assert.equal(shadow(), 'original-shadow');
console.log('PASS: press/release, cancellation, keyboard, blur, disabled controls, theme opt-in, exact style restoration');
