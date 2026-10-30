// One-time setup after `npm run deploy`:
//   npm run setup -- https://ferheng-kurdi-bot.<your-subdomain>.workers.dev
//
// Asks for the bot token (hidden, never written to disk), then
//   1. checks the token with Telegram's getMe,
//   2. stores the token (BOT_TOKEN, used only to stop the button spinner via
//      answerCallbackQuery) and a random WEBHOOK_SECRET as Worker secrets,
//   3. points the bot's webhook at the Worker,
//   4. sets the bot's commands and descriptions.
// Messages are answered through the webhook reply itself; the token is only used for answerCallbackQuery.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const workerUrl = (process.argv[2] || '').replace(/\/+$/, '');
if (!/^https:\/\/.+\.workers\.dev$/.test(workerUrl)) {
  console.error('Usage: npm run setup -- https://<worker>.<subdomain>.workers.dev');
  process.exit(1);
}

function askHidden(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    const stdin = process.stdin;
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const onData = (ch) => {
      for (const c of ch) {
        if (c === '\r' || c === '\n') {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          return resolve(value.trim());
        }
        if (c === '\u0003') process.exit(130);
        if (c === '\u007f' || c === '\b') value = value.slice(0, -1);
        else value += c;
      }
    };
    stdin.on('data', onData);
  });
}

async function telegram(token, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`${method}: ${json.description}`);
  return json.result;
}

function putSecret(name, value) {
  return new Promise((resolve, reject) => {
    const p = spawn('npx', ['wrangler', 'secret', 'put', name], { shell: true, stdio: ['pipe', 'inherit', 'inherit'] });
    p.stdin.end(value + '\n');
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`wrangler secret put exited ${code}`))));
  });
}

const token = await askHidden('Bot token (input hidden): ');
if (!/^\d+:[\w-]{30,}$/.test(token)) {
  console.error('That does not look like a Telegram bot token.');
  process.exit(1);
}

const me = await telegram(token, 'getMe');
console.log(`Token OK — bot is @${me.username}`);

const secret = randomBytes(24).toString('hex');
await putSecret('WEBHOOK_SECRET', secret);
await putSecret('BOT_TOKEN', token);

await telegram(token, 'setWebhook', {
  url: `${workerUrl}/webhook`,
  secret_token: secret,
  allowed_updates: ['message', 'callback_query', 'inline_query'],
  drop_pending_updates: true,
});
console.log('Webhook set.');

await telegram(token, 'setMyCommands', {
  commands: [
    { command: 'start', description: 'كيف أستخدم البوت · Çawa bikar bînim' },
    { command: 'w', description: 'ابحث عن كلمة · Peyvekê bigere' },
  ],
});
await telegram(token, 'setMyShortDescription', {
  short_description: 'قاموس كردي: كرمانجي · سوراني · زازاكي — اكتب كلمة واعرف معناها. Ferheng: Kurmancî · Soranî · Zazakî.',
});
await telegram(token, 'setMyDescription', {
  description:
    'اكتب أي كلمة كردية (كرمانجي، سوراني أو زازاكي) أو كلمة عربية، وأعطيك معناها من قاموس Kurdish-Tech، مع رابط الكلمة في الموقع.\n\n' +
    'Peyvekê (Kurmancî, Soranî an Zazakî) an peyveke Erebî binivîse, ez wateya wê nîşan didim.\n\n' +
    'لا يخزّن البوت أي رسائل · Ev bot tu peyaman tomar nake.',
});
console.log('Commands and descriptions set. Open Telegram and send the bot a word.');
