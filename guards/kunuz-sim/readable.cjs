// kunuz-sim/readable.cjs -- everything a reader can take from one element of the mini DOM: its own text and every attribute a
// screen reader speaks. The no-question-number scans of the Kunuz guards (kunuztest T10, kunuzboard B7, kunuznorepeat D) read
// these, not the visible text alone (KUNUZ-QA-DECISIONS-ORDER-2026-10-19, item 4: Hanna Laha read "n of total left" to a
// screen reader only). Text the page hides visually or puts in a live region is own text and is read with the rest.
'use strict';
const READABLE_ATTRS = ['aria-label', 'aria-description', 'aria-valuetext', 'aria-roledescription', 'aria-placeholder', 'title', 'alt', 'placeholder'];
// a page may also write these as properties (b.title = ...), which the mini DOM keeps on the element and not in attrs
const READABLE_PROPS = ['title', 'alt', 'placeholder', 'ariaLabel', 'ariaDescription', 'ariaValueText'];
function readable(el, own) {
  const out = [own];
  for (const a of READABLE_ATTRS) out.push(el.attrs[a]);
  for (const p of READABLE_PROPS) if (Object.prototype.hasOwnProperty.call(el, p) && typeof el[p] === 'string') out.push(el[p]);
  return out.filter((s) => s && String(s).trim());
}
module.exports = { READABLE_ATTRS, READABLE_PROPS, readable };
