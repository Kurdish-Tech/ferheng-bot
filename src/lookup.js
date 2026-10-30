// Dictionary lookups against small pre-split shards (see src/shards.js).
//
// Workers on the free plan get ~10ms of CPU per request, so a lookup must
// not decode or parse much data: each shard is at most ~120KB, and we search
// its raw text, JSON.parse-ing only the few entries found. That is safe
// because every entry starts with `{"word":"` and a literal `"word":"` can't
// occur inside a JSON string (its quotes would be escaped).
import { DEFAULT_DATA_BASE } from './config.js';
import { shardKey, hexName } from './shards.js';

let dataBase = DEFAULT_DATA_BASE;
export function configure(env) {
  if (env?.DATA_BASE) dataBase = String(env.DATA_BASE).replace(/\/+$/, '');
}

const textMemo = new Map();
const MEMO_LIMIT = 30;
const manifestMemo = new Map();

async function fetchText(path) {
  const url = `${dataBase}/${path}`;
  const hit = textMemo.get(url);
  if (hit !== undefined) {
    textMemo.delete(url);
    textMemo.set(url, hit);
    return hit;
  }
  const res = await fetch(url, { cf: { cacheTtl: 86400, cacheEverything: true } });
  if (!res.ok) throw new Error(`${res.status} fetching ${path}`);
  const text = await res.text();
  textMemo.set(url, text);
  if (textMemo.size > MEMO_LIMIT) textMemo.delete(textMemo.keys().next().value);
  return text;
}

/** dir is 'ku' | 'sor' | 'zza' | 'ar'. */
async function getManifest(dir) {
  const hit = manifestMemo.get(`${dataBase}|${dir}`);
  if (hit) return hit;
  const raw = JSON.parse(await fetchText(`${dir}/index.json`));
  const manifest = { prefixes: new Set(raw.prefixes), list: raw.prefixes, maxLen: raw.maxLen };
  manifestMemo.set(`${dataBase}|${dir}`, manifest);
  return manifest;
}

async function shardPath(dir, text) {
  const m = await getManifest(dir);
  const key = shardKey(m.prefixes, m.maxLen, text);
  return key === null ? null : `${dir}/${hexName(key)}.json`;
}

/** All entries whose headword is exactly `word`, parsed from raw shard text. */
export function extractEntries(text, word) {
  const needle = `{"word":${JSON.stringify(word)},`;
  const out = [];
  let from = 0;
  for (;;) {
    const i = text.indexOf(needle, from);
    if (i === -1) break;
    const j = text.indexOf('},{"word":', i + 1);
    const raw = j === -1 ? text.slice(i, text.lastIndexOf('}') + 1) : text.slice(i, j + 1);
    try {
      out.push(JSON.parse(raw));
    } catch {
      // A malformed slice is skipped rather than failing the whole lookup.
    }
    from = i + needle.length;
  }
  return out;
}

function caseVariants(word) {
  const lower = word.toLowerCase();
  const capital = lower.charAt(0).toUpperCase() + lower.slice(1);
  return [...new Set([word, lower, capital])];
}

export async function findEntries(dialectKey, word, { exactCase = false } = {}) {
  const path = await shardPath(dialectKey, word);
  if (!path) return [];
  const text = await fetchText(path);
  const seen = new Set();
  const found = [];
  for (const variant of exactCase ? [word.toLowerCase()] : caseVariants(word)) {
    for (const entry of extractEntries(text, variant)) {
      const key = `${entry.word}|${entry.pos}|${(entry.glosses || [])[0] || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push(entry);
    }
  }
  return found;
}

/** Up to `limit` distinct headwords starting with `prefix` ("did you mean"). */
export async function suggestWords(dialectKey, prefix, limit = 5) {
  const lower = prefix.toLowerCase();
  const m = await getManifest(dialectKey);
  // Shards that can hold words starting with `lower`: those whose key is a
  // prefix of it (longest first) and those that extend it (alphabetical).
  const prefixes = m.list.filter((k) => lower.startsWith(k)).sort((a, b) => b.length - a.length);
  const extensions = m.list.filter((k) => k.startsWith(lower) && k !== lower).sort();
  const keys = [...new Set([...prefixes.slice(0, 1), ...(m.prefixes.has(lower) ? [lower] : []), ...extensions])].slice(0, 4);
  const needle = `{"word":${JSON.stringify(lower).slice(0, -1)}`;
  const words = new Set();
  for (const k of keys) {
    const text = await fetchText(`${dialectKey}/${hexName(k)}.json`);
    let from = 0;
    while (words.size < limit) {
      const i = text.indexOf(needle, from);
      if (i === -1) break;
      const start = i + '{"word":"'.length;
      const end = text.indexOf('"', start);
      const w = text.slice(start, end);
      if (w && w !== lower) words.add(w);
      from = end + 1;
    }
    if (words.size >= limit) break;
  }
  return [...words];
}

const ARABIC_RE = /[؀-ۿ]/;
export const looksArabicScript = (s) => ARABIC_RE.test(s);
export const stripArabicDiacritics = (s) => s.replace(/[ً-ْٰـ]/g, '').trim();

/** Arabic typed on an Arabic keyboard -> the Kurdish/Persian letter forms Sorani uses. */
export const toSoraniLetters = (s) =>
  s.replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/ة/g, 'ە');

/** Kurdish headwords whose Arabic equivalents include `key` (shard text is a JSON object body). */
export function extractReverse(text, key) {
  const needle = `${JSON.stringify(key)}:[`;
  const i = text.indexOf(needle);
  if (i === -1) return [];
  const start = i + needle.length - 1;
  const end = text.indexOf(']', start);
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
}

export async function findArabicMatches(arabicWord) {
  const key = stripArabicDiacritics(arabicWord);
  const path = await shardPath('ar', key);
  if (!path) return [];
  return extractReverse(await fetchText(path), key);
}

// Letters Kurdish orthographies use that plain Arabic does not (Sorani-specific).
const KURDISH_LETTERS_RE = /[ڕڵۆێەپچگکیژڤھ]/;
export const hasKurdishLetters = (s) => KURDISH_LETTERS_RE.test(s);

// People often type Kurmancî/Zazakî without the special letters (kurdi for
// kurdî). These are the plain letters that have a special counterpart.
const SPECIAL = {
  ku: { c: 'ç', e: 'ê', i: 'î', s: 'ş', u: 'û' },
  zza: { c: 'ç', e: 'ê', i: 'î', s: 'ş', u: 'ü' },
};
const MAX_FUZZY_POSITIONS = 4;

/**
 * Spelling variants of `word` with some plain letters swapped for their
 * special forms, fewest changes first (grouped by number of changes) so a
 * caller can stop at the first level that finds anything. Capped at 2^4 - 1
 * variants to keep CPU use bounded.
 */
export function accentVariants(dialectKey, word) {
  const map = SPECIAL[dialectKey];
  if (!map) return [];
  const chars = [...word.toLowerCase()];
  const positions = chars.map((c, i) => (map[c] ? i : -1)).filter((i) => i >= 0).slice(0, MAX_FUZZY_POSITIONS);
  const levels = [];
  for (let mask = 1; mask < 1 << positions.length; mask++) {
    const out = [...chars];
    let bits = 0;
    positions.forEach((p, k) => {
      if (mask & (1 << k)) {
        out[p] = map[chars[p]];
        bits++;
      }
    });
    (levels[bits] ||= []).push(out.join(''));
  }
  return levels.filter(Boolean);
}

/** Retry with accents restored (kurdi -> kurdî). `skipDirect` skips the plain lookup. */
export async function findEntriesWithAccents(dialectKey, word, { skipDirect = false } = {}) {
  if (!skipDirect) {
    const direct = await findEntries(dialectKey, word);
    if (direct.length) return { entries: direct, corrected: null };
  }
  for (const level of accentVariants(dialectKey, word)) {
    const lists = await Promise.all(level.map((v) => findEntries(dialectKey, v, { exactCase: true })));
    const hit = lists.findIndex((l) => l.length);
    if (hit !== -1) return { entries: lists[hit], corrected: level[hit] };
  }
  return { entries: [], corrected: null };
}

/** A random {d, w} from the Arabic reverse index — words that have an Arabic translation. */
export async function randomTranslatedWord() {
  const m = await getManifest('ar');
  for (let attempt = 0; attempt < 5; attempt++) {
    const prefix = m.list[Math.floor(Math.random() * m.list.length)];
    const text = await fetchText(`ar/${hexName(prefix)}.json`);
    const start = Math.floor(Math.random() * Math.max(1, text.length - 50));
    const i = text.indexOf('{"d":"', start);
    if (i === -1) continue;
    const j = text.indexOf('}', i);
    try {
      const pick = JSON.parse(text.slice(i, j + 1));
      if (pick.d && pick.w) return pick;
    } catch {
      // try another position
    }
  }
  return { d: 'ku', w: 'av' };
}
