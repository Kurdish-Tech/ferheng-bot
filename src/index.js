import { handleUpdate } from './bot.js';
import { ERROR_TEXT } from './format.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET') return new Response('Ferhenga Kurdî bot — OK');
    if (request.method !== 'POST' || url.pathname !== '/webhook') {
      return new Response('Not found', { status: 404 });
    }
    const given = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (!env.WEBHOOK_SECRET || given !== env.WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }

    let update;
    try {
      update = await request.json();
    } catch {
      return new Response('Bad request', { status: 400 });
    }

    try {
      const reply = await handleUpdate(update);
      return reply ? Response.json(reply) : new Response('ok');
    } catch (err) {
      // Never log the user's text — only the error message.
      console.error('handler error:', err.message);
      const chatId = update.message?.chat?.id;
      return chatId
        ? Response.json({ method: 'sendMessage', chat_id: chatId, text: ERROR_TEXT })
        : new Response('ok');
    }
  },
};
