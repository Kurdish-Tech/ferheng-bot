# Ferhenga Kurdî — Telegram dictionary bot

Type a Kurdish word (Kurmancî, Soranî or Zazakî) or an Arabic word and the bot replies with its meaning from the [Kurdish-Tech Ferheng dictionary](https://kurdish-tech.github.io/), with a link to the word's page. Also works inline in any chat (`@FerhengKurdiBot word`).

اكتب كلمة كردية أو عربية وسيرد البوت بمعناها من قاموس Kurdish-Tech مع رابط الكلمة في الموقع.

## How it works

A single Cloudflare Worker (free plan, no server). Telegram calls `POST /webhook`; the Worker looks the word up in the same static JSON files the website serves and answers in the webhook response.

- Data: `https://kurdish-tech.github.io/data/{ku,sor,zza}/*.json` plus `ar-reverse-index.json` for Arabic → Kurdish. Nothing is copied into the Worker.
- Shards are up to ~1.8 MB and the free plan allows ~10 ms CPU per request, so the Worker searches the raw text and only `JSON.parse`s the matching entries (see `src/lookup.js`).
- Input in Arabic script returns Kurdish words whose Arabic equivalents match, plus an exact Soranî lookup. Latin script is checked against Kurmancî and Zazakî.
- No messages are stored or logged. The bot token is never given to Cloudflare; only a random webhook secret is.

## Develop

```bash
npm install
npm test                       # unit tests
echo WEBHOOK_SECRET=testsecret > .dev.vars
npx wrangler dev --port 8788   # in one terminal
node tests/live.mjs            # in another: sends sample Telegram updates
```

## Deploy

```bash
npx wrangler login
npm run deploy                 # prints https://ferheng-kurdi-bot.<subdomain>.workers.dev
npm run setup -- https://ferheng-kurdi-bot.<subdomain>.workers.dev
```

`npm run setup` asks for the bot token (hidden), stores a generated `WEBHOOK_SECRET` as a Worker secret, sets the webhook, commands and descriptions. To use the bot inline, enable it once in @BotFather: `/setinline`.

## Licensing

Code: MIT. Dictionary content comes from Wiktionary via the Ferheng dictionary and is CC BY-SA 4.0; every reply links to the word's page on the Kurdish-Tech site.
