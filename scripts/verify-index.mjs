// Checks that the sharded index returns exactly what the original dictionary
// files contain, for EVERY headword and every Arabic reverse-index key, using
// the same functions the Worker uses.
//
//   node scripts/verify-index.mjs --src <ferheng public/data> --index <built dir>
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { shardKey, hexName } from '../src/shards.js';
import { extractEntries, extractReverse } from '../src/lookup.js';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1];
};
const src = arg('src');
const index = arg('index');
if (!src || !index) {
  console.error('Usage: node scripts/verify-index.mjs --src <public/data> --index <dir>');
  process.exit(1);
}

const shardText = new Map();
const readShard = (dir, key) => {
  const path = join(index, dir, `${hexName(key)}.json`);
  if (!shardText.has(path)) shardText.set(path, readFileSync(path, 'utf8'));
  return shardText.get(path);
};
const manifestOf = (dir) => {
  const raw = JSON.parse(readFileSync(join(index, dir, 'index.json'), 'utf8'));
  return { prefixes: new Set(raw.prefixes), maxLen: raw.maxLen, total: raw.total };
};

let failures = 0;
const fail = (msg) => {
  if (failures++ < 15) console.error('FAIL', msg);
};

for (const dialect of ['ku', 'sor', 'zza']) {
  const m = manifestOf(dialect);
  const byWord = new Map();
  let total = 0;
  const dir = join(src, dialect);
  for (const f of readdirSync(dir).filter((n) => /^.+-\d+\.json$/.test(n))) {
    for (const e of JSON.parse(readFileSync(join(dir, f), 'utf8'))) {
      total++;
      const list = byWord.get(e.word);
      if (list) list.push(JSON.stringify(e));
      else byWord.set(e.word, [JSON.stringify(e)]);
    }
  }
  if (total !== m.total) fail(`${dialect}: manifest total ${m.total} != source ${total}`);
  let checked = 0;
  for (const [word, expected] of byWord) {
    const key = shardKey(m.prefixes, m.maxLen, word);
    if (key === null) {
      fail(`${dialect}: no shard for "${word}"`);
      continue;
    }
    const got = extractEntries(readShard(dialect, key), word).map((e) => JSON.stringify(e));
    if (got.length !== expected.length || got.some((g, i) => g !== expected[i])) {
      fail(`${dialect}: "${word}" expected ${expected.length} entries, got ${got.length}`);
    }
    checked++;
  }
  console.log(`${dialect}: ${total} entries, ${checked} distinct headwords checked`);
}

{
  const m = manifestOf('ar');
  const reverse = JSON.parse(readFileSync(join(src, 'ar-reverse-index.json'), 'utf8'));
  let checked = 0;
  for (const [key, value] of Object.entries(reverse)) {
    const shard = shardKey(m.prefixes, m.maxLen, key);
    if (shard === null) {
      fail(`ar: no shard for "${key}"`);
      continue;
    }
    const got = extractReverse(readShard('ar', shard), key);
    if (JSON.stringify(got) !== JSON.stringify(value)) fail(`ar: "${key}" differs`);
    checked++;
  }
  console.log(`ar: ${checked} keys checked`);
}

if (failures) {
  console.error(`\n${failures} FAILURE(S)`);
  process.exit(1);
}
console.log('\nOK: the sharded index matches the source data exactly.');
