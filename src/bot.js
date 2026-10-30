import {
  findEntries, suggestWords, findArabicMatches,
  looksArabicScript, toSoraniLetters,
} from './lookup.js';
import {
  formatEntryBlock, formatArabicMatches, formatNotFound,
  MAX_MESSAGE, WELCOME, HINT,
} from './format.js';

export const normalizeQuery = (text) => text.split('\n')[0].replace(/\s+/g, ' ').trim().slice(0, 64);

async function findSorani(query) {
  const variants = [...new Set([query, toSoraniLetters(query)])];
  const lists = await Promise.all(variants.map((v) => findEntries('sor', v)));
  return lists.flat();
}

/** Finds everything for a query: Arabic->Kurdish matches plus per-dialect entries. */
export async function search(query) {
  if (looksArabicScript(query)) {
    const [matches, sorani] = await Promise.all([findArabicMatches(query), findSorani(query)]);
    return {
      arabic: matches,
      groups: sorani.length ? [{ dialect: 'sor', entries: sorani }] : [],
    };
  }
  const [ku, zza] = await Promise.all([findEntries('ku', query), findEntries('zza', query)]);
  return {
    arabic: [],
    groups: [
      ...(ku.length ? [{ dialect: 'ku', entries: ku }] : []),
      ...(zza.length ? [{ dialect: 'zza', entries: zza }] : []),
    ],
  };
}

function joinWithinLimit(blocks) {
  const out = [];
  let size = 0;
  for (const b of blocks) {
    if (size + b.length + 2 > MAX_MESSAGE && out.length) break;
    out.push(b);
    size += b.length + 2;
  }
  return out.join('\n\n');
}

export async function answerQuery(rawText) {
  const query = normalizeQuery(rawText);
  if (!query) return HINT;
  const { arabic, groups } = await search(query);

  const build = (opts) => {
    const blocks = [];
    if (arabic.length) blocks.push(formatArabicMatches(query, arabic));
    for (const g of groups) blocks.push(formatEntryBlock(g.dialect, g.entries, opts));
    return blocks;
  };
  let blocks = build();
  if (blocks.join('\n\n').length > MAX_MESSAGE) blocks = build({ maxGlosses: 2, clipLen: 140 });
  if (blocks.length) return joinWithinLimit(blocks);

  const dialects = looksArabicScript(query) ? ['sor'] : ['ku', 'zza'];
  const lookups = await Promise.all(dialects.map((d) => suggestWords(d, query, 4)));
  return formatNotFound(query, Object.fromEntries(dialects.map((d, i) => [d, lookups[i]])));
}

const NO_PREVIEW = { is_disabled: true };

export async function inlineResults(rawText) {
  const query = normalizeQuery(rawText);
  if (!query) return [];
  const { arabic, groups } = await search(query);
  const results = [];

  for (const g of groups) {
    const first = (g.entries.find((e) => (e.glosses || []).length)?.glosses || [''])[0];
    results.push({
      type: 'article',
      id: `${g.dialect}-${results.length}`,
      title: g.entries[0].word,
      description: String(first).replace(/\s+/g, ' ').slice(0, 100),
      input_message_content: {
        message_text: formatEntryBlock(g.dialect, g.entries, { maxGlosses: 3, clipLen: 200 }),
        parse_mode: 'HTML',
        link_preview_options: NO_PREVIEW,
      },
    });
  }

  const seen = new Set();
  const top = arabic
    .filter((m) => {
      const k = `${m.d}|${m.w}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 5);
  const entryLists = await Promise.all(top.map((m) => findEntries(m.d, m.w)));
  top.forEach((m, i) => {
    if (!entryLists[i].length) return;
    results.push({
      type: 'article',
      id: `ar-${i}`,
      title: m.w,
      description: query,
      input_message_content: {
        message_text: formatEntryBlock(m.d, entryLists[i], { maxGlosses: 3, clipLen: 200 }),
        parse_mode: 'HTML',
        link_preview_options: NO_PREVIEW,
      },
    });
  });
  return results.slice(0, 10);
}

const COMMAND_RE = /^\/(\w+)(?:@\w+)?\s*([\s\S]*)$/;

export async function handleMessage(message) {
  const chat_id = message.chat.id;
  const reply = (text) => ({
    method: 'sendMessage',
    chat_id,
    text,
    parse_mode: 'HTML',
    link_preview_options: NO_PREVIEW,
  });
  if (typeof message.text !== 'string') return reply(HINT);

  const cmd = COMMAND_RE.exec(message.text);
  if (cmd) {
    const [, name, rest] = cmd;
    if ((name === 'w' || name === 'ferheng') && rest.trim()) return reply(await answerQuery(rest));
    return reply(WELCOME);
  }
  return reply(await answerQuery(message.text));
}

export async function handleUpdate(update) {
  if (update.message) return handleMessage(update.message);
  if (update.inline_query) {
    return {
      method: 'answerInlineQuery',
      inline_query_id: update.inline_query.id,
      results: await inlineResults(update.inline_query.query || ''),
      cache_time: 3600,
    };
  }
  return null;
}
