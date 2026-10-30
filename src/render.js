import { wordUrl } from './config.js';
import { tr, dialectName, posLabel, LANG_MODES } from './i18n.js';
import { stripArabicDiacritics } from './lookup.js';

export const MAX_MESSAGE = 3800; // Telegram caps messages at 4096 chars

export const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Some dictionary glosses carry wiki maintenance notes like
// ^([Ev rêz ji aliyê botê ve lê hatiye zêdekirin ...].) — not part of the meaning.
const WIKI_NOTE_RE = /\^\(\[[^\]]*\]\.?\)/g;
export const cleanGloss = (s) => String(s).replace(WIKI_NOTE_RE, '').replace(/\s+/g, ' ').trim();
const oneLine = cleanGloss;
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

/** Telegram allows 64 bytes of callback data; return null if it does not fit. */
export function cbData(...parts) {
  const s = parts.join('|');
  return new TextEncoder().encode(s).length <= 64 ? s : null;
}

const keyboard = (rows) => {
  const clean = rows
    .map((r) => r.filter((b) => b && (b.url || b.callback_data)))
    .filter((r) => r.length);
  return clean.length ? { inline_keyboard: clean } : undefined;
};

function summarize(entries) {
  const arabic = [];
  const seen = new Set();
  const synonyms = new Set();
  for (const e of entries) {
    for (const a of e.arabic_equivalents || []) {
      const key = stripArabicDiacritics(a);
      if (!seen.has(key)) {
        seen.add(key);
        arabic.push(a);
      }
    }
    for (const s of e.synonyms || []) if (/\p{L}/u.test(s)) synonyms.add(s.trim());
  }
  const rows = entries.map((e) => ({
    pos: e.pos_title,
    glosses: (e.glosses || []).map(oneLine).filter(Boolean),
  }));
  return { arabic, synonyms: [...synonyms], rows };
}

/**
 * One word, one dialect. `groups` lists every dialect that has the word so the
 * message can offer tabs. Compact by default; `full` shows every sense.
 */
export function renderWord({ dialect, groups, ui, full = false, corrected = null }) {
  const group = groups.find((g) => g.dialect === dialect) || groups[0];
  const word = group.entries[0].word;
  const { arabic, synonyms, rows } = summarize(group.entries);

  const posTitles = [...new Set(rows.map((r) => r.pos).filter(Boolean))];
  const head =
    `<b>${escapeHtml(word)}</b> · ${dialectName(group.dialect, ui)}` +
    (posTitles.length ? ` · <i>${posTitles.map((p) => escapeHtml(posLabel(p, ui))).join('، ')}</i>` : '');
  const lines = [head];

  if (corrected) lines.push(`<i>${tr('corrected', ui)}: ${escapeHtml(corrected)} ← ${escapeHtml(word)}</i>`);

  if (arabic.length) {
    lines.push(`<b>${tr('arabic', ui)}:</b> ${arabic.slice(0, 8).map(escapeHtml).join('، ')}`);
  } else if (ui !== 'k') {
    lines.push(`<i>${tr('noArabic', ui)}</i>`);
  }

  const allGlosses = rows.flatMap((r) => r.glosses);
  if (full) {
    for (const r of rows) {
      if (rows.length > 1 && r.pos) lines.push(`<i>${escapeHtml(posLabel(r.pos, ui))}</i>`);
      for (const g of r.glosses.slice(0, 4)) lines.push(`• ${escapeHtml(clip(g, 240))}`);
    }
    if (synonyms.length) {
      lines.push(`${tr('synonyms', ui)}: ${synonyms.slice(0, 8).map(escapeHtml).join(', ')}`);
    }
  } else {
    for (const g of allGlosses.slice(0, 2)) lines.push(`• ${escapeHtml(clip(g, 200))}`);
  }
  lines.push(`<a href="${wordUrl(group.dialect, word)}">🔗 ${tr('open', ui)}</a>`);

  const hasMore = allGlosses.length > 2 || synonyms.length > 0 || rows.length > 1;
  const flip = ui === 'k' ? 'a' : 'k';
  const tabUi = ui === 'k' ? 'k' : 'a';
  const d = group.dialect;
  const reply_markup = keyboard([
    [
      hasMore || full
        ? {
            text: full ? `▲ ${tr('less', ui)}` : `▼ ${tr('more', ui)}`,
            callback_data: cbData('v', d, full ? 's' : 'f', ui, word),
          }
        : null,
      { text: flip === 'a' ? '🌐 العربية' : '🌐 Kurdî', callback_data: cbData('v', d, full ? 'f' : 's', flip, word) },
    ],
    groups.length > 1
      ? groups.map((g) => ({
          text: `${g.dialect === d ? '● ' : ''}${dialectName(g.dialect, tabUi)}`,
          callback_data: cbData('v', g.dialect, full ? 'f' : 's', ui, word),
        }))
      : [],
  ]);

  let text = lines.join('\n');
  if (text.length > MAX_MESSAGE) text = text.slice(0, MAX_MESSAGE);
  return { text, reply_markup };
}

/** Kurdish words matching an Arabic query, each a button that opens its entry. */
export function renderArabicList(query, matches, ui, limit = 8) {
  const seen = new Set();
  const items = [];
  for (const m of matches) {
    const k = `${m.d}|${m.w}`;
    if (seen.has(k)) continue;
    seen.add(k);
    items.push(m);
    if (items.length >= limit) break;
  }
  const lines = [`<b>${escapeHtml(query)}</b> · ${tr('kurdishMeaningsOf', ui)}:`];
  for (const m of items) {
    lines.push(`• <a href="${wordUrl(m.d, m.w)}">${escapeHtml(m.w)}</a> — ${dialectName(m.d, ui)}`);
  }
  const TAG = { ku: 'KU', sor: 'SOR', zza: 'ZZA' };
  const buttons = items.map((m) => ({
    text: `${m.w} · ${TAG[m.d]}`,
    callback_data: cbData('v', m.d, 's', ui, m.w),
  }));
  const rows = [];
  for (let i = 0; i < buttons.length; i += 3) rows.push(buttons.slice(i, i + 3));
  return { text: lines.join('\n'), reply_markup: keyboard(rows) };
}

export function renderNotFound(query, suggestionsByDialect, ui = 'b') {
  const lines = [
    ui === 'k'
      ? `Peyva «${escapeHtml(query)}» nehat dîtin`
      : ui === 'a'
        ? `لم أجد «${escapeHtml(query)}» في القاموس`
        : `لم أجد «${escapeHtml(query)}» · Peyva «${escapeHtml(query)}» nehat dîtin`,
  ];
  const links = [];
  for (const [d, words] of Object.entries(suggestionsByDialect)) {
    for (const w of words) links.push(`<a href="${wordUrl(d, w)}">${escapeHtml(w)}</a>`);
  }
  lines.push('');
  lines.push(
    links.length
      ? `${tr('didYouMean', ui)}: ${links.slice(0, 8).join(' · ')}`
      : `${tr('tryLetters', ui)}: ê î û ş ç`
  );
  return { text: lines.join('\n') };
}

export function renderLang(current) {
  const labels = { auto: 'تلقائي · Xweber', ar: 'العربية · Erebî', ku: 'Kurdî · كردي', both: 'الاثنان · Herdu' };
  const text = [
    '<b>لغة الرد · Zimanê bersivê</b>',
    '',
    `<b>${labels[current]}</b>`,
    LANG_MODES[current].a,
    LANG_MODES[current].k,
  ].join('\n');
  const rows = [
    ['auto', 'ar'],
    ['ku', 'both'],
  ].map((r) =>
    r.map((m) => ({ text: `${m === current ? '✓ ' : ''}${labels[m]}`, callback_data: `l|${m}` }))
  );
  return { text, reply_markup: keyboard(rows) };
}

export function renderRandomButton(ui) {
  return { text: `🎲 ${tr('another', ui)}`, callback_data: `r|${ui}` };
}
