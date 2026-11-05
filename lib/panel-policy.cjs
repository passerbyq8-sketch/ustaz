(function (root, factory) {
  'use strict';
  const policy = factory();
  if (typeof module === 'object' && module.exports) module.exports = policy;
  if (root) root.EzikPanelPolicy = policy;
})(typeof window === 'object' ? window : null, function () {
  'use strict';
  const ids = Object.freeze(['asmaa','articles','memorize','adhkar','sunan-day','arbaeen','mushaf','treasure','yahimmak','dima','fatwa','lessons','library','prayer','women']);
  const plain = x => x && typeof x === 'object' && !Array.isArray(x);
  const defaults = () => ({ schema: 1, revision: 0, sections: {} });
  function validate(raw) {
    if (!plain(raw) || raw.schema !== 1 || !Number.isSafeInteger(raw.revision) || raw.revision < 0
      || !plain(raw.sections) || Object.keys(raw).some(k => !['schema','revision','sections'].includes(k))) return null;
    const sections = {};
    for (const id of Object.keys(raw.sections)) {
      const row = raw.sections[id];
      if (!ids.includes(id) || !plain(row) || Object.keys(row).some(k => !['state','reason'].includes(k))
        || !['visible','hidden','locked'].includes(row.state) || typeof row.reason !== 'string'
        || row.reason.length > 160 || /[\u0000-\u001f<>]/.test(row.reason)
        || (row.state === 'locked' && !row.reason.trim())) return null;
      sections[id] = { state: row.state, reason: row.reason.trim() };
    }
    return { schema: 1, revision: raw.revision, sections };
  }
  function availability(doc, id) {
    return doc && doc.sections && Object.hasOwn(doc.sections, id) ? doc.sections[id] : { state: 'visible', reason: '' };
  }
  return Object.freeze({ ids, defaults, validate, availability, cacheKey: 'ezik_panel_settings_v1', event: 'ezik-panel-settings' });
});
