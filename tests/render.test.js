import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderWord, renderArabicList, renderNotFound, cbData, escapeHtml } from '../src/render.js';
import { decideUi } from '../src/prefs.js';
import { accentVariants, hasKurdishLetters } from '../src/lookup.js';

const av = {
  word: 'av', pos_title: 'Navdêr',
  glosses: ['a <b>&', 'second\nline', 'third'],
  arabic_equivalents: ['مَاء', 'ماء', 'آب'], synonyms: ['baran', ',', ' '],
};
const groups = [{ dialect: 'ku', entries: [av] }, { dialect: 'zza', entries: [{ word: 'av', glosses: ['x'] }] }];

const buttons = (view) => view.reply_markup.inline_keyboard.flat();

test('Arabic UI: Arabic translation first (deduplicated by diacritics), escaped glosses, one link', () => {
  const { text } = renderWord({ dialect: 'ku', groups, ui: 'a' });
  assert.match(text, /بالعربية:<\/b> مَاء، آب/);
  assert.match(text, /a &lt;b&gt;&amp;/);
  assert.match(text, /اسم/);
  assert.equal((text.match(/<a /g) || []).length, 1);
  assert.match(text, /#\/w\/ku\/av"/);
});

test('compact view shows two senses and offers "more"; full view shows all and synonyms', () => {
  const compact = renderWord({ dialect: 'ku', groups, ui: 'a' });
  assert.equal((compact.text.match(/^• /gm) || []).length, 2);
  assert.ok(buttons(compact).some((b) => /المزيد/.test(b.text)));
  const full = renderWord({ dialect: 'ku', groups, ui: 'a', full: true });
  assert.equal((full.text.match(/^• /gm) || []).length, 3);
  assert.match(full.text, /مرادفات: baran(?!,)/);
  assert.ok(buttons(full).some((b) => /أقل/.test(b.text)));
});

test('word without Arabic equivalents says so in Arabic UI, silently in Kurdish UI', () => {
  const g = [{ dialect: 'ku', entries: [{ word: 'mal', glosses: ['x'] }] }];
  assert.match(renderWord({ dialect: 'ku', groups: g, ui: 'a' }).text, /لا توجد ترجمة عربية/);
  assert.doesNotMatch(renderWord({ dialect: 'ku', groups: g, ui: 'k' }).text, /tune ye|لا توجد/);
});

test('dialect tabs appear only when several dialects have the word; language toggle flips', () => {
  const b = buttons(renderWord({ dialect: 'ku', groups, ui: 'a' }));
  assert.ok(b.some((x) => x.text.startsWith('● ')));
  assert.ok(b.some((x) => /Kurdî/.test(x.text) && x.callback_data.startsWith('v|ku|s|k|')));
  const single = buttons(renderWord({ dialect: 'ku', groups: [groups[0]], ui: 'a' }));
  assert.ok(!single.some((x) => x.text.startsWith('● ')));
});

test('corrected spelling is shown', () => {
  const { text } = renderWord({ dialect: 'ku', groups, ui: 'a', corrected: 'avv' });
  assert.match(text, /تم تصحيح الكتابة: avv ← av/);
});

test('callback data never exceeds 64 bytes (button is dropped instead)', () => {
  assert.equal(cbData('v', 'ku', 's', 'a', 'x'.repeat(80)), null);
  assert.ok(cbData('v', 'ku', 's', 'a', 'kurdî'));
});

test('Arabic list: one link and one button per Kurdish word, de-duplicated', () => {
  const v = renderArabicList('ماء', [{ d: 'ku', w: 'ab' }, { d: 'ku', w: 'ab' }, { d: 'zza', w: 'awe' }], 'k');
  assert.equal((v.text.match(/<a /g) || []).length, 2);
  assert.equal(buttons(v).length, 2);
  assert.match(v.text, /Zazakî/);
});

test('not found: suggestions become links; plain hint otherwise', () => {
  assert.match(renderNotFound('kurd', { ku: ['kurdî'] }).text, /w\/ku\/kurd%C3%AE/);
  assert.match(renderNotFound('zzz', { ku: [] }, 'a').text, /الحروف الخاصة/);
  assert.equal(escapeHtml('<&>'), '&lt;&amp;&gt;');
});

test('default reply language follows what the user typed; /lang overrides it', () => {
  assert.equal(decideUi('auto', 'kurdish'), 'a');
  assert.equal(decideUi('auto', 'arabic'), 'k');
  assert.equal(decideUi('ar', 'arabic'), 'a');
  assert.equal(decideUi('ku', 'kurdish'), 'k');
  assert.equal(decideUi('both', 'kurdish'), 'b');
});

test('accent variants: fewest changes first and bounded', () => {
  const levels = accentVariants('ku', 'kurdi');
  // 'kurdi' has two swappable letters, so one-change variants come first: kûrdi and kurdî.
  assert.deepEqual([...levels[0]].sort(), ['kurdî', 'kûrdi']);
  assert.deepEqual(levels[1], ['kûrdî']);
  assert.ok(levels.flat().length <= 15);
  assert.ok(accentVariants('ku', 'kurdis').flat().includes('kurdîş'));
  assert.deepEqual(accentVariants('zza', 'u').flat(), ['ü']);
  assert.deepEqual(accentVariants('sor', 'x'), []);
});

test('Kurdish-only Arabic-script letters are detected', () => {
  assert.equal(hasKurdishLetters('ئاو'), false);
  assert.equal(hasKurdishLetters('کوردی'), true);
  assert.equal(hasKurdishLetters('ماء'), false);
});
