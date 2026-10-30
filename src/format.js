import { DIALECTS, wordUrl } from './config.js';
import { stripArabicDiacritics } from './lookup.js';

export const MAX_MESSAGE = 3800; // Telegram caps messages at 4096 chars

export const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const oneLine = (s) => String(s).replace(/\s+/g, ' ').trim();
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

const link = (dialectKey, word) =>
  `<a href="${wordUrl(dialectKey, word)}">🔗 Di ferhengê de bibîne · عرض في القاموس</a>`;

/** One dialect's entries for one headword, ending with a single link to the word page. */
export function formatEntryBlock(dialectKey, entries, { maxGlosses = 4, clipLen = 240 } = {}) {
  const word = entries[0].word;
  const lines = [`<b>${escapeHtml(word)}</b> · <i>${DIALECTS[dialectKey].label}</i>`];
  const arabic = new Set();
  const synonyms = new Set();
  const seenArabic = new Set();
  let wroteHeading = false;

  for (const e of entries) {
    if (e.pos_title) lines.push(`<i>${escapeHtml(e.pos_title)}</i>`);
    const glosses = (e.glosses || []).map(oneLine).filter(Boolean).slice(0, maxGlosses);
    if (glosses.length && !wroteHeading) {
      lines.push('المعنى · Wateya:');
      wroteHeading = true;
    }
    for (const g of glosses) lines.push(`• ${escapeHtml(clip(g, clipLen))}`);
    for (const a of e.arabic_equivalents || []) {
      const key = stripArabicDiacritics(a);
      if (!seenArabic.has(key)) {
        seenArabic.add(key);
        arabic.add(a);
      }
    }
    for (const s of e.synonyms || []) if (/\p{L}/u.test(s)) synonyms.add(s.trim());
  }
  if (arabic.size) {
    lines.push(`بالعربية · Bi Erebî: ${[...arabic].slice(0, 8).map(escapeHtml).join('، ')}`);
  }
  if (synonyms.size) {
    lines.push(`مرادفات · Hevwate: ${[...synonyms].slice(0, 8).map(escapeHtml).join(', ')}`);
  }
  lines.push(link(dialectKey, word));
  return lines.join('\n');
}

/** Kurdish headwords whose Arabic equivalents include the typed Arabic word. */
export function formatArabicMatches(arabicWord, matches, limit = 15) {
  const seen = new Set();
  const lines = [`<b>${escapeHtml(arabicWord)}</b> · معانيها بالكردية · Wateyên Kurdî:`];
  for (const { d, w } of matches) {
    const key = `${d}|${w}`;
    if (seen.has(key) || !DIALECTS[d]) continue;
    seen.add(key);
    if (seen.size > limit) break;
    lines.push(`• <a href="${wordUrl(d, w)}">${escapeHtml(w)}</a> — ${DIALECTS[d].label}`);
  }
  return lines.join('\n');
}

export function formatNotFound(query, suggestionsByDialect) {
  const lines = [`ما لقيت «${escapeHtml(query)}» · Peyva «${escapeHtml(query)}» nehat dîtin`];
  const suggestions = [];
  for (const [d, words] of Object.entries(suggestionsByDialect)) {
    for (const w of words) {
      suggestions.push(`<a href="${wordUrl(d, w)}">${escapeHtml(w)}</a>`);
    }
  }
  if (suggestions.length) {
    lines.push('', `ربما قصدت · Gelo te dixwest: ${suggestions.slice(0, 8).join(' · ')}`);
  } else {
    lines.push('', 'جرّب الحروف الخاصة · Tîpên taybet bi kar bîne: ê î û ş ç');
  }
  return lines.join('\n');
}

export const WELCOME = [
  '<b>Ferhenga Kurdî · القاموس الكردي</b>',
  '',
  'اكتب أي كلمة كردية (كرمانجي، سوراني أو زازاكي) أو كلمة عربية، وأعطيك معناها من قاموس Kurdish-Tech.',
  'Peyvekê (Kurmancî, Soranî an Zazakî) an peyveke Erebî binivîse, ez wateya wê nîşan didim.',
  '',
  'مثال · Mînak: <code>av</code> · <code>ئاو</code> · <code>ماء</code>',
].join('\n');

export const HINT = 'اكتب كلمة نصاً · Peyvekê bi nivîsandin bişîne';
export const ERROR_TEXT = 'صار خلل مؤقت، جرّب مرة ثانية · Çewtiyek çêbû, dîsa biceribîne';
