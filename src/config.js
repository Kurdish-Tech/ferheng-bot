// The dictionary moved off the root of this origin to make room for the
// organisation site, which forwards old `/#/w/...` links here.
export const SITE = 'https://kurdish-tech.github.io/ferheng/';

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
