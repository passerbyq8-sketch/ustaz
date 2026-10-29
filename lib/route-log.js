const SORTER_TAG_STATES = new Set(['worldly', 'religious', 'timeout', 'error']);

/** Route facts captured without changing the route decision itself. */
export function routeLogFields({ lexicalRuntime, runtime, sorter } = {}) {
  const tags = [];
  if (SORTER_TAG_STATES.has(sorter)) tags.push('sorter:' + sorter);
  if (typeof lexicalRuntime === 'string' && lexicalRuntime && runtime !== lexicalRuntime) {
    tags.push('lex:' + lexicalRuntime);
  }
  if (sorter === 'worldly' && (lexicalRuntime === 'STORED_FIQH' || lexicalRuntime === 'HADITH')
    && runtime === 'GENERAL') tags.push('sorter_worldly');
  if (sorter === 'removed_identity') tags.push('removed_identity');
  return Object.freeze(tags);
}