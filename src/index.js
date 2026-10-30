import { handleUpdate } from './bot.js';
import { configure } from './lookup.js';
import { ERROR_TEXT } from './i18n.js';

// Stops the button's loading spinner. Needs the bot token; if the secret is
// absent the bot still works, buttons just keep the spinner a few seconds.
async function answerCallback(env, id) {
  if (!env.BOT_TOKEN || !id) return;
  try {
    await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ callback_query_id: id }),
    });
  } catch {
    // Not worth failing the update over.
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'GET') return new Response('Ferhenga Kurdî bot — OK');
    if (request.method !== 'POST' || url.pathname !== '/webhook') {
      return new Response('Not found', { status: 404 });
    }
    const given = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (!env.WEBHOOK_SECRET || given !== env.WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }

    configure(env);
    let update;
    try {
      update = await request.json();
    } catch {
      return new Response('Bad request', { status: 400 });
    }

    try {
      const { reply, answerId } = await handleUpdate(update, env);
      if (answerId) ctx.waitUntil(answerCallback(env, answerId));
      return reply ? Response.json(reply) : new Response('ok');
    } catch (err) {
      // Never log the user's text — only the error message.
      console.error('handler error:', err.message);
      const cb = update.callback_query;
      if (cb) ctx.waitUntil(answerCallback(env, cb.id));
      const chatId = update.message?.chat?.id;
      return chatId
        ? Response.json({ method: 'sendMessage', chat_id: chatId, text: ERROR_TEXT })
        : new Response('ok');
    }
  },
};
