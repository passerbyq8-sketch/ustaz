// lib/anchor/flag.js — THE SWITCH FOR ANCHOR MODE. Default OFF, and every failure is also OFF.
//
// ── WHY IT IS A FLAG AT ALL (قرار ١ب / P4-D) ─────────────────────────────────
// Anchor mode changes HOW A SOURCED ANSWER IS BUILT: instead of the model writing prose that
// mentions its sources, the model emits discrete units and the SERVER composes them. That is a
// change to the shape of every religious answer on the DEEN route, and the owner's rollout for
// such a change is preview → internal → approval → public. Shipping it live on merge would skip
// all of it.
//
// So the existing composition stays live and this returns false until somebody decides
// otherwise, deliberately and separately. THIS MODULE CHANGES NO VALUE. It reads.
//
// ── THE SAME SHAPE AS THE FLAGS ALREADY HERE ─────────────────────────────────
// lib/ledger/flag.js `envMode()` is the pattern: a named env var, an explicit allow-list of
// values, and ANYTHING ELSE — a typo, an empty string, a value somebody meant as "yes" but wrote
// as "true" — resolves to off. A flag whose unknown value means "on" is a flag that turns itself
// on by accident.
//
// It is DELIBERATELY simpler than lib/legacy-policy-flag.js: no founder credential and no store
// read. Those exist so an internal tester can be let through ahead of the public, and قرار ١ب
// asks for no such rollout — it asks for an off switch and a later decision. Adding a credential
// path here would be inventing a rollout nobody specified, and a second way to turn this on.

/** The raw mode: 'on' only when it says so, 'off' for everything else. */
export function anchorEnvMode() {
  const raw = String(process.env.ANCHOR_MODE ?? '').trim().toLowerCase();
  return raw === 'on' ? 'on' : 'off';
}

/**
 * May anchor mode compose this reply?
 *
 * @returns {boolean} false unless ANCHOR_MODE is exactly 'on'.
 */
export function anchorModeEnabled() {
  return anchorEnvMode() === 'on';
}
