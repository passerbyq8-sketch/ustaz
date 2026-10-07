// lib/lang/enabled.js -- WHICH LANGUAGES ARE OPEN TO READERS (item 74, amendment 5 E1).
//
// ONE FILE decides it, config/enabled-languages.json, and opening a language later is adding its code to that file and nothing else.
// The server reads it here; the client gets the same list baked into app.js by tools/build-app.cjs (the way EZIK_APP_VERSION is), and a
// guard compares the two. The file is read ON PRODUCTION ONLY: a preview deployment (and a local run) has every built language, so the
// owner can test the rest. A language that is not enabled does not exist for the language layer on production: the gate (gate.js) leaves
// its question on today's road, the one origin/main has, and the interface never offers it.
import enabledFile from '../../config/enabled-languages.json' with { type: 'json' };

/** The codes of the file, validated: strings only, and Arabic and English are always there (they ship inside the bundle). */
export function enabledCodes() {
  const raw = enabledFile && Array.isArray(enabledFile.enabled) ? enabledFile.enabled : [];
  const out = ['ar', 'en'];
  for (const c of raw) if (typeof c === 'string' && /^[a-z]{2,3}$/.test(c) && !out.includes(c)) out.push(c);
  return out;
}

/** True on the production deployment, as the platform reports it: only VERCEL_ENV === 'production' restricts. */
export function isProductionEnv(env = process.env) { return !!env && env.VERCEL_ENV === 'production'; }

/** May a reader of this deployment be answered in `code`? Arabic always; every built language off production; the file's list on production. */
export function languageEnabled(code, env = process.env) {
  if (code === 'ar') return true;
  if (!isProductionEnv(env)) return true;
  return enabledCodes().includes(code);
}
