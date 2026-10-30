// Manual integration check: sends Telegram-style updates to a running `wrangler dev`
// (started with WEBHOOK_SECRET=testsecret in .dev.vars) and prints what the bot would send.
const BASE = process.argv[2] || 'http://127.0.0.1:8788';
const H = { 'content-type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': 'testsecret' };
const USER = { id: 777 };
let n = 0;

const post = async (update) => {
  const t = performance.now();
  const r = await fetch(`${BASE}/webhook`, { method: 'POST', headers: H, body: JSON.stringify(update) });
  const body = r.headers.get('content-type')?.includes('json') ? await r.json() : await r.text();
  return { status: r.status, ms: Math.round(performance.now() - t), body };
};
const msg = (text) => ({ update_id: ++n, message: { message_id: n, chat: { id: 42 }, from: USER, text } });
const press = (data) => ({
  update_id: ++n,
  callback_query: { id: `cb${n}`, from: USER, data, message: { message_id: 9, chat: { id: 42 } } },
});
const buttons = (b) =>
  (b.reply_markup?.inline_keyboard || []).map((row) => row.map((x) => `[${x.text}]`).join(' ')).join('\n   ');

const show = async (label, update) => {
  const r = await post(update);
  console.log(`\n=== ${label}  -> ${r.status} ${r.ms}ms  (${r.body.method || 'no method'})`);
  if (typeof r.body === 'string') {
    console.log(r.body);
    return r.body;
  }
  console.log(r.body.text);
  const b = buttons(r.body);
  if (b) console.log('   ' + b);
  return r.body;
};

const flat = (b) => b.reply_markup.inline_keyboard.flat();
const first = await show('av (Kurdish word, default pref)', msg('av'));
const more = flat(first).find((x) => x.text.includes('المزيد'));
await show('press "more"', press(more.callback_data));
const toKu = flat(first).find((x) => x.text.includes('Kurdî'));
await show('press language toggle -> Kurdish', press(toKu.callback_data));
await show('ماء (Arabic word)', msg('ماء'));
await show('mal (two dialects)', msg('mal'));
await show('kurdi (no special letters)', msg('kurdi'));
await show('qwxzrt (not found)', msg('qwxzrt'));
await show('/random', msg('/random'));
await show('press another random', press('r|a'));
await show('/lang', msg('/lang'));
await show('choose Kurdish only', press('l|ku'));
await show('av after choosing Kurdish', msg('av'));
await show('ماء after choosing Kurdish', msg('ماء'));
await show('choose both', press('l|both'));
await show('av in both', msg('av'));
await show('choose auto again', press('l|auto'));
await show('/about', msg('/about'));
const inl = await post({ update_id: ++n, inline_query: { id: 'q1', query: 'kurdi', from: USER, offset: '' } });
console.log('\n=== inline "kurdi" ->', inl.status, inl.ms + 'ms', inl.body.results?.map((x) => `${x.id}:${x.title}`));
const bad = await fetch(`${BASE}/webhook`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
console.log('\nno secret ->', bad.status);
