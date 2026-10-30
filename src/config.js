export const SITE = 'https://kurdish-tech.github.io/';

// Small lookup shards generated from the dictionary data (scripts/build-index.mjs),
// published by this repo's GitHub Pages workflow. Override with the DATA_BASE
// variable (used for local testing).
export const DEFAULT_DATA_BASE = 'https://kurdish-tech.github.io/ferheng-bot';

export const DIALECTS = {
  ku: { label: 'Kurmancî · كرمانجي' },
  sor: { label: 'Soranî · سوراني' },
  zza: { label: 'Zazakî · زازاكي' },
};

export function wordUrl(dialectKey, word) {
  return `${SITE}#/w/${dialectKey}/${encodeURIComponent(word)}`;
}
