// tools/reviewer-capture-hook.mjs — a Node ESM load hook that records the reviewer's INPUT.
//
// WHY A LOADER HOOK AND NOT AN EDIT. lib/free-brain/review.js is the seam both branches agreed on
// and its own header forbids it growing anything of its own. Measuring what arrives there must not
// require adding a probe to it and remembering to take the probe out — a capture that leaves the
// tree dirty is a capture that can lie about the tree it measured. This hook rewrites the module's
// SOURCE AT LOAD TIME, in memory, for this process only. Nothing on disk changes.
//
// It is inert unless EZIK_REVIEW_CAPTURE names a file.
import { readFileSync } from 'node:fs';

const MARK = 'export async function reviewAnswer(input = {}) {';

export async function load(url, context, nextLoad) {
  if (!url.endsWith('/lib/free-brain/review.js')) return nextLoad(url, context);
  const source = readFileSync(new URL(url), 'utf8');
  if (!source.includes(MARK)) {
    throw new Error('reviewer-capture-hook: anchor not found in review.js — the hook would have '
      + 'silently captured nothing, which is worse than failing here.');
  }
  const patched = "import { writeFileSync as __ezikWrite } from 'node:fs';\n"
    + 'function __ezikCapture(input) {\n'
    + '  const target = process.env.EZIK_REVIEW_CAPTURE;\n'
    + '  if (!target) return;\n'
    + '  __ezikWrite(target, JSON.stringify({\n'
    + '    text: String(input?.text ?? ""),\n'
    + '    evidence: Array.isArray(input?.evidence) ? input.evidence : [],\n'
    + '    domain: input?.domain, mode: input?.mode,\n'
    + '  }, null, 2), "utf8");\n'
    + '}\n'
    + source.replace(MARK, MARK + '\n  __ezikCapture(input);');
  return { format: 'module', shortCircuit: true, source: patched };
}
