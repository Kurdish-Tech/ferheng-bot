# Ferhenga Kurdî — Telegram dictionary bot

Type a Kurdish word (Kurmancî, Soranî or Zazakî) and the bot replies in Arabic; type an Arabic word and it replies in Kurdish (`/lang` changes that). Meanings come from the [Kurdish-Tech Ferheng dictionary](https://kurdish-tech.github.io/), with a link to the word's page, plus buttons for more senses, other dialects and switching language. Commands: `/lang`, `/random`, `/about`. Also works inline in any chat (`@FerhengKurdiBot word`).

اكتب كلمة كردية أو عربية وسيرد البوت بمعناها من قاموس Kurdish-Tech مع رابط الكلمة في الموقع.

## How it works

A single Cloudflare Worker (free plan, no server). Telegram calls `POST /webhook`; the Worker looks the word up in the same static JSON files the website serves and answers in the webhook response.

- Data: the Ferheng dictionary files are re-split into small shards (at most ~120 KB, by word prefix) by `scripts/build-index.mjs` and published with this repo's GitHub Pages (`.github/workflows/pages.yml`, rebuilt weekly and on every push). The Worker reads them from `https://kurdish-tech.github.io/ferheng-bot/`. Nothing is copied into the Worker, and the website and its desktop app are untouched.
- The free plan allows ~10 ms CPU per request, so the Worker never decodes big files: it fetches one small shard and searches its raw text, only `JSON.parse`-ing the matching entries (see `src/lookup.js`, `src/shards.js`).
- `scripts/verify-index.mjs` checks every headword and Arabic key against the source data; the workflow runs it before publishing.
- Input in Arabic script returns Kurdish words whose Arabic equivalents match, plus an exact Soranî lookup. Latin script is checked against Kurmancî and Zazakî.
- No messages are stored or logged. The only stored data is each user's reply-language choice (Workers KV, keyed by Telegram user id). The bot token is kept as a Worker secret and used only to stop the button spinner (`answerCallbackQuery`).

## Develop

```bash
npm install
npm test                       # unit tests

# build the shards from a checkout of the site's public/data and serve them locally
node scripts/build-index.mjs --src ../kurdish-tech.github.io/public/data --out _site
node scripts/verify-index.mjs --src ../kurdish-tech.github.io/public/data --index _site
python -m http.server 8790 --directory _site

printf 'WEBHOOK_SECRET=testsecret
DATA_BASE=http://127.0.0.1:8790
' > .dev.vars
npx wrangler dev --port 8788   # in one terminal
node tests/live.mjs            # in another: sends sample Telegram updates
```

## Deploy

```bash
npx wrangler login
npm run deploy                 # prints https://ferheng-kurdi-bot.<subdomain>.workers.dev
npm run setup -- https://ferheng-kurdi-bot.<subdomain>.workers.dev
```

`npm run setup` asks for the bot token (hidden), stores `BOT_TOKEN` and a generated `WEBHOOK_SECRET` as Worker secrets, sets the webhook, commands and descriptions. Create the KV namespace once with `npx wrangler kv namespace create PREFS` and put its id in `wrangler.jsonc`. To use the bot inline, enable it once in @BotFather: `/setinline`.

## Licensing

Code: MIT. Dictionary content comes from Wiktionary via the Ferheng dictionary and is CC BY-SA 4.0; every reply links to the word's page on the Kurdish-Tech site.
