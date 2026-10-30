// Reply language. `ui` is one of: 'a' (Arabic), 'k' (Kurmancî), 'b' (both).
//
// Default ("auto") behaviour: a Kurdish word gets an Arabic reply, an Arabic
// word gets a Kurmancî reply. /lang can pin it to one language or both.

const S = {
  meaning: { a: 'المعنى', k: 'Wate' },
  arabic: { a: 'بالعربية', k: 'Bi Erebî' },
  noArabic: {
    a: 'لا توجد ترجمة عربية لهذه الكلمة في القاموس، وهذا تعريفها بالكردية:',
    k: 'Ji bo vê peyvê wergera Erebî di ferhengê de tune ye.',
  },
  synonyms: { a: 'مرادفات', k: 'Hevwate' },
  more: { a: 'المزيد', k: 'Zêdetir' },
  less: { a: 'أقل', k: 'Kêmtir' },
  open: { a: 'عرض في القاموس', k: 'Di ferhengê de bibîne' },
  corrected: { a: 'تم تصحيح الكتابة', k: 'Rastkirin' },
  kurdishMeaningsOf: { a: 'معانيها بالكردية', k: 'Wateyên Kurdî' },
  didYouMean: { a: 'ربما قصدت', k: 'Gelo te dixwest' },
  tryLetters: { a: 'جرّب الحروف الخاصة', k: 'Tîpên taybet bi kar bîne' },
  another: { a: 'كلمة أخرى', k: 'Peyveke din' },
};

export function tr(key, ui) {
  const e = S[key];
  if (ui === 'b') return e.a === e.k ? e.a : `${e.a} · ${e.k}`;
  return e[ui];
}

const DIALECT_NAME = {
  ku: { a: 'كرمانجي', k: 'Kurmancî' },
  sor: { a: 'سوراني', k: 'Soranî' },
  zza: { a: 'زازاكي', k: 'Zazakî' },
};

export function dialectName(d, ui) {
  const n = DIALECT_NAME[d];
  return ui === 'b' ? `${n.k} · ${n.a}` : n[ui];
}

// Part-of-speech titles are Kurmancî in the data; shown in Arabic only for the
// ones whose meaning is certain, otherwise left as in the dictionary.
const POS_AR = {
  Navdêr: 'اسم',
  Lêker: 'فعل',
  Rengdêr: 'صفة',
  Hoker: 'ظرف',
  Cînav: 'ضمير',
  Daçek: 'حرف جر',
  Girêdek: 'أداة ربط',
  Baneşan: 'تعجب',
  Biwêj: 'تعبير',
  Hejmar: 'عدد',
  Tîp: 'حرف',
  'Formeke navdêrê': 'صيغة اسم',
  'Formeke lêkerê': 'صيغة فعل',
  'Formeke rengdêrê': 'صيغة صفة',
};

export function posLabel(title, ui) {
  if (!title) return '';
  const ar = POS_AR[title];
  if (ui === 'k' || !ar) return title;
  return ui === 'a' ? ar : `${title} · ${ar}`;
}

export const LANG_MODES = {
  auto: { a: 'تلقائي: كلمة كردية ← رد بالعربية، كلمة عربية ← رد بالكردية', k: 'Xweber: Kurdî → Erebî, Erebî → Kurdî' },
  ar: { a: 'دائماً بالعربية', k: 'Her dem bi Erebî' },
  ku: { a: 'دائماً بالكردية (كرمانجي)', k: 'Her dem bi Kurmancî' },
  both: { a: 'العربية والكردية معاً', k: 'Erebî û Kurmancî bi hev re' },
};

export const WELCOME = [
  '<b>Ferhenga Kurdî · القاموس الكردي</b>',
  '',
  'اكتب أي كلمة كردية (كرمانجي، سوراني أو زازاكي) فأرد عليك بالعربية، أو اكتب كلمة عربية فأعطيك مقابلها بالكردية.',
  'Peyvekê (Kurmancî, Soranî an Zazakî) binivîse, ez bi Erebî bersiv didim; peyveke Erebî binivîse, ez bi Kurdî bersiv didim.',
  '',
  'مثال · Mînak: <code>av</code> · <code>ئاو</code> · <code>ماء</code>',
  '',
  '/lang — لغة الرد · zimanê bersivê',
  '/random — كلمة عشوائية · peyveke bi şans',
  '/about — عن البوت · derbarê botê de',
].join('\n');

export const ABOUT = [
  '<b>Ferhenga Kurdî</b>',
  'قاموس كردي (كرمانجي · سوراني · زازاكي) من مشروع Kurdish-Tech المفتوح المصدر.',
  'Ferhengek Kurdî ya vekirî ji projeya Kurdish-Tech.',
  '',
  'الخصوصية · Nepenî: لا يخزّن البوت أي رسالة؛ يحفظ فقط اختيار اللغة إن حدّدته بـ /lang.',
  'Ev bot tu peyaman tomar nake; tenê tercîha zimanê te heke bi /lang hilbijêrî.',
  '',
  'https://kurdish-tech.github.io/',
].join('\n');

export const HINT = 'اكتب كلمة نصاً · Peyvekê bi nivîsandin bişîne';
export const ERROR_TEXT = 'صار خلل مؤقت، جرّب مرة ثانية · Çewtiyek çêbû, dîsa biceribîne';
