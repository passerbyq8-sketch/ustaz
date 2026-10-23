/* Addendum 2: real-browser before/after proof. No visible UI is mocked. */
'use strict';
const cli=(key,fallback)=>process.argv.find(a=>a.startsWith('--'+key+'='))?.slice(key.length+3)||fallback;
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.KUNUZ_PLAYWRIGHT_MODULE || '../.vercel/theme-tools/node_modules/playwright');
const base = cli('base', process.env.KUNUZ_PREVIEW_URL || 'http://127.0.0.1:52190');
const out = cli('out', process.env.KUNUZ_LAYOUT_SHOTS || 'C:/Users/passe/projects/quest-review/sessions/kunuz-theme-shots-2026-10-20/flash/addendum-2');
const phase = process.argv.includes('--before') ? 'before' : 'after';
const onlyWidth = Number(process.argv.find(a => a.startsWith('--width='))?.split('=')[1]);
const onlyGame = process.argv.find(a => a.startsWith('--game='))?.split('=')[1];
const nativeSheets = process.argv.includes('--native-sheets');
const sourceURL = process.argv.includes('--source-url');
const routes = { board: 'quest-board.html', test: 'quest-test.html', hanna: 'hanna-laha/', ghaws: 'quest-ghaws.html', harb: 'quest-harb.html' };
const record = { phase, startedAt: new Date().toISOString(), localOrigin: new URL(base).hostname === '127.0.0.1', viewports: [], fixtures: [], screenshots: [], checks: [], errors: [], failedRequests: [], badResponses: [] };
fs.mkdirSync(out, { recursive: true });
const evidenceFile = path.join(out, phase + '-layout' + (onlyWidth ? '-' + onlyWidth : '') + (onlyGame ? '-' + onlyGame : '') + (nativeSheets ? '-native-sheets' : '') + (sourceURL ? '-source-url' : '') + '.json');
let page, width, game;
function save() { fs.writeFileSync(evidenceFile, JSON.stringify(record, null, 2)); }
async function click(selector) {
  const target = typeof selector === 'string' ? page.locator(selector).first() : selector;
  await target.scrollIntoViewIfNeeded();
  await page.waitForTimeout(245);
  await target.click();
}
async function state() {
  return page.evaluate(() => {
    const m = KunuzJourney.state, q = m.question, g = m.g;
    return { stage: m.stage, selectedCategories: m.cats, running: m.running, question: q ? { index: q.index, actor: q.actor, settled: q.settled, answerRevealed: q.answerRevealed, beat: q.beat, activeTeam: q.activeTeam, submissions: q.submissions } : null, teams: m.teams.map(t => ({ name: t.n, score: t.score, pearls: t.p, color: t.c })), war: m.game === 'harb' ? { phase: g.phase, turn: g.turn, pool: g.pool, own: g.own, ban: g.ban, base: g.base, moveTgt: g.moveTgt, moveLeft: g.moveLeft, message: m.warMessage } : null, dive: m.game === 'ghaws' ? { depth: S.depth, cap: S.cap, pearls: S.pearls } : null, result: m.result, played: m.slots.filter(s => s.used).length, slots: m.slots.length };
  });
}
async function metrics() {
  return page.evaluate(() => {
    function box(el) { if (!el) return null; const r = el.getBoundingClientRect(), s = getComputedStyle(el); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom, background: s.backgroundColor, color: s.color, fill: s.fill, stroke: s.stroke, direction: s.direction, text: el.textContent.trim().slice(0, 1000) }; }
    const q = KunuzJourney.state.question;
    return { viewport: { width: innerWidth, height: innerHeight }, scroll: { x: scrollX, y: scrollY }, overflow: document.documentElement.scrollWidth > innerWidth, header: box(document.querySelector('.journey-app .j-header')), content: box(document.querySelector('.j-content')), paper: box(document.querySelector('.j-modal-frame .j-paper,.j-quiz-paper,.j-island-sheet,.j-dive-panel')), dialog: box(document.querySelector('.j-dialog .j-paper')), dialogQuestion: document.querySelector('.j-dialog h2')?.textContent, dialogButtons: [...document.querySelectorAll('.j-dialog button')].map(e => e.textContent.trim()), awardSymbols: [...document.querySelectorAll('[data-action="award"] svg')].map(box), hanna: { board: box(document.querySelector('.j-board-grid')), teams: box(document.querySelector('.j-teambar')), confidence: box(document.querySelector('.j-confidence')), answerPaper: box(document.querySelector('[data-game="hanna"] .j-paper')), reveal: box(document.querySelector('.j-hanna-reveal')) }, sea: box(document.querySelector('.j-sea')), gauge: box(document.querySelector('.j-depth-track')), gaugeMarkers: [...document.querySelectorAll('.j-depth-track i')].map(box), gaugeSemantics: document.querySelector('.j-depth-track')?.outerHTML, hint: box(document.querySelector('.j-war-message')), questionHeading: box(document.querySelector('.j-island-sheet h2')), sources: [...document.querySelectorAll('.journey-app .src,.journey-app [data-source]')].map(e => ({ text: e.textContent, visible: !!(e.getBoundingClientRect().width && e.getBoundingClientRect().height) })), bankSource: q ? DATA.qs[q.index][7] : null, signedCandidates: [...document.querySelectorAll('.j-team strong,.j-confidence-card bdi,.j-verdict,.j-reward,.j-rank td,.j-hanna-reveal .j-form-card p')].map(e => ({ text: e.textContent, html: e.outerHTML, bdis: [...(e.matches('bdi') ? [e] : e.querySelectorAll('bdi'))].map(x => ({ text: x.textContent, dir: x.dir })) })) };
  });
}
async function shot(name, options = {}) {
  await page.waitForTimeout(550);
  const file = `${phase}-${name}-${width}${nativeSheets ? '-native' : ''}${sourceURL ? '-source-url' : ''}.png`;
  await page.screenshot({ path: path.join(out, file), fullPage: options.fullPage ?? true });
  const sample = { game, width, name, file, state: await state(), metrics: await metrics() };
  record.screenshots.push(sample); save(); return sample;
}
function check(name, condition, detail) {
  record.checks.push({ game, width, name, pass: !!condition, detail });
  if (phase === 'after') assert.ok(condition, `${game} ${width}: ${name}: ${JSON.stringify(detail)}`);
}
async function dialog(action, name) {
  await click(`[data-action="${action}"]`);
  const s = await shot('fix-7-' + game + '-dialog-' + name, { fullPage: false });
  const m = s.metrics;
  const rgb = m.dialog?.background.match(/\d+/g)?.map(Number) || [];
  check('theme dialog ' + name, rgb.length >= 3 && (rgb[0] + rgb[1] + rgb[2]) / 3 < 110, m.dialog);
  check('dialog buttons ' + name, m.dialogButtons?.length === 2 && m.dialogButtons.every(Boolean), m.dialogButtons);
  const expected = action === 'home' ? ['نعم، نطلع', 'لا، نبقى'] : action === 'finish-war' ? ['نعم، ننهي', 'لا، نكمل'] : ['نعم، نرجع', 'لا، نكمل'];
  check('dialog wording matches ' + name, JSON.stringify(m.dialogButtons) === JSON.stringify(expected), { question: m.dialogQuestion, buttons: m.dialogButtons, expected });
  if (action === 'finish-war') check('finish dialog matches question', m.dialogButtons?.[0] === 'نعم، ننهي' && m.dialogButtons?.[1] === 'لا، نكمل', m.dialogButtons);
  await click('[data-action="dialog-no"]');
  return s;
}
async function setup(kind) {
  game = kind;
  await page.goto(base + '/' + routes[kind]);
  await page.waitForFunction(() => window.KunuzJourney?.state.ready, null, { timeout: 60000 });
  if (await page.locator('[data-action="single-device"]').count()) await click('[data-action="single-device"]');
  await page.waitForFunction(() => KunuzJourney.state.stage === 'categories', null, { timeout: 60000 });
  const categories = await page.locator('.j-cat-pick').count();
  check('70 enabled eligible categories after main pack disables', categories === 70, categories);
  for (const cat of (sourceURL ? [27,10,0] : [10,0,1])) await click(`[data-action="cat"][data-cat="${cat}"]`);
  await click('[data-action="next-setup"]');
  await click('[data-field="time"][data-value="0"]');
  await click('[data-action="start"]');
  await page.waitForFunction(() => KunuzJourney.state.running);
  record.viewports.push({ game, width, height: width === 390 ? 844 : 700, categories, selectedCategories: (await state()).selectedCategories });
  await shot('fix-3-' + game + '-board');
  await dialog('home', 'home');
  await dialog('back', 'back');
  if (['board', 'test', 'hanna'].includes(kind)) await dialog('leave', 'settings');
}
async function pinSourceSlot() {
  const fixture = await page.evaluate(() => {
    const m = KunuzJourney.state;
    const index = m.pool.find(i => DATA.qs[i][0] === 10 && /[A-Za-z]/.test(DATA.qs[i][7] || ''));
    const slot = m.slots.findIndex(s => s.cat === 10 && !s.used);
    const original = m.slots[slot].index;
    if (index !== undefined) m.slots[slot].index = index;
    return { kind: 'real-bank-reservation', slot, original, index, source: DATA.qs[index ?? original][7], rationale: 'Reserve an existing live question with an English source so source suppression is deterministic; no bank text or answer changes.' };
  });
  record.fixtures.push({ game, width, ...fixture }); return fixture.slot;
}
async function answer(right = true) {
  const correct = await page.evaluate(() => DATA.qs[KunuzJourney.state.question.index][5]);
  await click(`[data-answer="${right ? correct : (correct + 1) % 4}"]`);
  if (game === 'test' || game === 'hanna') await click('[data-action="confirm-answer"]');
}
async function sourceCheck(s) {
  const englishVisible = s.metrics.sources.filter(x => x.visible && /[A-Za-z]/.test(x.text));
  check('English source suppressed with bank source preserved', /[A-Za-z]/.test(s.metrics.bankSource || '') && englishVisible.length === 0, { bankSource: s.metrics.bankSource, visible: englishVisible });
}
async function sourceMatrix(kinds = ['arabic']) {
  for (const kind of kinds) {
    const fixture = await page.evaluate(kind => {
      const m = KunuzJourney.state;
      const index = m.pool.find(i => !m.used.has(i) && (kind === 'url' ? /https?:\/\//i.test(DATA.qs[i][7] || '') : /[\u0600-\u06ff]/.test(DATA.qs[i][7] || '') && !/[A-Za-z]|https?:|www\./i.test(DATA.qs[i][7] || '')));
      if (index === undefined) return null;
      const slot = m.slots.findIndex(s => !s.used && s.cat === DATA.qs[index][0]);
      if (slot < 0) return null;
      const original = m.slots[slot].index;
      m.slots[slot].index = index;
      return { kind: 'real-bank-source-' + kind, slot, index, original, source: DATA.qs[index][7], rationale: 'Reserve another existing live question to verify allowed Arabic and prohibited URL source lines without changing bank contents.' };
    }, kind);
    assert.ok(fixture, 'real source fixture missing: ' + kind);
    record.fixtures.push({ game, width, ...fixture });
    await click(`[data-action="tile"][data-slot="${fixture.slot}"]`);
    await click('[data-action="reveal-answer"]');
    const s = await shot('fix-4-board-source-' + kind);
    const visible = s.metrics.sources.filter(x => x.visible).map(x => x.text);
    check('original ' + kind + ' source retained in data', s.metrics.bankSource === fixture.source, { original: fixture.source, current: s.metrics.bankSource });
    check(kind === 'arabic' ? 'Arabic source remains visible' : 'URL source omitted', kind === 'arabic' ? visible.length > 0 && visible.every(x => !/[A-Za-z]|https?:|www\./i.test(x)) : visible.length === 0, visible);
    await click('[data-action="award"][data-team="-1"]');
  }
}
async function boardGames() {
  const slot = await pinSourceSlot();
  await click(`[data-action="tile"][data-slot="${slot}"]`);
  const q = await shot('fix-3-' + game + '-question');
  const paper = q.metrics.paper;
  if (game === 'board' && width === 1366) {
    check('desktop question horizontally centered', Math.abs(paper.x + paper.width / 2 - width / 2) < 3, paper);
    if (paper.height < 580) check('desktop question vertically centered', Math.abs(paper.y + paper.height / 2 - 350) < 60, paper);
  }
  if (game === 'test') {
    check('quiz question centered in available width', Math.abs(paper.x + paper.width / 2 - width / 2) < 3, paper);
    const viewportHeight = width === 390 ? 844 : 700;
    const expectedTop = Math.max(16, (viewportHeight - paper.height) / 2);
    check('quiz question centered in available height', Math.abs(paper.y - expectedTop) < 3, { paper, expectedTop, viewportHeight });
  }
  await dialog('back', 'question');
  if (game === 'board') {
    await click('[data-action="reveal-answer"]');
    const reveal = await shot('fix-2-4-board-awards-and-source'); await sourceCheck(reveal);
    check('award SVG size and team color', reveal.metrics.awardSymbols.every((s, i) => s.width <= 30 && s.height <= 30 && s.color !== 'rgb(0, 0, 0)' && s.color !== 'rgb(255, 255, 255)'), reveal.metrics.awardSymbols);
    await click('[data-action="award"][data-team="0"]');
  } else if (game === 'test') {
    await answer(); const reveal = await shot('fix-1-4-test-signed-source'); await sourceCheck(reveal);
    await click('[data-action="question-next"]');
  } else {
    const confidence = await shot('fix-1-3-hanna-confidence');
    const hm = confidence.metrics.hanna;
    check('Hanna cards aligned with team and answer layout', Math.abs(hm.confidence.x + hm.confidence.width / 2 - (hm.teams.x + hm.teams.width / 2)) < 3 && Math.abs(hm.answerPaper.x + hm.answerPaper.width / 2 - (hm.confidence.x + hm.confidence.width / 2)) < 3, hm);
    await click('[data-action="confidence"][data-mode="bold"]'); await answer(false);
    await click('[data-action="confidence"][data-mode="bold"]'); await answer(true);
    await shot('fix-7-hanna-confidence-sheet');
    await click('[data-action="hanna-reveal"]');
    const reveal = await shot('fix-1-4-7-hanna-signed-reveal'); await sourceCheck(reveal);
    await click('[data-action="question-next"]');
  }
  await shot('fix-1-' + game + '-scores');
  if (phase === 'after' && game === 'board') await sourceMatrix();
  // Finish every real reserved tile to capture the result sheet and negative Hanna total.
  let count = 0;
  while ((await state()).stage !== 'results') {
    assert.ok(count++ < 20, 'board must terminate');
    await click(page.locator('.j-point:not(:disabled)').first());
    if (game === 'board') { await click('[data-action="reveal-answer"]'); await click('[data-action="award"][data-team="0"]'); }
    else if (game === 'test') { await answer(); await click('[data-action="question-next"]'); }
    else { await click('[data-action="confidence"][data-mode="bold"]'); await answer(false); await click('[data-action="confidence"][data-mode="safe"]'); await answer(true); await click('[data-action="hanna-reveal"]'); await click('[data-action="question-next"]'); }
  }
  await shot('fix-1-7-' + game + '-results');
}
async function dive() {
  const first = await shot('fix-5-ghaws-depth-1');
  check('dive header clear of scene', first.metrics.sea.y >= first.metrics.header.bottom, { header: first.metrics.header, sea: first.metrics.sea });
  let previous = first;
  for (let step = 0; step < 3; step++) {
    await click('[data-action="shell"]');
    if (step === 0) await shot('fix-7-ghaws-question-sheet');
    await answer();
    if (step === 0) await shot('fix-1-ghaws-reward');
    await click('[data-action="dive-next"]');
    const next = await shot('fix-5-ghaws-depth-' + (step + 2));
    const firstMarkers = previous.metrics.gaugeMarkers.map(r => r.y - previous.metrics.gauge.y);
    const nextMarkers = next.metrics.gaugeMarkers.map(r => r.y - next.metrics.gauge.y);
    check('gauge follows real depth step ' + (step + 1), next.state.dive.depth > previous.state.dive.depth && JSON.stringify(firstMarkers) !== JSON.stringify(nextMarkers), { beforeDepth: previous.state.dive.depth, afterDepth: next.state.dive.depth, beforeMarkers: firstMarkers, afterMarkers: nextMarkers, gauge: next.metrics.gaugeSemantics });
    previous = next;
  }
  await click('[data-action="dive-bank"]'); await shot('fix-1-7-ghaws-results');
}
async function warState() {
  return page.evaluate(() => { const w = KunuzJourney.state.g; return { phase: w.phase, turn: w.turn, pool: w.pool, own: w.own, ban: w.ban, links: WarEngine.LINKS, dead: SLOTS.map((_, i) => WarEngine.isDead(w, i)) }; });
}
async function war() {
  await dialog('finish-war', 'finish');
  const opening = await page.evaluate(() => { const w = KunuzJourney.state.g; return WarEngine.LINKS.flatMap(([a,b]) => [[a,b],[b,a]]).find(([a,b]) => w.own[a] === 0 && w.own[b] !== 0); });
  for (let deploy = 0; deploy < 2; deploy++) {
    const w = await warState();
    const island = w.turn === 0 ? opening[0] : Object.keys(w.own).map(Number).find(i => w.own[i] === w.turn && i !== opening[1]);
    while ((await warState()).pool > 0) await click(`[data-island="${island}"]`);
    await click('[data-action="war-next"]');
  }
  const ready = await shot('fix-6-harb-attack-hint');
  await click(`[data-island="${opening[0]}"]`);
  await shot('fix-6-harb-selected-hint');
  await click(`[data-island="${opening[1]}"]`);
  const q = await shot('fix-6-7-harb-question-sheet', { fullPage: false });
  check('island heading in viewport', q.metrics.questionHeading?.y >= 0 && q.metrics.questionHeading?.bottom <=  (width === 390 ? 844 : 700), q.metrics.questionHeading);
  check('island hint follows attack state', q.metrics.hint?.text !== ready.metrics.hint?.text, { ready: ready.metrics.hint?.text, question: q.metrics.hint?.text });
  await answer(false); await shot('fix-6-7-harb-answer-sheet', { fullPage: false });
  await click('[data-action="war-answer-next"]');
  if ((await state()).stage === 'war-pass') { await shot('fix-7-harb-defender-sheet'); await click('[data-action="war-defend"]'); await answer(false); await click('[data-action="war-answer-next"]'); }
  if ((await state()).stage === 'war-result') { await shot('fix-7-harb-result-sheet'); await click('[data-action="war-result-next"]'); }
  if ((await state()).stage !== 'results') {
    const moved = await shot('fix-6-harb-current-state-hint');
    const w = moved.state.war;
    check('island hint no stale question text', !/دور.*يهاجم|دور.*يدافع/.test(moved.metrics.hint?.text || ''), { phase: w.phase, hint: moved.metrics.hint?.text });
    await click('[data-action="finish-war"]'); await click('[data-action="dialog-yes"]');
  }
  await shot('fix-1-7-harb-results');
}
async function signedAudit() {
  const samples = record.screenshots.filter(s => s.width === width && s.game === game).flatMap(s => s.metrics.signedCandidates);
  const signed = samples.filter(s => /[+−-][٠-٩0-9]|[٠-٩0-9][+−-]/.test(s.text));
  const failures = signed.filter(s => s.text.includes('-') || !s.bdis.some(b => b.dir === 'ltr' && /^[+−][٠-٩0-9]/.test(b.text.trim())) || s.bdis.some(b => /[٠-٩0-9][+−-]$/.test(b.text.trim())));
  check('signed values isolated LTR and Unicode minus', failures.length === 0, { signedCount: signed.length, failures });
}
async function nativeReportSheet() {
  const fixture = await page.evaluate(() => {
    document.body.classList.add('journey-room');
    const button = document.querySelector('[data-kzr="game"]');
    kzrOpen('game', button);
    document.querySelector('#kzr').classList.remove('hidden');
    return { kind: 'native-room-layout-only', activated: ['body.journey-room', '#kzr existing overlay visibility'], rationale: 'Actual shipped form is shown solely to inspect native room utility-sheet layout; no room is created, no content is invented, and no report is submitted.' };
  });
  record.fixtures.push({ game, width, ...fixture });
  const s = await shot('fix-7-' + game + '-native-report-sheet', { fullPage: false });
  const native = await page.evaluate(() => {
    const el = document.querySelector('#kzr .kzr-card'), r = el.getBoundingClientRect(), style = getComputedStyle(el);
    return { x:r.x, y:r.y, width:r.width, height:r.height, right:r.right, bottom:r.bottom, background:style.backgroundColor, color:style.color, title:document.querySelector('#kzrTitle').textContent, buttons:[...document.querySelectorAll('#kzr button')].filter(x=>x.getBoundingClientRect().width).map(x=>x.textContent) };
  });
  s.metrics.nativeReport = native;
  const rgb = native.background.match(/\d+/g)?.map(Number) || [];
  check('native report sheet uses theme', rgb.length >= 3 && (rgb[0]+rgb[1]+rgb[2])/3 < 110, native);
  check('native report sheet in viewport', native.y >= 0 && native.bottom <= (width === 390 ? 844 : 700) && native.x >= 0 && native.right <= width, native);
  check('native report sheet centered', Math.abs(native.x + native.width / 2 - width / 2) <= 8 && Math.abs(native.y + native.height / 2 - (width === 390 ? 844 : 700) / 2) <= 8, native);
  check('native report controls match report task', native.title === 'الإبلاغ عن مشكلة في اللعبة' && native.buttons.some(t=>/أرسِل/.test(t)) && native.buttons.some(t=>/إلغاء/.test(t)), native);
  await page.evaluate(() => { kzrClose(); document.body.classList.remove('journey-room'); });
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [w, h] of (onlyWidth ? [[onlyWidth, onlyWidth === 390 ? 844 : 700]] : [[390,844],[1366,700]])) {
      width = w;
      for (const kind of (onlyGame ? [onlyGame] : sourceURL ? ['board'] : nativeSheets ? ['ghaws','harb'] : Object.keys(routes))) {
        if (['test','hanna'].includes(kind) && !nativeSheets && !sourceURL) {
          // Their independent screens have their own current acceptance runner;
          // the old shared board selectors no longer describe these two games.
          game = kind;
          const evidence = path.join(out, 'identity-' + kind + '-' + width);
          const result = require('node:child_process').spawnSync(process.execPath, [path.join(__dirname,'games-own-identity-browser.cjs'),'--games','--game='+kind,'--width='+width,'--height='+h,'--out='+evidence], {encoding:'utf8',maxBuffer:1<<20});
          check('current independent screen acceptance', result.status === 0, result.stderr || result.stdout);
          record.fixtures.push({kind:'current-screen-acceptance',game,width,height:h,evidence});
          process.stdout.write(result.stdout); save(); continue;
        }
        const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, serviceWorkers: 'block' });
        page = await context.newPage();
        await page.addInitScript(() => { let seed = 20261020; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; });
        page.on('pageerror', e => record.errors.push({ game, width, message: e.message }));
        page.on('console', m => { if (m.type() === 'error') record.errors.push({ game, width, message: m.text() }); });
        page.on('requestfailed', r => record.failedRequests.push({ game, width, path: new URL(r.url()).pathname, error: r.failure()?.errorText }));
        page.on('response', r => { if (r.status() >= 400) record.badResponses.push({ game, width, path: new URL(r.url()).pathname, status: r.status() }); });
        await setup(kind);
        if (sourceURL) await sourceMatrix(['url']); else if (nativeSheets) await nativeReportSheet(); else if (['board', 'test', 'hanna'].includes(kind)) await boardGames(); else if (kind === 'ghaws') await dive(); else await war();
        await signedAudit();
        console.log(`CAPTURED ${phase} ${kind} ${w}`); save();
        await context.close();
      }
    }
    check('zero browser errors', !record.errors.length && !record.failedRequests.length && !record.badResponses.length, { errors: record.errors, requests: record.failedRequests, responses: record.badResponses });
    record.finishedAt = new Date().toISOString();
    console.log(`COMPLETE ${phase}: ${record.screenshots.length} screenshots, ${record.checks.length} checks, ${record.checks.filter(x => !x.pass).length} observed failures`);
  } catch (error) {
    record.failure = error.stack; process.exitCode = 1; console.error(error);
    if (page) await page.screenshot({ path: path.join(out, `${phase}-failure-${game}-${width}.png`), fullPage: true }).catch(() => {});
  } finally { save(); await browser.close(); }
})();
