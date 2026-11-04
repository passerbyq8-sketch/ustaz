'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./security-auth-harness.cjs');
async function fixture() {
  const h = await harness();
  h.redis.zadd = async () => 1;
  const account = await h.load('lib/auth/account.js'), articles = await h.load('lib/articles/store.js');
  const email = 'article-fixture@example.invalid';
  const a = await account.upsertAccount({ provider: 'google', sub: 'article-fixture', email, emailVerified: true });
  h.env.EZIK_EDITOR_ACCOUNTS = account.emailDigest(email);
  const session = (await account.mintSession(a.key)).session;
  const create = await articles.createArticle({ section: 'articles', title: 'Initial', body: 'Initial body' }, a.key);
  assert.equal(create.ok, true);
  return { h, articles, key: a.key, id: create.record.id, session };
}

test('raw title/body bounds reject create and update before normalization or storage', async () => {
  const f = await fixture();
  for (const [field, value] of [['title', '<b></b>'.repeat(1000) + 'Title'], ['body', '<b></b>'.repeat(60000)]]) {
    const before = structuredClone(f.h.data), writes = f.h.operations.length;
    const created = await f.articles.createArticle({ section: 'articles', title: 'Title', body: 'Body', [field]: value }, f.key);
    assert.equal(created.ok, false, 'create ' + field);
    assert.equal(created.code, 'articles-' + field);
    const updated = await f.articles.updateArticle(f.id, { [field]: value }, f.key);
    assert.equal(updated.ok, false, 'update ' + field);
    assert.equal(updated.code, 'articles-' + field);
    assert.equal(f.h.operations.length, writes);
    assert.deepEqual(f.h.data, before);
    for (const action of ['create', 'update']) {
      const result = await f.h.post('api/articles-admin.js', { session: f.session, action, section: 'articles',
        id: f.id, title: 'Title', body: 'Body', [field]: value, patch: { [field]: value } });
      assert.equal(result.statusCode, 400, action + ' raw ' + field);
      assert.equal(result.body.error, 'articles-' + field);
    }
  }
});

test('request byte ceiling rejects before authentication/store work, including irrelevant fields', async () => {
  const f = await fixture(), before = f.h.operations.length;
  const result = await f.h.post('api/articles-admin.js', { action: 'create', session: f.session,
    padding: 'x'.repeat(2000000), section: 'articles', title: 'Title', body: 'Body' });
  assert.equal(result.statusCode, 413);
  assert.equal(f.h.operations.length, before);
});

test('multilingual notation, safe links, stripping and existing stored limits survive create/update', async () => {
  const f = await fixture();
  const body = '## \u0645\u0631\u062d\u0628\u0627\n\n### \u4f60\u597d\n- caf\u00e9\n1. \u0928\u092e\u0938\u094d\u0924\u0947\n**bold** *em*\n[\u0643\u062a\u0627\u0628](https://example.invalid/a)\n{{blue:color}}';
  const created = await f.articles.createArticle({ section: 'articles', title: '<b>\u0643\u062a\u0627\u0628</b>', body }, f.key);
  assert.equal(created.ok, true);
  assert.equal(created.record.body, body);
  const updated = await f.articles.updateArticle(f.id, { title: '\u4f60\u597d', body }, f.key);
  assert.equal(updated.ok, true); assert.equal(updated.record.body, body);
  assert.equal(f.articles.sanitizeBody('<script>bad</script><style>bad</style><p>ok</p>'), 'ok');
  assert.equal(f.articles.sanitizeBody('[bad](javascript:bad) ![alt](https://example.invalid/a)'), 'bad alt');
  assert.equal(f.articles.sanitizeBody('[bad](javascript:alert(1))'), 'bad)');
  assert.equal(f.articles.sanitizeBody('[v6](https://[2001:4860:4860::8888]/)'), '[v6](https://[2001:4860:4860::8888]/)');
  assert.equal((await f.articles.createArticle({ section: 'articles', title: 'x'.repeat(201), body: '' }, f.key)).code, 'articles-title');
  assert.equal((await f.articles.updateArticle(f.id, { body: 'x'.repeat(200001) }, f.key)).code, 'articles-body');
});

test('bounded pathological angle brackets, links and whitespace complete promptly', async () => {
  const f = await fixture();
  const start = performance.now();
  for (const text of ['<'.repeat(80000), '['.repeat(80000), '[]('.repeat(26000), ' '.repeat(300000) + 'x', '<h1'.repeat(26000)]) {
    const result = f.articles.sanitizeBody(text);
    assert.equal(typeof result, 'string'); assert.doesNotMatch(result, /[<>]/);
  }
  assert.ok(performance.now() - start < 1500, 'five bounded pathological inputs must finish within 1.5 seconds');
});
