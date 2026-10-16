// tools/harvest/robots.mjs -- PROGRAM ORDER 2026-09-24, م٦: a robots.txt reader for the harvest tools.
//
// MEASURED (program-2026-09-24/06-harvest/measure/B-harvest.md §6.3): the owner's rule is «read robots.txt
// first, keep it as evidence, never fetch a disallowed path» (the Badr directive :177-179), and the
// repository has no runtime robots reader at all -- its refusals are hand-transcribed path gates
// (lib/source-page-gates.js). This is that reader, pure and offline: text in, decisions out.
//
// THE RULES (RFC 9309, as the tools need them):
//   * the group whose user-agent line names our product token («EzikBot», case-insensitive) wins over
//     the «*» group; several groups naming the same agent are merged;
//   * the LONGEST matching rule decides; on equal length Allow wins; no match is allowed;
//   * «*» matches any run of characters and a trailing «$» anchors the end; an empty Disallow allows all;
//   * Crawl-delay (seconds) is carried so the caller can use it as a floor above its own pacing.
// A robots.txt that allows a path is NOT permission to publish anything (V12 :303); it only says the
// request may be made.

/** Parse a robots.txt body into groups: [{ agents: [...], rules: [{ allow, path }], crawlDelay }]. */
export function parseRobots(text) {
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const at = line.indexOf(':');
    if (at < 1) continue;
    const key = line.slice(0, at).trim().toLowerCase();
    const value = line.slice(at + 1).trim();
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) { current = { agents: [], rules: [], crawlDelay: null }; groups.push(current); }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === 'allow' || key === 'disallow') {
      if (key === 'disallow' && value === '') continue;
      current.rules.push({ allow: key === 'allow', path: value });
    } else if (key === 'crawl-delay') {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) current.crawlDelay = n;
    }
  }
  return { groups };
}

function groupFor(parsed, productToken) {
  const token = String(productToken || '').toLowerCase();
  const named = parsed.groups.filter((g) => g.agents.some((a) => a !== '*' && token && token.includes(a)));
  const chosen = named.length ? named : parsed.groups.filter((g) => g.agents.includes('*'));
  if (!chosen.length) return null;
  return {
    rules: chosen.flatMap((g) => g.rules),
    crawlDelay: chosen.map((g) => g.crawlDelay).filter((d) => d !== null).reduce((a, b) => Math.max(a, b), null),
  };
}

function ruleMatches(pattern, target) {
  let p = String(pattern);
  const anchored = p.endsWith('$');
  if (anchored) p = p.slice(0, -1);
  const re = new RegExp('^' + p.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + (anchored ? '$' : ''));
  return re.test(target);
}

/**
 * May `productToken` request `pathAndQuery`? → { allowed, rule, crawlDelay }. `rule` is the deciding
 * line («Disallow: /x») or '' when none matched.
 */
export function robotsDecision(parsed, productToken, pathAndQuery) {
  const group = groupFor(parsed || { groups: [] }, productToken);
  if (!group) return { allowed: true, rule: '', crawlDelay: null };
  const target = String(pathAndQuery || '/') || '/';
  let best = null;
  for (const r of group.rules) {
    if (!ruleMatches(r.path, target)) continue;
    const len = r.path.replace(/\$$/, '').length;
    if (!best || len > best.len || (len === best.len && r.allow && !best.allow)) best = { ...r, len };
  }
  return {
    allowed: best ? best.allow : true,
    rule: best ? (best.allow ? 'Allow: ' : 'Disallow: ') + best.path : '',
    crawlDelay: group.crawlDelay,
  };
}
