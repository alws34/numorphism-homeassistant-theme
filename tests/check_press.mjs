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
      width: 100, height: 40,
    }, options);
    this.inlineStyles = new Map([['box-shadow', ['original-shadow', 'important']]]);
    this.attributes = new Set();
    this.children = options.children ?? [];
    for (const child of this.children) child.parentElement = this;
    this.style = {
      getPropertyValue: (property) => this.inlineStyles.get(property)?.[0] || '',
      getPropertyPriority: (property) => this.inlineStyles.get(property)?.[1] || '',
      setProperty: (property, value, priority) => this.inlineStyles.set(property, [value, priority]),
      removeProperty: (property) => this.inlineStyles.delete(property),
    };
  }
  get localName() { return this.tag ?? 'div'; }
  matches(selector) { return this.isExplicitButton && selector.includes('button,'); }
  hasAttribute(name) { return this.attributes.has(name); }
  getAttribute() { return null; }
  setAttribute(name) { this.attributes.add(name); }
  removeAttribute(name) { this.attributes.delete(name); }
  querySelectorAll() { return this.children.flatMap((child) => [child, ...child.querySelectorAll()]); }
  getBoundingClientRect() { return { width: this.width, height: this.height }; }
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
      !themeDefinesInsetShadow ? ''
        : property === '--soft-shadow-inset' ? 'inset 3px 3px 6px #171d25'
        : property === '--soft-shadow-inset-deep' ? 'inset 6px 6px 12px #171d25' : '',
    cursor: element.cursor,
    display: element.display,
    backgroundColor: element.backgroundColor,
    boxShadow: element.boxShadow,
    borderRadius: element.borderRadius,
  }),
});

const fire = (type, target, extra = {}) =>
  documentListeners.get(type)({ type, button: 0, composedPath: () => [target], ...extra });
const pressPath = (...path) =>
  documentListeners.get('pointerdown')({ type: 'pointerdown', button: 0, composedPath: () => path });
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
pressPath(icon, mediaButton);
assert.equal(boxShadow(icon), 'original-shadow');
assert.match(boxShadow(mediaButton), /^inset/);
fire('pointerup', mediaButton);

// Full-size see-through tap layer over a raised card (Bubble button, HA tile):
// the raised card sinks, not the layer.
const card = { width: 300, height: 56, boxShadow: '6px 6px 12px #171d25' };
const raisedCard = new FakeElement(card);
const wrapper = new FakeElement({ width: 300, height: 56 });
const tapLayer = new FakeElement({ cursor: 'pointer', borderRadius: '24px', width: 300, height: 56 });
pressPath(tapLayer, wrapper, raisedCard);
assert.equal(boxShadow(tapLayer), 'original-shadow');
assert.match(boxShadow(raisedCard), /^inset/);
fire('pointerup', tapLayer);
assert.equal(boxShadow(raisedCard), 'original-shadow');

// An opaque tap layer (Bubble switch that is on) would hide the card's inset: both sink.
const opaqueLayer = new FakeElement({
  cursor: 'pointer', borderRadius: '24px', width: 300, height: 56, backgroundColor: 'rgb(41, 70, 75)',
});
pressPath(opaqueLayer, raisedCard);
assert.match(boxShadow(opaqueLayer), /^inset/);
assert.match(boxShadow(raisedCard), /^inset/);
fire('pointerup', opaqueLayer);
assert.equal(boxShadow(opaqueLayer), 'original-shadow');

// Mushroom state item inside a card it mostly fills: the card sinks.
const stateItem = new FakeElement({ cursor: 'pointer', borderRadius: '0px', width: 276, height: 42 });
pressPath(stateItem, new FakeElement({ width: 300, height: 66, ...card }));
assert.equal(boxShadow(stateItem), 'original-shadow');
fire('pointerup', stateItem);

// Entities-card row: a small part of its card, so the row itself sinks, with
// rounded corners while held and its exact radius restored after.
const row = new FakeElement({ cursor: 'pointer', borderRadius: '0px', width: 300, height: 40 });
const entitiesCard = new FakeElement({ width: 300, height: 220, boxShadow: '6px 6px 12px #171d25' });
pressPath(row, entitiesCard);
assert.match(boxShadow(row), /^inset/);
assert.equal(boxShadow(entitiesCard), 'original-shadow');
assert.equal(row.style.getPropertyValue('border-radius'), 'var(--soft-control-radius)');
fire('pointerup', row);
assert.equal(row.style.getPropertyValue('border-radius'), '');

// inline-flex buttons (state badges, chips) are pressable; display:contents wrappers are not.
const stateBadge = new FakeElement({ cursor: 'pointer', display: 'inline-flex', borderRadius: '50%' });
fire('pointerdown', stateBadge); assert.match(boxShadow(stateBadge), /^inset/);
fire('pointerup', stateBadge);
const contentsWrapper = new FakeElement({ cursor: 'pointer', display: 'contents' });
fire('pointerdown', contentsWrapper); assert.equal(boxShadow(contentsWrapper), 'original-shadow');

// button-card: decorative pills/rings inside the card inherit cursor:pointer and
// have fills; the raised card sinks, and deeper, since it is large.
const buttonCard = new FakeElement({ tag: 'ha-card', cursor: 'pointer', width: 374, height: 132, boxShadow: '6px 6px 12px #171d25' });
const pill = new FakeElement({
  cursor: 'pointer', display: 'inline-flex', borderRadius: '999px', backgroundColor: 'rgb(53, 65, 80)',
  boxShadow: '3px 3px 6px #171d25', // raised by the card template, but only decoration
});
const customField = new FakeElement({ cursor: 'pointer', width: 364, height: 114 });
pressPath(pill, customField, buttonCard, new FakeElement());
assert.equal(boxShadow(pill), 'original-shadow');
assert.equal(boxShadow(buttonCard), 'inset 6px 6px 12px #171d25');
fire('pointerup', pill);

// A nested raised button inside that card (the lock button) presses on its own.
const lockButton = new FakeElement({ tag: 'ha-card', cursor: 'pointer', width: 58, height: 58, boxShadow: '3px 3px 6px #171d25' });
pressPath(new FakeElement({ cursor: 'pointer', width: 58, height: 58 }), lockButton, customField, buttonCard);
assert.equal(boxShadow(lockButton), 'inset 3px 3px 6px #171d25');
assert.equal(boxShadow(buttonCard), 'original-shadow');
fire('pointerup', lockButton);

// Sections dashboards: every card sits in an <ha-sortable> that is disabled
// outside edit mode. A disabled ancestor must not block the card's press.
const sortable = new FakeElement({ disabled: true });
const sectionCard = new FakeElement({ tag: 'ha-card', cursor: 'pointer', width: 374, height: 132, boxShadow: '6px 6px 12px #171d25' });
pressPath(new FakeElement({ cursor: 'pointer' }), sectionCard, new FakeElement(), sortable);
assert.match(boxShadow(sectionCard), /^inset/);
fire('pointerup', sectionCard);

// Raised decorations a card draws (icon rings) sink with the card; a separate
// control inside it (own cursor, parent not pointer) does not.
const ring = new FakeElement({ cursor: 'pointer', width: 48, height: 48, borderRadius: '50%', boxShadow: '3px 3px 6px #171d25' });
// A convex icon disc: outer drop shadow plus an inner highlight rim.
const convexDisc = new FakeElement({ cursor: 'pointer', width: 42, height: 42, boxShadow: 'rgb(23, 29, 37) 2px 3px 6px 0px, rgb(53, 65, 80) 1px 1px 1px 0px inset' });
const ringHolder = new FakeElement({ cursor: 'pointer', children: [ring, convexDisc] });
const separateButton = new FakeElement({ cursor: 'pointer', width: 36, height: 36, boxShadow: '3px 3px 6px #171d25' });
const quietWrapper = new FakeElement({ children: [separateButton] });
const gridCard = new FakeElement({
  tag: 'ha-card', cursor: 'pointer', width: 120, height: 132, boxShadow: '6px 6px 12px #171d25',
  children: [ringHolder, quietWrapper],
});
pressPath(new FakeElement({ cursor: 'pointer' }), gridCard);
assert.match(boxShadow(gridCard), /^inset 6px/);
assert.match(boxShadow(ring), /^inset 3px/);
assert.match(boxShadow(convexDisc), /^inset 3px/);
assert.equal(boxShadow(separateButton), 'original-shadow');
fire('pointerup', gridCard);
assert.equal(boxShadow(ring), 'original-shadow');

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

console.log('PASS: explicit + generic clickable surfaces, inline links skipped, keyboard scope, cancellation, blur, disabled, theme opt-in, exact style restoration, pressed marker, inherited-cursor icons skipped, raised card under tap layers/state items, opaque layers, rounded rows, inline-flex buttons, decorative content ignored, nested raised buttons, deep inset on big cards, disabled ancestors (ha-sortable) ignored, decorations sink with their card, ± rocker styles');
