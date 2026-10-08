import test from 'node:test';
import assert from 'node:assert/strict';
import { SCOPE_98, SCOPE_XP, SCOPE_7, splitSelectors, scopeSelectorList, scopeForFile } from '../tools/scopeSkin.mjs';

test('selector lists split only on top-level commas', () => {
  assert.deepEqual(splitSelectors('a, b > c'), ['a', 'b > c']);
  assert.deepEqual(splitSelectors('button:not(:disabled, .x), [aria-label="a,b"]'), ['button:not(:disabled, .x)', '[aria-label="a,b"]']);
});

test('plain and compound selectors become descendants of the scope', () => {
  assert.equal(scopeSelectorList('button', SCOPE_98), `${SCOPE_98} button`);
  assert.equal(scopeSelectorList('.title-bar-controls button[aria-label=Close], .window', SCOPE_XP),
    `${SCOPE_XP} .title-bar-controls button[aria-label=Close],${SCOPE_XP} .window`);
});

test('html and :root are the scoped element itself; body is a descendant', () => {
  assert.equal(scopeSelectorList('html', SCOPE_98), SCOPE_98);
  assert.equal(scopeSelectorList(':root', SCOPE_XP), SCOPE_XP);
  assert.equal(scopeSelectorList('body', SCOPE_98), `${SCOPE_98} body`);
  assert.equal(scopeSelectorList('htmlx', SCOPE_98), `${SCOPE_98} htmlx`);
});

test('bare pseudo-elements cover the root and its descendants', () => {
  assert.equal(scopeSelectorList('::-webkit-scrollbar', SCOPE_XP), `${SCOPE_XP}::-webkit-scrollbar,${SCOPE_XP} ::-webkit-scrollbar`);
});

test('98 applies whenever no skin attribute is set; 7.css gets its own scope', () => {
  assert.equal(SCOPE_98, ':where(:root:not([data-skin]))');
  assert.equal(scopeForFile('/x/node_modules/7.css/dist/7.css'), SCOPE_7);
  assert.equal(scopeForFile('/x/node_modules/7.css/dist/7.scoped.css'), null);
  assert.equal(scopeSelectorList(':root', SCOPE_7), SCOPE_7);
});

test('only the library files are scoped', () => {
  assert.equal(scopeForFile('/x/node_modules/98.css/dist/98.css'), SCOPE_98);
  assert.equal(scopeForFile('C:\\x\\node_modules\\xp.css\\dist\\XP.css'), SCOPE_XP);
  assert.equal(scopeForFile('/x/node_modules/xp.css/dist/98.css'), null);
  assert.equal(scopeForFile('/x/src/styles/shell.css'), null);
  assert.equal(scopeForFile(undefined), null);
});
