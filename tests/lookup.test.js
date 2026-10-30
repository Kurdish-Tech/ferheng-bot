import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractEntries, extractReverse, stripArabicDiacritics, toSoraniLetters, partOverlapsPrefix,
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

test('partOverlapsPrefix keeps only shards whose range can contain the word', () => {
  const part = { first: 'b', last: 'berwesêla' };
  assert.equal(partOverlapsPrefix(part, 'ba'), true);
  assert.equal(partOverlapsPrefix(part, 'bi'), false);
});
