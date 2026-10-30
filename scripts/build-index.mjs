// Builds the small-shard index the Worker reads (see src/shards.js).
//
//   node scripts/build-index.mjs --src <ferheng public/data dir> --out <output dir>
//
// Input:  {ku,sor,zza}/<letter>-<n>.json (arrays of entries) and ar-reverse-index.json
// Output: <out>/{ku,sor,zza,ar}/index.json plus one <hex-prefix>.json per shard.
// Entries are re-serialised with JSON.stringify so every one starts with
// {"word":"...", exactly as the Worker's text search expects.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { splitIntoShards, hexName, MAX_PREFIX } from '../src/shards.js';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1];
};
const src = arg('src');
const out = arg('out');
if (!src || !out) {
  console.error('Usage: node scripts/build-index.mjs --src <public/data> --out <dir>');
  process.exit(1);
}

const toItem = (key, text) => ({
  chars: Array.from(key.toLowerCase()),
  text,
  bytes: Buffer.byteLength(text),
});

function writeShards(dir, shards, open, close, extra) {
  mkdirSync(join(out, dir), { recursive: true });
  let biggest = 0;
  for (const [prefix, items] of shards) {
    const body = open + items.map((it) => it.text).join(',') + close;
    biggest = Math.max(biggest, Buffer.byteLength(body));
    writeFileSync(join(out, dir, `${hexName(prefix)}.json`), body);
  }
  const manifest = { ...extra, maxLen: MAX_PREFIX, prefixes: [...shards.keys()].sort() };
  writeFileSync(join(out, dir, 'index.json'), JSON.stringify(manifest));
  return { shards: shards.size, biggest };
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const dialect of ['ku', 'sor', 'zza']) {
  const dir = join(src, dialect);
  const items = [];
  for (const f of readdirSync(dir).filter((n) => /^.+-\d+\.json$/.test(n))) {
    for (const entry of JSON.parse(readFileSync(join(dir, f), 'utf8'))) {
      items.push(toItem(entry.word, JSON.stringify(entry)));
    }
  }
  const stats = writeShards(dialect, splitIntoShards(items), '[', ']', { dialect, total: items.length });
  console.log(`${dialect}: ${items.length} entries -> ${stats.shards} shards, largest ${(stats.biggest / 1024).toFixed(0)} KB`);
}

const reverse = JSON.parse(readFileSync(join(src, 'ar-reverse-index.json'), 'utf8'));
const arItems = Object.entries(reverse).map(([key, value]) =>
  toItem(key, `${JSON.stringify(key)}:${JSON.stringify(value)}`)
);
const arStats = writeShards('ar', splitIntoShards(arItems), '{', '}', { dialect: 'ar', total: arItems.length });
console.log(`ar: ${arItems.length} keys -> ${arStats.shards} shards, largest ${(arStats.biggest / 1024).toFixed(0)} KB`);

writeFileSync(join(out, '.nojekyll'), '');
writeFileSync(
  join(out, 'index.html'),
  '<!doctype html><meta charset="utf-8"><title>Ferheng bot data</title>' +
    '<p>Generated lookup shards for the Ferheng Telegram bot, derived from the ' +
    '<a href="https://kurdish-tech.github.io/">Kurdish-Tech Ferheng dictionary</a> ' +
    '(content from Wiktionary contributors).</p>' +
    '<p>License: <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>. ' +
    'Attribution: Wiktionary contributors and Kurdish-Tech. Share alike.</p>'
);
if (!existsSync(join(out, 'ku', 'index.json'))) process.exit(1);
