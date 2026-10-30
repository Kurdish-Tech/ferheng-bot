// Shared by the Worker (lookup) and the index builder (scripts/build-index.mjs),
// so both always agree on how a word maps to a small data file.
//
// Words are grouped by lowercase prefix. A prefix whose group is too big is
// split by the next letter. The final set of prefixes P is published in each
// dialect's index.json; a word lives in the file named after the LONGEST
// prefix of the word that is in P.

export const SHARD_LIMIT = 120_000; // bytes of JSON per shard (target)
export const MAX_PREFIX = 8;

/** File-safe name for a prefix: its code points in hex, e.g. "kû" -> "6b-fb". */
export const hexName = (prefix) =>
  Array.from(prefix, (c) => c.codePointAt(0).toString(16)).join('-');

/**
 * `has(prefix)` says whether a prefix is one of the shard keys. The Worker
 * answers it with a plain text search of the published prefix list, so no
 * big list ever has to be parsed.
 */
export function shardKey(has, maxLen, text) {
  const chars = Array.from(text.toLowerCase());
  for (let k = Math.min(chars.length, maxLen); k >= 1; k--) {
    const p = chars.slice(0, k).join('');
    if (has(p)) return p;
  }
  return null;
}

/**
 * items: [{ chars: string[], bytes: number, ... }] where chars are the code
 * points of the lowercase key. Returns Map<prefix, items[]>.
 */
export function splitIntoShards(items, { limit = SHARD_LIMIT, maxPrefix = MAX_PREFIX } = {}) {
  const shards = new Map();
  const push = (map, k, v) => {
    const list = map.get(k);
    if (list) list.push(v);
    else map.set(k, [v]);
  };

  const place = (prefix, group, depth) => {
    const bytes = group.reduce((n, it) => n + it.bytes + 1, 2);
    if (bytes <= limit || depth >= maxPrefix) {
      shards.set(prefix, group);
      return;
    }
    const exact = [];
    const children = new Map();
    for (const it of group) {
      if (it.chars.length === depth) exact.push(it);
      else push(children, it.chars[depth], it);
    }
    if (exact.length) shards.set(prefix, exact);
    for (const [c, g] of children) place(prefix + c, g, depth + 1);
  };

  const roots = new Map();
  for (const it of items) {
    if (it.chars.length) push(roots, it.chars[0], it);
  }
  for (const [c, g] of roots) place(c, g, 1);
  return shards;
}
