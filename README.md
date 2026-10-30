# Ferhenga Kurdî — Telegram dictionary bot

Type a Kurdish word (Kurmancî, Soranî or Zazakî) and the bot replies in Arabic; type an Arabic word and it replies in Kurdish (`/lang` changes that). Meanings come from the [Kurdish-Tech Ferheng dictionary](https://kurdish-tech.github.io/), with a link to the word's page, plus buttons for more senses, other dialects and switching language. Commands: `/lang`, `/random`, `/about`. Also works inline in any chat (`@FerhengKurdiBot word`).

اكتب كلمة كردية أو عربية وسيرد البوت بمعناها من قاموس Kurdish-Tech مع رابط الكلمة في الموقع.

## How it works

A single Cloudflare Worker (free plan, no server). Telegram calls `POST /webhook`; the Worker looks the word up in the same static JSON files the website serves and answers in the webhook response.

- Data: the Ferheng dictionary files are re-split into small shards (at most ~120 KB, by word prefix) by `scripts/build-index.mjs`. The shards (about 5,400 files) ship **inside the Worker as static assets**, so a lookup is an in-process read with no network or TLS. Nothing else is copied, and the website and its desktop app are untouched.
- The free plan allows ~10 ms CPU per request and most requests land on a cold isolate with no warm caches. So the Worker never decodes or parses much: it reads one small shard and searches its raw text (only `JSON.parse`-ing the matching entries), and the list of shard prefixes (`prefixes.txt`) is searched as text, never parsed (see `src/lookup.js`, `src/shards.js`). Measured at a realistic request rhythm this took the share of requests over 10 ms from 14/51 to 3/51.
- `scripts/verify-index.mjs` checks every headword and Arabic key against the source data. The GitHub Pages workflow (`.github/workflows/pages.yml`) rebuilds and verifies the shards on every push and weekly, and publishes them as a public mirror at `https://kurdish-tech.github.io/ferheng-bot/` (used as a fallback via `DATA_BASE`).
- Input in Arabic script returns Kurdish words whose Arabic equivalents match, plus an exact Soranî lookup. Latin script is checked against Kurmancî and Zazakî.
- No messages are stored or logged. The only stored data is each user's reply-language choice (Workers KV, keyed by Telegram user id). The bot token is kept as a Worker secret and used only to stop the button spinner (`answerCallbackQuery`).

## Develop

```bash
npm install
npm test                       # unit tests

# build the shards from a checkout of the site's public/data and serve them locally
node scripts/build-index.mjs --src ../kurdish-tech.github.io/public/data --out _site
node scripts/verify-index.mjs --src ../kurdish-tech.github.io/public/data --index _site

echo WEBHOOK_SECRET=testsecret > .dev.vars
npx wrangler dev --port 8788   # in one terminal; serves _site as the Worker's assets
node tests/live.mjs            # in another: sends sample Telegram updates
```

## Deploy

```bash
npx wrangler login
FERHENG_DATA=../kurdish-tech.github.io/public/data npm run build:data   # builds _site (the shards)
npm run deploy                 # prints https://ferheng-kurdi-bot.<subdomain>.workers.dev
npm run setup -- https://ferheng-kurdi-bot.<subdomain>.workers.dev
```

`npm run setup` asks for the bot token (hidden), stores `BOT_TOKEN` and a generated `WEBHOOK_SECRET` as Worker secrets, sets the webhook, commands and descriptions. Refresh the dictionary by rebuilding `_site` and redeploying. Create the KV namespace once with `npx wrangler kv namespace create PREFS` and put its id in `wrangler.jsonc`. To use the bot inline, enable it once in @BotFather: `/setinline`.

## Licensing

Code: MIT. Dictionary content comes from Wiktionary via the Ferheng dictionary and is CC BY-SA 4.0; every reply links to the word's page on the Kurdish-Tech site.
