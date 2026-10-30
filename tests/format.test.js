import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatEntryBlock, formatArabicMatches, formatNotFound, escapeHtml } from '../src/format.js';

const entry = {
  word: 'av', pos_title: 'Navdêr', glosses: ['a <b>&', 'second\nline'],
  arabic_equivalents: ['ماء', 'آب'], synonyms: ['ab'],
};

test('entry block escapes HTML, shows Arabic equivalents and ends with exactly one link', () => {
  const html = formatEntryBlock('ku', [entry]);
  assert.match(html, /a &lt;b&gt;&amp;/);
  assert.match(html, /بالعربية · Bi Erebî: ماء، آب/);
  assert.match(html, /second line/);
  assert.equal((html.match(/<a /g) || []).length, 1);
  assert.match(html, /href="https:\/\/kurdish-tech\.github\.io\/#\/w\/ku\/av"/);
});

test('link percent-encodes Kurdish letters', () => {
  const html = formatEntryBlock('ku', [{ word: 'kurdî', glosses: ['x'] }]);
  assert.match(html, /w\/ku\/kurd%C3%AE"/);
});

test('arabic matches are de-duplicated and labelled by dialect', () => {
  const html = formatArabicMatches('ماء', [{ d: 'ku', w: 'ab' }, { d: 'ku', w: 'ab' }, { d: 'zza', w: 'awe' }]);
  assert.equal((html.match(/<a /g) || []).length, 2);
  assert.match(html, /Zazakî/);
});

test('not-found message offers suggestions as links', () => {
  const html = formatNotFound('kurd', { ku: ['kurdî'], zza: [] });
  assert.match(html, /Gelo te dixwest/);
  assert.match(html, /w\/ku\/kurd%C3%AE/);
  assert.equal(escapeHtml('<&>'), '&lt;&amp;&gt;');
});

test('Arabic equivalents differing only by diacritics are shown once; junk synonyms are dropped', () => {
  const html = formatEntryBlock('ku', [{
    word: 'av', glosses: ['x'], arabic_equivalents: ['مَاء', 'ماء'], synonyms: ['baran', ',', ' '],
  }]);
  assert.match(html, /Bi Erebî: مَاء(?!،)/);
  assert.match(html, /Hevwate: baran(?!,)/);
});
