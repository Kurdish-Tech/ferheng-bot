export const SITE = 'https://kurdish-tech.github.io/';
export const DATA_BASE = 'https://kurdish-tech.github.io/data';

export const DIALECTS = {
  ku: { label: 'Kurmancî · كرمانجي' },
  sor: { label: 'Soranî · سوراني' },
  zza: { label: 'Zazakî · زازاكي' },
};

// Plain-ASCII fallbacks per dialect, copied from the Ferheng site
// (src/lib/kurdishAlphabet.js) so a query typed without special letters
// still reaches the right data bucket.
const ASCII_FALLBACK = {
  ku: { c: ['ç'], e: ['ê'], i: ['î'], s: ['ş'], u: ['û'] },
  zza: { c: ['ç'], e: ['ê'], i: ['î'], s: ['ş'], u: ['ü'] },
};

export function candidateLetters(dialectKey, firstChar) {
  const lower = firstChar.toLowerCase();
  return [lower, ...(ASCII_FALLBACK[dialectKey]?.[lower] || [])];
}

export function wordUrl(dialectKey, word) {
  return `${SITE}#/w/${dialectKey}/${encodeURIComponent(word)}`;
}
