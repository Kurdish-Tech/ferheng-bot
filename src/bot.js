import {
  findEntries, findEntriesWithAccents, suggestWords, findArabicMatches,
  looksArabicScript, hasKurdishLetters, toSoraniLetters, randomTranslatedWord,
} from './lookup.js';
import {
  renderWord, renderArabicList, renderNotFound, renderLang, renderRandomButton,
} from './render.js';
import { WELCOME, ABOUT, HINT } from './i18n.js';
import { getPref, setPref, decideUi } from './prefs.js';

export const normalizeQuery = (text) => text.split('\n')[0].replace(/\s+/g, ' ').trim().slice(0, 64);

const NO_PREVIEW = { is_disabled: true };
const LATIN_DIALECTS = ['ku', 'zza', 'sor'];

const toGroups = (pairs) =>
  pairs.filter(([, entries]) => entries.length).map(([dialect, entries]) => ({ dialect, entries }));

/** Every dialect's entries for an exact headword (script decides which dialects apply). */
async function groupsFor(word) {
  if (looksArabicScript(word)) {
    const variants = [...new Set([word, toSoraniLetters(word)])];
    const entries = (await Promise.all(variants.map((v) => findEntries('sor', v)))).flat();
    return toGroups([['sor', entries]]);
  }
  const lists = await Promise.all(LATIN_DIALECTS.map((d) => findEntries(d, word)));
  return toGroups(LATIN_DIALECTS.map((d, i) => [d, lists[i]]));
}

/**
 * Works out what a typed query is. `kind` is 'arabic' when the user typed an
 * Arabic word (answer with Kurdish words), otherwise 'kurdish'.
 */
export async function resolve(query) {
  if (looksArabicScript(query)) {
    const [arabic, groups] = await Promise.all([findArabicMatches(query), groupsFor(query)]);
    const kind = arabic.length && !hasKurdishLetters(query) ? 'arabic' : 'kurdish';
    return { kind, arabic, groups, corrected: null };
  }
  const groups = await groupsFor(query);
  if (groups.length) return { kind: 'kurdish', arabic: [], groups, corrected: null };

  // Nothing exact: retry with the special letters restored (kurdi -> kurdî).
  const tries = await Promise.all(
    ['ku', 'zza'].map((d) => findEntriesWithAccents(d, query, { skipDirect: true }))
  );
  const fixed = toGroups(['ku', 'zza'].map((d, i) => [d, tries[i].entries]));
  const corrected = fixed.length ? query : null;
  return { kind: 'kurdish', arabic: [], groups: fixed, corrected };
}

async function answerQuery(rawText, env, userId) {
  const query = normalizeQuery(rawText);
  if (!query) return { text: HINT };
  const [pref, found] = await Promise.all([getPref(env, userId), resolve(query)]);
  const ui = decideUi(pref, found.kind);

  if (found.kind === 'arabic' || (!found.groups.length && found.arabic.length)) {
    return renderArabicList(query, found.arabic, ui);
  }
  if (found.groups.length) {
    return renderWord({ dialect: found.groups[0].dialect, groups: found.groups, ui, corrected: found.corrected });
  }
  const dialects = looksArabicScript(query) ? ['sor'] : ['ku', 'zza'];
  const lists = await Promise.all(dialects.map((d) => suggestWords(d, query, 4)));
  return renderNotFound(query, Object.fromEntries(dialects.map((d, i) => [d, lists[i]])), pref === 'auto' ? 'b' : ui);
}

async function randomWord(env, userId, uiOverride) {
  const pref = await getPref(env, userId);
  const ui = uiOverride || decideUi(pref, 'kurdish');
  const m = await randomTranslatedWord();
  const entries = await findEntries(m.d, m.w);
  const groups = entries.length ? [{ dialect: m.d, entries }] : (await groupsFor('av'));
  const view = renderWord({ dialect: groups[0].dialect, groups, ui });
  const rows = view.reply_markup?.inline_keyboard ? [...view.reply_markup.inline_keyboard] : [];
  rows.push([renderRandomButton(ui)]);
  return { text: view.text, reply_markup: { inline_keyboard: rows } };
}

const COMMAND_RE = /^\/(\w+)(?:@\w+)?\s*([\s\S]*)$/;

function send(chat_id, view) {
  return {
    method: 'sendMessage',
    chat_id,
    text: view.text,
    parse_mode: 'HTML',
    link_preview_options: NO_PREVIEW,
    ...(view.reply_markup ? { reply_markup: view.reply_markup } : {}),
  };
}

function edit(message, view) {
  return {
    method: 'editMessageText',
    chat_id: message.chat.id,
    message_id: message.message_id,
    text: view.text,
    parse_mode: 'HTML',
    link_preview_options: NO_PREVIEW,
    ...(view.reply_markup ? { reply_markup: view.reply_markup } : {}),
  };
}

export async function handleMessage(message, env = {}) {
  const chat_id = message.chat.id;
  const userId = message.from?.id;
  if (typeof message.text !== 'string') return send(chat_id, { text: HINT });

  const cmd = COMMAND_RE.exec(message.text);
  if (!cmd) return send(chat_id, await answerQuery(message.text, env, userId));

  const [, name, rest] = cmd;
  switch (name) {
    case 'w':
    case 'ferheng':
      return send(chat_id, rest.trim() ? await answerQuery(rest, env, userId) : { text: HINT });
    case 'lang':
      return send(chat_id, renderLang(await getPref(env, userId)));
    case 'random':
      return send(chat_id, await randomWord(env, userId));
    case 'about':
      return send(chat_id, { text: ABOUT });
    default:
      return send(chat_id, { text: WELCOME });
  }
}

/** Button presses: v = open a word view, l = language choice, r = another random word. */
export async function handleCallback(cb, env = {}) {
  const message = cb.message;
  if (!message || typeof cb.data !== 'string') return { reply: null, answerId: cb.id };
  const userId = cb.from?.id;
  const [kind, ...args] = cb.data.split('|');

  if (kind === 'v') {
    const [dialect, mode, ui, ...wordParts] = args;
    const word = wordParts.join('|');
    const groups = await groupsFor(word);
    if (!groups.length) return { reply: null, answerId: cb.id };
    return { reply: edit(message, renderWord({ dialect, groups, ui, full: mode === 'f' })), answerId: cb.id };
  }
  if (kind === 'l') {
    const saved = await setPref(env, userId, args[0]);
    const view = renderLang(saved ? args[0] : await getPref(env, userId));
    if (!saved) view.text += '\n\n⚠️ تعذّر حفظ الاختيار · Hilbijartin nehat tomarkirin';
    return { reply: edit(message, view), answerId: cb.id };
  }
  if (kind === 'r') {
    return { reply: edit(message, await randomWord(env, userId, args[0])), answerId: cb.id };
  }
  return { reply: null, answerId: cb.id };
}

export async function inlineResults(rawText, env = {}, userId) {
  const query = normalizeQuery(rawText);
  if (!query) return [];
  const [pref, found] = await Promise.all([getPref(env, userId), resolve(query)]);
  const ui = decideUi(pref, found.kind);
  const results = [];

  for (const g of found.groups) {
    const view = renderWord({ dialect: g.dialect, groups: [g], ui, corrected: found.corrected });
    const first = (g.entries.find((e) => (e.glosses || []).length)?.glosses || [''])[0];
    results.push({
      type: 'article',
      id: `${g.dialect}-${results.length}`,
      title: g.entries[0].word,
      description: String(first).replace(/\s+/g, ' ').slice(0, 100),
      input_message_content: { message_text: view.text, parse_mode: 'HTML', link_preview_options: NO_PREVIEW },
    });
  }

  const seen = new Set();
  const top = found.arabic
    .filter((m) => {
      const k = `${m.d}|${m.w}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 5);
  const lists = await Promise.all(top.map((m) => findEntries(m.d, m.w)));
  top.forEach((m, i) => {
    if (!lists[i].length) return;
    const view = renderWord({ dialect: m.d, groups: [{ dialect: m.d, entries: lists[i] }], ui });
    results.push({
      type: 'article',
      id: `ar-${i}`,
      title: m.w,
      description: query,
      input_message_content: { message_text: view.text, parse_mode: 'HTML', link_preview_options: NO_PREVIEW },
    });
  });
  return results.slice(0, 10);
}

export async function handleUpdate(update, env = {}) {
  if (update.message) return { reply: await handleMessage(update.message, env) };
  if (update.callback_query) return handleCallback(update.callback_query, env);
  if (update.inline_query) {
    return {
      reply: {
        method: 'answerInlineQuery',
        inline_query_id: update.inline_query.id,
        results: await inlineResults(update.inline_query.query || '', env, update.inline_query.from?.id),
        cache_time: 60,
        is_personal: true,
      },
    };
  }
  return { reply: null };
}
