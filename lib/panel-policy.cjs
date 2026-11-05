(function (root, factory) {
  'use strict';
  const policy = factory();
  if (typeof module === 'object' && module.exports) module.exports = policy;
  if (root) root.EzikPanelPolicy = policy;
})(typeof window === 'object' ? window : null, function () {
  'use strict';
  const ids = Object.freeze(['asmaa','articles','memorize','adhkar','sunan-day','arbaeen','mushaf','treasure','yahimmak','dima','fatwa','lessons','library','prayer','women']);
  const plain = x => x && typeof x === 'object' && !Array.isArray(x);
  const defaults = () => ({ schema: 1, revision: 0, sections: {}, campaign: null });
  function validate(raw) {
    if (!plain(raw) || raw.schema !== 1 || !Number.isSafeInteger(raw.revision) || raw.revision < 0
      || !plain(raw.sections) || Object.keys(raw).some(k => !['schema','revision','sections','campaign'].includes(k))) return null;
    const sections = {};
    for (const id of Object.keys(raw.sections)) {
      const row = raw.sections[id];
      if (!ids.includes(id) || !plain(row) || Object.keys(row).some(k => !['state','reason'].includes(k))
        || !['visible','hidden','locked'].includes(row.state) || typeof row.reason !== 'string'
        || row.reason.length > 160 || /[\u0000-\u001f<>]/.test(row.reason)
        || (row.state === 'locked' && !row.reason.trim())) return null;
      sections[id] = { state: row.state, reason: row.reason.trim() };
    }
    let campaign = null;
    if (raw.campaign != null) {
      const c = raw.campaign;
      if (!plain(c) || Object.keys(c).some(k => !['id','enabled','text','start','end'].includes(k))
        || typeof c.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(c.id) || typeof c.enabled !== 'boolean'
        || typeof c.text !== 'string' || !c.text.trim() || c.text.length > 2000 || /[\u0000-\u0008<>]/.test(c.text)
        || !Number.isSafeInteger(c.start) || !Number.isSafeInteger(c.end) || c.start < 0 || c.end <= c.start) return null;
      campaign = { id: c.id, enabled: c.enabled, text: c.text.trim(), start: c.start, end: c.end };
    }
    return { schema: 1, revision: raw.revision, sections, campaign };
  }
  function availability(doc, id) {
    return doc && doc.sections && Object.hasOwn(doc.sections, id) ? doc.sections[id] : { state: 'visible', reason: '' };
  }
  function campaignEligible(doc, age, now) {
    const c = doc && doc.campaign, n = Number(age);
    return !!(c && c.enabled && Number.isInteger(n) && n >= 13 && n <= 99 && Number.isFinite(now) && now >= c.start && now < c.end);
  }
  return Object.freeze({ ids, defaults, validate, availability, campaignEligible, cacheKey: 'ezik_panel_settings_v1', event: 'ezik-panel-settings' });
});
