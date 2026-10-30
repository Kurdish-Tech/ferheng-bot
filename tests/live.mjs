// Manual integration check: sends Telegram-style updates to a running `wrangler dev`.
const BASE = process.argv[2] || 'http://127.0.0.1:8788';
const H = { 'content-type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': 'testsecret' };
const post = async (update) => {
  const t = performance.now();
  const r = await fetch(`${BASE}/webhook`, { method: 'POST', headers: H, body: JSON.stringify(update) });
  const body = r.headers.get('content-type')?.includes('json') ? await r.json() : await r.text();
  return { status: r.status, ms: Math.round(performance.now() - t), body };
};
const msg = (text) => ({ update_id: 1, message: { message_id: 1, chat: { id: 42 }, text } });

for (const q of ['av', 'ab', 'Kurdî', 'ماء', 'ئاو', 'ئاب', 'kurd', 'qwxzrt', 'bi xêr hatî', 'u', '/start', '/w av']) {
  const r = await post(msg(q));
  console.log(`\n=== "${q}"  -> ${r.status} in ${r.ms}ms`);
  console.log(typeof r.body === 'string' ? r.body : r.body.text);
}
const inl = await post({ update_id: 2, inline_query: { id: 'q1', query: 'av', from: { id: 1 }, offset: '' } });
console.log('\n=== inline "av" ->', inl.status, inl.ms + 'ms', 'results:', inl.body.results?.map((x) => `${x.id}:${x.title}`));
const inl2 = await post({ update_id: 3, inline_query: { id: 'q2', query: 'ماء', from: { id: 1 }, offset: '' } });
console.log('=== inline "ماء" ->', inl2.status, inl2.ms + 'ms', 'results:', inl2.body.results?.map((x) => `${x.id}:${x.title}`));
const bad = await fetch(`${BASE}/webhook`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
console.log('\nno secret ->', bad.status);
