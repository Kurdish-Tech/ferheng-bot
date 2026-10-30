// The only thing stored per user: the reply-language choice, keyed by Telegram
// user id, in Workers KV. Messages are never stored.
const VALID = new Set(['auto', 'ar', 'ku', 'both']);

export async function getPref(env, userId) {
  if (!env.PREFS || !userId) return 'auto';
  try {
    const v = await env.PREFS.get(`pref:${userId}`);
    return VALID.has(v) ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export async function setPref(env, userId, mode) {
  if (!env.PREFS || !userId || !VALID.has(mode)) return false;
  try {
    await env.PREFS.put(`pref:${userId}`, mode);
    return true;
  } catch {
    return false;
  }
}

/** 'auto' picks the reply language from what the user typed. */
export function decideUi(pref, queryKind) {
  if (pref === 'ar') return 'a';
  if (pref === 'ku') return 'k';
  if (pref === 'both') return 'b';
  return queryKind === 'arabic' ? 'k' : 'a';
}
