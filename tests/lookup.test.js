import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractEntries, extractReverse, stripArabicDiacritics, toSoraniLetters,
} from '../src/lookup.js';

const SHARD =
  '[{"word":"a","pos":"character","pos_title":"Tîp","glosses":["x"]},' +
  '{"word":"av","pos":"noun","pos_title":"Navdêr","glosses":["water \\"quoted\\"","y"],"arabic_equivalents":["ماء"]},' +
  '{"word":"av","pos":"verb","pos_title":"Lêker","glosses":["z"]},' +
  '{"word":"avî","pos":"noun","pos_title":"Navdêr","glosses":["last"]}]';

test('extractEntries returns every entry for an exact headword, including the last one', () => {
  assert.equal(extractEntries(SHARD, 'av').length, 2);
  assert.equal(extractEntries(SHARD, 'av')[0].glosses[0], 'water "quoted"');
  assert.equal(extractEntries(SHARD, 'avî')[0].glosses[0], 'last');
  assert.equal(extractEntries(SHARD, 'a').length, 1);
});

test('extractEntries does not match a longer headword that merely starts with the query', () => {
  assert.equal(extractEntries(SHARD, 'avi').length, 0);
  assert.equal(extractEntries(SHARD, 'nope').length, 0);
});

const REVERSE = '{"ماء":[{"d":"ku","w":"ab"},{"d":"sor","w":"ab"}],"آب":[{"d":"ku","w":"gilavêj"}]}';

test('extractReverse finds the right key and parses only its array', () => {
  assert.deepEqual(extractReverse(REVERSE, 'ماء'), [{ d: 'ku', w: 'ab' }, { d: 'sor', w: 'ab' }]);
  assert.deepEqual(extractReverse(REVERSE, 'آب'), [{ d: 'ku', w: 'gilavêj' }]);
  assert.deepEqual(extractReverse(REVERSE, 'غير'), []);
});

test('Arabic helpers', () => {
  assert.equal(stripArabicDiacritics('مَاءٌ'), 'ماء');
  assert.equal(toSoraniLetters('كردي'), 'کردی');
});

import { splitIntoShards, shardKey, hexName } from '../src/shards.js';

const item = (word, bytes = 10) => ({ chars: Array.from(word.toLowerCase()), bytes, word });

test('hexName is file-safe and reversible by code point', () => {
  assert.equal(hexName('ab'), '61-62');
  assert.equal(hexName('û'), 'fb');
  assert.match(hexName('a/b?'), /^[0-9a-f-]+$/);
});

test('every word is found in exactly the shard shardKey points to, including exact-prefix words', () => {
  const words = ['a', 'ab', 'aba', 'abb', 'abc', 'abd', 'b', 'bi', 'Bin', 'avî', 'avê'];
  const items = words.map((w) => item(w, 40));
  const shards = splitIntoShards(items, { limit: 100, maxPrefix: 4 });
  const prefixes = new Set(shards.keys());
  const has = (p) => prefixes.has(p);
  assert.ok(shards.size > 1);
  for (const w of words) {
    const key = shardKey(has, 4, w);
    assert.ok(key, `no shard for ${w}`);
    assert.ok(shards.get(key).some((it) => it.word === w), `${w} missing from shard ${key}`);
  }
  assert.equal(shardKey(has, 4, 'zzz'), null);
});

test('shards stay under the limit when a split is possible', () => {
  const items = Array.from({ length: 200 }, (_, i) => item(`k${String.fromCharCode(97 + (i % 26))}${i}`, 50));
  const shards = splitIntoShards(items, { limit: 600, maxPrefix: 6 });
  for (const group of shards.values()) {
    const size = group.reduce((n, it) => n + it.bytes + 1, 2);
    assert.ok(size <= 600 || group[0].chars.length >= 6);
  }
  assert.equal([...shards.values()].flat().length, 200);
});
