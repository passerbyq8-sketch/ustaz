/* Local-only acceptance and before/after evidence for the two game screens.
   node tools/games-own-identity-browser.cjs --before|--after|--games|--room-flow
   Uses KUNUZ_PLAYWRIGHT_MODULE and KUNUZ_IDENTITY_SHOTS when supplied. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { chromium } = require(process.env.KUNUZ_PLAYWRIGHT_MODULE || '../.vercel/theme-tools/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const out = process.env.KUNUZ_IDENTITY_SHOTS || path.join(root, '.vercel', 'games-own-identity');
const mode = process.argv.includes('--before') ? 'before' : process.argv.includes('--after') ? 'after' : process.argv.includes('--room-flow') ? 'room-flow' : 'games';
const gameWidth = Number(process.argv.find(arg => arg.startsWith('--width='))?.split('=')[1]) || 390;
const onlyGame = process.argv.find(arg => arg.startsWith('--game='))?.split('=')[1];
const record = { mode, checks: [], screenshots: [], errors: [], blockedExternal: [] };
const referenceCommit = require('node:child_process').execFileSync('git', ['rev-parse', process.argv.find(arg => arg.startsWith('--reference='))?.slice('--reference='.length) || 'origin/main'], { cwd: root, encoding: 'utf8' }).trim();
const referenceFiles = new Map();
if (mode === 'before') {
  record.referenceCommit = referenceCommit;
  for (const file of ['quest-theme/journey.js', 'quest-theme/theme.css', 'quest-test.html', 'hanna-laha/index.html']) referenceFiles.set(file, require('node:child_process').execFileSync('git', ['show', referenceCommit + ':' + file], { cwd: root }));
}
fs.mkdirSync(out, { recursive: true });
function check(name, actual, expected = true) {
  assert.deepEqual(actual, expected, name);
  record.checks.push(name);
}
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) { res.writeHead(503); res.end('Local preview: API disabled'); return; }
  const file = path.resolve(root, '.' + decodeURIComponent(url.pathname) + (url.pathname.endsWith('/') ? 'index.html' : ''));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  const respond = (error, data) => {
    if (error) { res.writeHead(404); res.end(); return; }
    const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.png': 'image/png', '.wav': 'audio/wav' };
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data);
  };
  const reference = referenceFiles.get(path.relative(root, file).replace(/\\/g, '/'));
  if (reference) respond(null, reference); else fs.readFile(file, respond);
});
let browser, base;
const routes = { board: 'quest-board.html', harb: 'quest-harb.html', hanna: 'hanna-laha/', ghaws: 'quest-ghaws.html', test: 'quest-test.html', hub: 'quest.html' };
async function open(game, width = 390, offline = false) {
  const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce', serviceWorkers: offline ? 'allow' : 'block' });
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === base) return route.continue();
    record.blockedExternal.push(route.request().url()); return route.abort();
  });
  await context.routeWebSocket('**/*', socket => { record.blockedExternal.push(socket.url()); socket.close(); });
  await context.addInitScript(() => {
    let seed = 127;
    Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    localStorage.setItem('kunuz_journey_muted_v1', '1');
  });
  const page = await context.newPage();
  page.on('pageerror', error => record.errors.push(error.message));
  await page.goto(base + '/' + routes[game]);
  await page.waitForFunction(() => window.KunuzJourney?.state.ready, null, { timeout: 60000 });
  await page.waitForFunction(() => !document.documentElement.classList.contains('kunuz-theme-pending'));
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.querySelectorAll('.journey-app img')].map(img => img.decode())));
  return { page, context };
}
async function click(page, selector) {
  const target = typeof selector === 'string' ? page.locator(selector).first() : selector;
  await target.scrollIntoViewIfNeeded(); await page.waitForTimeout(235); await target.click();
}
async function shot(page, name) {
  await page.evaluate(() => { window.scrollTo(0, 0); document.getAnimations().forEach(animation => animation.finish()); });
  const file = (mode === 'games' || mode === 'room-flow' ? name.replace(/-390$/, '-' + gameWidth) : name) + '.png';
  const buffer = await page.screenshot({ path: path.join(out, file), fullPage: true, animations: 'disabled' });
  record.screenshots.push({ file, sha256: crypto.createHash('sha256').update(buffer).digest('hex') });
  check(name + ': no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  return buffer;
}
async function setup(page, start = true) {
  for (const cat of [2, 0, 1]) await click(page, '[data-action="cat"][data-cat="' + cat + '"]');
  await click(page, '[data-action="next-setup"]');
  await click(page, '[data-field="time"][data-value="0"]');
  if (start) await click(page, '[data-action="start"]');
}
async function protectedScreens() {
  if (mode === 'after') {
    const baseCommit = referenceCommit;
    const readBase = file => require('node:child_process').execFileSync('git', ['show', baseCommit + ':' + file], { cwd: root, encoding: 'utf8' }).replace(/\r\n/g, '\n');
    const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
    const before = readBase('quest-theme/journey.js'), after = read('quest-theme/journey.js');
    // settings() adds the room-only UI; its single-device rendering is checked
    // byte for byte at both widths below, alongside all protected games.
    for (const name of ['categories', 'home', 'hannaLock', 'hannaBeat', 'hannaReveal', 'settleHannaTile', 'judgeHanna', 'quizStart', 'quizQuestion', 'diveView', 'beginDiveGame']) {
      const pattern = new RegExp('  function ' + name + '\\([^]*?\\n  }');
      // hannaBeat is deliberately a single-line function.
      const source = text => name === 'hannaBeat' ? text.split('\n').find(line => line.startsWith('  function hannaBeat(')) : text.match(pattern)?.[0];
      check(name + ': original implementation unchanged', source(after), source(before));
    }
    for (const file of ['quest-theme/model.js', 'quest-board.html', 'quest-harb.html', 'quest-sw.js']) check(file + ': original file unchanged', read(file), readBase(file));
    const theme = read('quest-theme/theme.css'), oldTheme = readBase('quest-theme/theme.css');
    check('theme.css: every original line preserved', theme.startsWith(oldTheme));
    const added = theme.slice(oldTheme.length);
    check('theme.css: no new color literals', !/#[\da-f]{3,8}\b|\b(?:rgb|hsl)a?\(/i.test(added));
    check('theme.css: only scoped new screen classes', added.split('\n').filter(line => line.includes('{')).every(line => /^\.ezik-treasure-theme \.journey-app\[data-game=(hanna|test)\] \.j-(hanna|quiz)-/.test(line) || /^\.ezik-treasure-theme \.journey-app:is\(\[data-game=hanna\],\[data-game=harb\]\) \.j-room-flow-/.test(line)));
  }
  for (const width of [390, 1280]) {
    for (const game of ['board', 'harb', 'hanna', 'ghaws']) {
      const { page, context } = await open(game, width);
      await setup(page, false);
      const settings = await shot(page, `${mode}-${game}-settings-${width}`);
      if (mode === 'after') check(`${game} settings ${width}: identical PNG`, settings.equals(fs.readFileSync(path.join(out, `before-${game}-settings-${width}.png`))));
      if (game !== 'hanna') {
        await click(page, '[data-action="start"]');
        const play = await shot(page, `${mode}-${game}-play-${width}`);
        if (mode === 'after') check(`${game} play ${width}: identical PNG`, play.equals(fs.readFileSync(path.join(out, `before-${game}-play-${width}.png`))));
        if (game === 'board') {
          await click(page, '[data-action="tile"]');
          const question = await shot(page, `${mode}-${game}-question-${width}`);
          if (mode === 'after') check(`${game} question ${width}: identical PNG`, question.equals(fs.readFileSync(path.join(out, `before-${game}-question-${width}.png`))));
          await click(page, '[data-action="reveal-answer"]');
          await click(page, '[data-action="award"][data-team="0"]');
          check(`${game} native points ${width}`, await page.evaluate(() => KunuzJourney.state.teams[0].score), 200);
        }
        if (game === 'ghaws') {
          await click(page, '[data-action="shell"]');
          const question = await shot(page, `${mode}-${game}-question-${width}`);
          if (mode === 'after') check(`${game} question ${width}: identical PNG`, question.equals(fs.readFileSync(path.join(out, `before-${game}-question-${width}.png`))));
        }
      }
      await context.close();
    }
    const quizPage = await open('test', width);
    for (const state of ['start', 'question', 'answer']) {
      if (state === 'question') await click(quizPage.page, '[data-action="quiz-start"]');
      if (state === 'answer') {
        // Freeze only the test clock so the automatic advance cannot race a shot.
        await quizPage.page.clock.install();
        await quizPage.page.clock.pauseAt(new Date(Date.now() + 100));
        await click(quizPage.page, '[data-action="answer"]');
      }
      const image = await shot(quizPage.page, `${mode}-quiz-${state}-${width}`);
      if (mode === 'after') check(`quiz ${state} ${width}: identical PNG`, image.equals(fs.readFileSync(path.join(out, `before-quiz-${state}-${width}.png`))));
    }
    await quizPage.context.close();
    const { page, context } = await open('hub', width);
    const hub = await shot(page, `${mode}-hub-${width}`);
    if (mode === 'after') check(`hub game cards ${width}: identical PNG`, hub.equals(fs.readFileSync(path.join(out, `before-hub-${width}.png`))));
    await context.close();
  }
}
async function current(page) {
  return page.evaluate(() => {
    const m = KunuzJourney.state, q = m.question;
    return { stage: m.stage, turn: m.g?.turn, cats: m.cats, slots: m.slots.length, used: m.slots.filter(s => s.used).length, scores: m.teams.map(t => t.score),
      q: q && { index: q.index, activeTeam: q.activeTeam, confidence: q.confidence, correct: DATA.qs[q.index][5], choices: DATA.qs[q.index][4].length, settled: q.settled, revealed: q.answerRevealed, beat: q.beat, submissions: Object.keys(q.submissions).length, value: m.slots[q.slotIndex].pts } };
  });
}
async function hanna() {
  const { page, context } = await open('hanna', gameWidth);
  await setup(page);
  check('Hanna selected category order', await page.locator('.j-hanna-category').evaluateAll(nodes => nodes.map(node => Number(node.dataset.cat))), [2, 0, 1]);
  check('Hanna six questions per selected category', (await current(page)).slots, 18);
  check('Hanna ascending values within every category', await page.evaluate(() => KunuzJourney.state.cats.map(cat => KunuzJourney.state.slots.filter(slot => slot.cat === cat).map(slot => slot.pts))), Array(3).fill([200, 200, 400, 400, 600, 600]));
  check('Hanna six dots on every category button', await page.locator('.j-hanna-category').evaluateAll(nodes => nodes.map(node => node.querySelectorAll('.j-hanna-dot').length)), [6, 6, 6]);
  check('Hanna starts with all dots empty', await page.locator('.j-hanna-dot-filled').count(), 0);
  check('Hanna category labels have no question counts', await page.locator('.j-hanna-category').evaluateAll(nodes => nodes.every(node => !/[0-9٠-٩]/.test(node.textContent + node.getAttribute('aria-label')))));
  check('Hanna uses dots without a numeric header count', await page.locator('.j-counter').count(), 0);
  await shot(page, 'hanna-list-390');
  const outcomes = [[true, false], [false, false], [true, true], [false, true]];
  const totals = [0, 0], seen = new Set();
  for (let round = 0; round < 18; round++) {
    await click(page, '.j-hanna-category:not(:disabled)');
    let state = await current(page);
    check('Hanna turn ' + round, state.turn, round % 2);
    check('Hanna opens the next category in selected order ' + round, await page.evaluate(() => DATA.qs[KunuzJourney.state.question.index][0]), [2, 0, 1][Math.floor(round / 6)]);
    check('Hanna next unplayed value ' + round, state.q.value, [200, 200, 400, 400, 600, 600][round % 6]);
    const valueText = String(state.q.value).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]) + ' نقطة';
    check('Hanna displays the slot value ' + round, (await page.locator('.j-hanna-sheet > .j-tag').first().innerText()).includes(valueText));
    check('Hanna displays the approved safe/bold deltas ' + round, await page.locator('.j-hanna-confidence small').allTextContents(), ['صح: +' + String(state.q.value / 2).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]) + ' · خطأ: ٠', 'صح: +' + String(state.q.value).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]) + ' · خطأ: −' + String(state.q.value / 2).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d])]);
    check('Hanna keeps existing unset confidence ' + round, state.q.confidence, null);
    check('Hanna full screen question ' + round, await page.locator('.j-board-grid,.j-hanna-category-list').count(), 0);
    check('Hanna four answer choices ' + round, await page.locator('[data-action="answer"]').count(), 4);
    check('Hanna unopened category gets a unique question ' + round, !seen.has(state.q.index)); seen.add(state.q.index);
    if (round === 0) await shot(page, 'hanna-question-390');
    if (round === 2) await shot(page, 'hanna-question-400-390');
    if (round === 4) await shot(page, 'hanna-question-600-390');
    for (let response = 0; response < 2; response++) {
      state = await current(page);
      const team = state.q.activeTeam, mode = team === 0 ? 'bold' : 'safe', right = outcomes[round % outcomes.length][team];
      await click(page, `[data-action="confidence"][data-mode="${mode}"]`);
      await click(page, `[data-answer="${right ? state.q.correct : (state.q.correct + 1) % state.q.choices}"]`);
      await click(page, '[data-action="confirm-answer"]');
      totals[team] += state.q.value * (right ? mode === 'bold' ? 1 : .5 : mode === 'bold' ? -.5 : 0);
      if (response === 0) {
        check('Hanna first answer stays secret ' + round, (await current(page)).q.revealed, false);
        check('Hanna scores wait for reveal ' + round, (await current(page)).scores, totals.map((total, i) => i === team ? total - state.q.value * (right ? mode === 'bold' ? 1 : .5 : mode === 'bold' ? -.5 : 0) : total));
      }
    }
    check('Hanna retains confidence reveal ' + round, (await current(page)).q.beat, 'confidence');
    await click(page, '[data-action="hanna-reveal"]');
    check('Hanna original safe/bold scoring ' + round, (await current(page)).scores, totals);
    check('Hanna question locks after scoring ' + round, (await current(page)).q.settled);
    check('Hanna correct answer remains visible ' + round, await page.locator('.j-correct').count(), 1);
    if (round === 0) await shot(page, 'hanna-correct-390');
    if (round === 1) await shot(page, 'hanna-wrong-390');
    await click(page, '[data-action="question-next"]');
    if (round < 17) {
      check('Hanna fills one dot per played question ' + round, await page.locator('.j-hanna-dot-filled').count(), round + 1);
      check('Hanna disables only fully played categories ' + round, await page.locator('.j-hanna-category:disabled').count(), Math.floor((round + 1) / 6));
      check('Hanna finished category has its check mark ' + round, await page.locator('.j-hanna-category:disabled').evaluateAll(nodes => nodes.every(node => node.textContent.includes('✓ انتهت'))));
      check('Hanna category labels stay free of question counts ' + round, await page.locator('.j-hanna-category').evaluateAll(nodes => nodes.every(node => !/[0-9٠-٩]/.test(node.textContent + node.getAttribute('aria-label')))));
      check('Hanna next team highlighted ' + round, await page.locator('.j-team[aria-current="true"]').count(), 1);
    }
    if (round === 0) await shot(page, 'hanna-progress-390');
    if (round === 5) await shot(page, 'hanna-completed-category-390');
  }
  check('Hanna finishes after the last category', (await current(page)).stage, 'results');
  check('Hanna result displays only total points', await page.locator('.j-rank tbody tr').evaluateAll(nodes => nodes.map(node => node.children.length)), [2, 2]);
  check('Hanna result totals match all eighteen questions', (await current(page)).scores, totals);
  check('Hanna result contains no question count', await page.locator('.j-counter,.j-hanna-progress,.j-quiz-score').count(), 0);
  await shot(page, 'hanna-results-390');
  check('Hanna new game label', await page.locator('[data-action="again"]').innerText(), 'لعبة جديدة');
  await click(page, '[data-action="again"]');
  check('Hanna new game returns to original setup', (await current(page)).stage, 'categories');
  await context.close();
}
async function quiz() {
  const { page, context } = await open('test', gameWidth);
  check('Quiz opens its own start screen', (await current(page)).stage, 'quiz-start');
  check('Quiz start has no category/team/time/difficulty controls', await page.locator('.j-cat-pick,.j-team-row,[data-field="time"],[data-field="difficulty"],.j-stepper').count(), 0);
  await shot(page, 'quiz-start-390');
  for (const count of [5, 10]) {
    await click(page, `[data-action="quiz-count"][data-count="${count}"]`);
    await click(page, '[data-action="quiz-start"]');
    check('Quiz starts directly at the question ' + count, (await current(page)).stage, 'test-question');
    check('Quiz uses requested count ' + count, (await current(page)).slots, count);
    check('Quiz has exactly one player ' + count, (await current(page)).scores.length, 1);
    check('Quiz reserves from every available category ' + count, await page.evaluate(() => JSON.stringify(KunuzJourney.state.cats) === JSON.stringify(KunuzModel.categories().filter(c => c.count >= KunuzModel.PER_CATEGORY).map(c => c.index))));
    check('Quiz has no timer or teams ' + count, await page.locator('.j-timer,.j-timer-text,.j-teambar,.j-stepper').count(), 0);
    let correct = 0; const seen = new Set();
    for (let question = 0; question < count; question++) {
      const state = await current(page), right = question % 3 !== 1;
      check('Quiz unique question ' + count + ':' + question, !seen.has(state.q.index)); seen.add(state.q.index);
      check('Quiz four answers ' + count + ':' + question, await page.locator('[data-action="answer"]').count(), 4);
      check('Quiz progress ' + count + ':' + question, await page.locator('[role="progressbar"]').getAttribute('aria-valuenow'), String(question));
      if (question === 0 && count === 5) await shot(page, 'quiz-question-390');
      const start = Date.now();
      await click(page, `[data-answer="${right ? state.q.correct : (state.q.correct + 1) % state.q.choices}"]`);
      if (right) correct++;
      check('Quiz settles on one tap ' + count + ':' + question, (await current(page)).q.settled);
      check('Quiz immediate answer color ' + count + ':' + question, await page.locator('.j-correct').count(), 1);
      if (!right) check('Quiz wrong answer color ' + count + ':' + question, await page.locator('.j-wrong').count(), 1);
      check('Quiz locks all choices ' + count + ':' + question, await page.locator('[data-action="answer"]:not(:disabled)').count(), 0);
      if (question === 1 && count === 5) await shot(page, 'quiz-answer-390');
      await page.waitForFunction(index => KunuzJourney.state.question?.index !== index, state.q.index);
      check('Quiz advances after about 0.9 seconds ' + count + ':' + question, Date.now() - start >= 850);
    }
    check('Quiz ends ' + count, (await current(page)).stage, 'results');
    check('Quiz result counts correct answers ' + count, await page.locator('.j-quiz-score').innerText(), `${String(correct).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d])} من ${String(count).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d])}`);
    if (count === 5) await shot(page, 'quiz-results-390');
    await click(page, '[data-action="quiz-again"]');
    check('Quiz replay resets to start ' + count, (await current(page)).stage, 'quiz-start');
  }
  await click(page, '[data-action="quiz-start"]');
  const leaving = await current(page);
  await click(page, `[data-answer="${leaving.q.correct}"]`);
  await click(page, '[data-action="back"]');
  await click(page, '[data-action="dialog-yes"]');
  await page.waitForTimeout(1100);
  check('Quiz leaving cancels auto advance', (await current(page)).stage, 'quiz-start');
  check('Quiz leaving clears the scheduled callback', await page.evaluate(() => KunuzJourney.state.quizAdvance), null);
  await context.close();
}
async function hannaNavigation() {
  const { page, context } = await open('hanna', gameWidth);
  await setup(page, false);
  await click(page, '[data-field="options"][data-value="hidden"]');
  await click(page, '[data-action="start"]');
  await click(page, '.j-hanna-category:not(:disabled)');
  await click(page, '[data-action="back"]');
  await click(page, '[data-action="dialog-no"]');
  check('Hanna cancelling back preserves the question', (await current(page)).stage, 'hanna-question');
  for (const mode of ['bold', 'safe']) {
    const state = await current(page), team = state.q.activeTeam;
    await click(page, `[data-action="confidence"][data-mode="${mode}"]`);
    await click(page, '[data-action="show-options"]');
    check('Hanna preserves per-team reveal credit ' + team, await page.evaluate(i => KunuzJourney.state.teams[i].shows, team), 1);
    const right = (await current(page)).q.correct;
    await click(page, `[data-answer="${right}"]`);
    await click(page, '[data-action="confirm-answer"]');
  }
  await click(page, '[data-action="hanna-reveal"]');
  check('Hanna hidden-option scores retain original multipliers', (await current(page)).scores, [200, 100]);
  await click(page, '[data-action="question-next"]');
  await click(page, '.j-hanna-category:not(:disabled)');
  for (let response = 0; response < 2; response++) {
    const team = (await current(page)).q.activeTeam;
    await click(page, '[data-action="confidence"][data-mode="' + (team === 0 ? 'bold' : 'safe') + '"]');
    await click(page, '[data-action="hanna-manual"]');
  }
  await click(page, '[data-action="hanna-reveal"]');
  check('Hanna manual answers wait for judging', (await current(page)).q.settled, false);
  check('Hanna next is disabled until all judgments', await page.locator('[data-action="question-next"]').isDisabled());
  await click(page, '[data-action="hanna-judge"][data-team="0"][data-right="false"]');
  await click(page, '[data-action="hanna-judge"][data-team="1"][data-right="true"]');
  check('Hanna manual judging retains original scoring', (await current(page)).scores, [100, 200]);
  await click(page, '[data-action="question-next"]');
  await click(page, '.j-hanna-category:not(:disabled)');
  await click(page, '[data-action="back"]');
  await click(page, '[data-action="dialog-yes"]');
  check('Hanna abandoning a question returns to the category list', (await current(page)).stage, 'board');
  check('Hanna abandoning uses only that question', await page.locator('.j-hanna-dot-filled').count(), 3);
  check('Hanna category remains available until all six are used', await page.locator('.j-hanna-category:disabled').count(), 0);
  check('Hanna abandoning keeps all scores', (await current(page)).scores, [100, 200]);
  await context.close();
}
async function offlineScreens() {
  for (const game of ['hanna', 'test']) {
    const { page, context } = await open(game, 390, true);
    check(game + ' first visit prepares offline assets', await page.evaluate(() => KunuzJourney.diagnostics.offlineReady));
    // IndexedDB writes performed by the worker finish after the response body.
    await page.waitForTimeout(500);
    await context.setOffline(true);
    await page.reload();
    try { await page.waitForFunction(() => window.KunuzJourney?.state.ready, null, { timeout: 30000 }); }
    catch (error) {
      record.offlineFailure = await page.evaluate(() => ({ stage: window.KunuzJourney?.state.stage, error: window.KunuzJourney?.state.error, boot: window.KunuzThemeBoot?.status, bank: !!window.DATA, visual: !!window.KZV, controller: navigator.serviceWorker.controller?.scriptURL }));
      throw error;
    }
    check(game + ' new screen opens offline', (await current(page)).stage, game === 'test' ? 'quiz-start' : 'categories');
    if (game === 'test') await click(page, '[data-action="quiz-start"]'); else { await setup(page); await click(page, '.j-hanna-category:not(:disabled)'); }
    check(game + ' question opens offline', !!(await current(page)).q);
    check(game + ' offline question has four choices', await page.locator('[data-action="answer"]').count(), 4);
    await context.close();
  }
}
async function roomFlow() {
  const { page, context } = await open('hanna', gameWidth);
  const snapshot = () => page.evaluate(() => {
    const m = KunuzJourney.state;
    return JSON.parse(JSON.stringify({ cats: m.cats, teams: m.teams, settings: m.settings }));
  });
  const atSettings = () => page.waitForFunction(() => KunuzJourney.state.stage === 'settings');
  await setup(page, false);
  check('Single-device setup has no room card', await page.locator('.j-room-flow-card').count(), 0);
  await click(page, '[data-action="add-team"]');
  await page.locator('[data-team-name="0"]').fill('فريق اللؤلؤ');
  await page.locator('[data-team-name="1"]').fill('فريق المرجان');
  await click(page, '[data-action="color"][data-team="1"]');
  await click(page, '[data-field="options"][data-value="hidden"]');
  await page.locator('[data-input="reveals"]').fill('5');
  await click(page, '[data-field="time"][data-value="custom"]');
  await page.locator('[data-input="customTime"]').fill('75');
  await click(page, '[data-field="difficulty"][data-value="mixed"]');
  await click(page, '[data-field="room"][data-value="true"]');
  const original = await snapshot();
  check('Selecting room mode shows its top controls immediately', await page.evaluate(() => scrollY), 0);
  check('Room mode and room card precede all other setup cards', await page.locator('#journey-main > section').evaluateAll(nodes => nodes.slice(0, 3).map(node => node.querySelector('h2')?.textContent)), ['طريقة اللعب', 'الغرفة', 'الفرق']);
  check('Before creation shows the approved label', await page.locator('.j-room-flow-card .j-note').innerText(), 'لم تُنشأ بعد');
  check('Optional room code field removed from setup', await page.locator('[data-input="roomCode"]').count(), 0);
  check('Join link remains below Start', await page.locator('[data-action="start"]').evaluate(node => !!(node.compareDocumentPosition(document.querySelector('[data-action="join-room"]')) & Node.DOCUMENT_POSITION_FOLLOWING)));
  await shot(page, 'hanna-room-before-create-390');
  await click(page, '[data-action="start"]');
  check('Start without a saved code stays in setup', (await current(page)).stage, 'settings');
  check('Start without a saved code shows the approved message', await page.locator('.j-room-flow-start-error').innerText(), 'أنشئ الغرفة أولًا');
  check('Missing-room error is directly below Start', await page.locator('[data-action="start"]').evaluate(node => node.parentElement.nextElementSibling?.classList.contains('j-room-flow-start-error')));
  check('Start without a code loads no native room bundle', await page.locator('script[src*="index-DQ2E4Hb-"]').count(), 0);
  await shot(page, 'hanna-room-start-without-code-390');
  const historyLength = await page.evaluate(() => history.length);
  await click(page, '[data-action="room-code-open"]');
  check('Number editor has its own history entry', await page.evaluate(() => ({ added: history.length, marker: history.state.roomCode, step: history.state.step })), { added: historyLength + 1, marker: true, step: 2 });
  check('Number editor title', await page.locator('.j-header h1').innerText(), 'إنشاء غرفة');
  check('Number editor contains only Back, Random, Save', await page.locator('[data-action]').evaluateAll(nodes => nodes.map(node => node.dataset.action)), ['back', 'room-code-random', 'room-code-save']);
  check('Number editor contains only one numeric keyboard field', await page.locator('input').evaluateAll(nodes => nodes.map(node => ({ mode: node.inputMode, value: node.value }))), [{ mode: 'numeric', value: '' }]);
  check('Number editor helper', await page.locator('#j-room-flow-help').innerText(), 'هذا الرقم يدخل به اللاعبون من جوالاتهم.');
  await shot(page, 'hanna-room-editor-empty-390');
  await click(page, '[data-action="room-code-save"]');
  check('Empty code error', await page.locator('#j-room-flow-error').innerText(), 'اكتب رقمًا أو اختر رقمًا عشوائيًا');
  check('Empty error is immediately below the field', await page.locator('[data-room-draft]').evaluate(node => node.nextElementSibling?.id), 'j-room-flow-error');
  check('Empty error is accessible', await page.locator('[data-room-draft]').getAttribute('aria-invalid'), 'true');
  await shot(page, 'hanna-room-editor-empty-error-390');
  await page.locator('[data-room-draft]').fill('123');
  check('Typing clears the obsolete error', await page.locator('#j-room-flow-error').count(), 0);
  await click(page, '[data-action="room-code-save"]');
  check('Short code error uses measured limits', await page.locator('#j-room-flow-error').innerText(), 'الرقم ٤–٦ خانات');
  check('Invalid save remains in the number editor', (await current(page)).stage, 'room-code');
  await shot(page, 'hanna-room-editor-length-error-390');
  await page.locator('[data-room-draft]').fill('a1b2');
  check('Non-digits are excluded', await page.locator('[data-room-draft]').inputValue(), '12');
  await page.locator('[data-room-draft]').fill('٠١۲۳');
  check('Arabic and Persian digits normalize and keep leading zeros', await page.locator('[data-room-draft]').inputValue(), '0123');
  await page.locator('[data-room-draft]').evaluate(node => { node.value = '1234567'; node.dispatchEvent(new Event('input', { bubbles: true })); });
  await click(page, '[data-action="room-code-save"]');
  check('Overlong programmatic input is rejected', await page.locator('#j-room-flow-error').innerText(), 'الرقم ٤–٦ خانات');
  await click(page, '[data-action="room-code-random"]');
  const random = await page.locator('[data-room-draft]').inputValue();
  check('Random number matches the server four-digit format', /^\d{4}$/.test(random));
  check('Random number clears validation', await page.locator('#j-room-flow-error').count(), 0);
  check('Random number does not create or save a room', (await snapshot()).settings.roomCode, '');
  await shot(page, 'hanna-room-editor-random-390');
  await click(page, '[data-action="room-code-save"]'); await atSettings();
  original.settings.roomCode = random;
  check('Save preserves every category, team, color, symbol and option', await snapshot(), original);
  check('Saved number is displayed in the card', await page.locator('.j-room-flow-code').innerText(), random.replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]));
  check('Saved card offers Change Number', await page.locator('[data-action="room-code-open"]').innerText(), 'تغيير الرقم');
  await shot(page, 'hanna-room-after-save-390');
  await click(page, '[data-action="room-code-open"]');
  await page.locator('[data-room-draft]').fill('999999');
  await click(page, '[data-action="back"]'); await atSettings();
  check('Top Back discards draft and preserves all settings', await snapshot(), original);
  await click(page, '[data-action="room-code-open"]');
  check('Reopening restores the saved number', await page.locator('[data-room-draft]').inputValue(), random);
  await page.locator('[data-room-draft]').fill('5555');
  await page.goBack(); await atSettings();
  check('Browser/Android history Back returns to setup and preserves settings', await snapshot(), original);
  await page.goForward();
  await page.waitForFunction(() => KunuzJourney.state.stage === 'room-code');
  check('Browser Forward restores the editor without committing its draft', await page.locator('[data-room-draft]').inputValue(), random);
  await page.goBack(); await atSettings();
  for (const manual of ['0042', '01234', '012345']) {
    await click(page, '[data-action="room-code-open"]');
    await page.locator('[data-room-draft]').fill(manual);
    await click(page, '[data-action="room-code-save"]'); await atSettings();
    original.settings.roomCode = manual;
    check('Manual ' + manual.length + '-digit save preserves all settings and leading zeros', await snapshot(), original);
  }
  await shot(page, 'hanna-room-manual-after-save-390');
  await click(page, '[data-field="room"][data-value="false"]');
  check('Switching to single-device mode hides the card', await page.locator('.j-room-flow-card').count(), 0);
  check('Switching modes preserves the saved code', (await snapshot()).settings.roomCode, '012345');
  await click(page, '[data-field="room"][data-value="true"]');
  check('Switching back restores every setting', await snapshot(), original);
  // Replace only the native frontend module with a local selector-compatible
  // fixture. No worker, API, WebSocket, or actual room is used by this handoff.
  await context.route('**/hanna-laha/assets/index-DQ2E4Hb-.js', route => route.fulfill({ contentType: 'text/javascript', body: `
    window.__roomPreferences = JSON.parse(localStorage.getItem('hl-ezik.setup'));
    document.getElementById('root').innerHTML = '<button data-testid="setup-start">start fixture</button><button data-testid="more-toggle" aria-expanded="true">more</button><div data-testid="room-code"><button>auto</button><button>custom</button><input data-testid="room-code-input" value="0000"></div>';
    document.querySelector('[data-testid="setup-start"]').onclick = () => { window.__roomHandoff = { preferences: window.__roomPreferences, input: document.querySelector('[data-testid="room-code-input"]').value }; };
  ` }));
  await click(page, '[data-action="start"]');
  await page.waitForFunction(() => !!window.__roomHandoff);
  const handoff = await page.evaluate(() => window.__roomHandoff);
  check('Saved code reaches the unchanged frontend setup preferences', handoff.preferences.roomCode, '012345');
  check('Saved code reaches the native creation form', handoff.input, '012345');
  check('Native handoff keeps team names and colors', handoff.preferences.teams, [{ name: 'فريق اللؤلؤ', color: 'blue' }, { name: 'فريق المرجان', color: 'purple' }, { name: 'الأفق', color: 'purple' }]);
  check('Native handoff keeps room options', { time: handoff.preferences.timeSec, mode: handoff.preferences.mode, reveals: handoff.preferences.reveals, perCat: handoff.preferences.perCat }, { time: 75, mode: 'free', reveals: 5, perCat: 6 });
  check('Native handoff keeps category order', handoff.preferences.categories, await page.evaluate(() => KunuzJourney.state.cats.map(cat => DATA.cats[cat][0])));
  await context.close();

  const war = await open('harb', gameWidth);
  await setup(war.page, false);
  await click(war.page, '[data-field="room"][data-value="true"]');
  check('Island War room card reports automatic numbering', await war.page.locator('.j-room-flow-card .j-note').innerText(), 'الرقم تلقائي');
  check('Island War has no unsupported number selection button', await war.page.locator('[data-action="room-code-open"], [data-room-draft]').count(), 0);
  check('Island War room card immediately follows the top play mode', await war.page.locator('#journey-main > section').evaluateAll(nodes => nodes.slice(0, 3).map(node => node.querySelector('h2')?.textContent)), ['طريقة اللعب', 'الغرفة', 'الفرق']);
  await shot(war.page, 'harb-room-automatic-390');
  await click(war.page, '[data-field="room"][data-value="false"]');
  check('Island War single-device setup hides room card', await war.page.locator('.j-room-flow-card').count(), 0);
  await click(war.page, '[data-field="room"][data-value="true"]');
  await war.page.evaluate(() => {
    $('startWar').onclick = () => { window.__warHandoff = { cats: G.cats, time: G.fuse, shots: G.shots, flags: G.deployMul, win: G.winRule }; };
  });
  await click(war.page, '[data-action="start"]');
  check('Island War Start reaches its existing automatic-number action locally', await war.page.evaluate(() => window.__warHandoff), { cats: [2, 0, 1], time: 0, shots: 1, flags: 2, win: 2 });
  await war.context.close();

  const joining = await open('hanna', gameWidth);
  await setup(joining.page, false);
  await joining.context.route('**/hanna-laha/assets/index-DQ2E4Hb-.js', route => route.fulfill({ contentType: 'text/javascript', body: 'window.__joinFixture = true;' }));
  await click(joining.page, '[data-action="join-room"]');
  await joining.page.waitForFunction(() => window.__joinFixture);
  check('Join still opens without creating or selecting a code', new URL(joining.page.url()).pathname, '/hanna-laha/join');
  await joining.context.close();
  check('Room flow never attempts an external connection', record.blockedExternal, []);
}
async function legacyGames() {
  for (const game of ['board', 'harb']) {
    const child = require('node:child_process').spawn(process.execPath, [path.join(__dirname, 'kunuz-theme-browser.cjs'), '--game=' + game, '--width=390', '--reduced'], {
      cwd: root, env: { ...process.env, KUNUZ_PREVIEW_URL: base, KUNUZ_SHOTS: path.join(out, 'legacy') }, stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    child.stdout.on('data', data => { output += data; process.stdout.write(data); });
    child.stderr.on('data', data => { output += data; process.stderr.write(data); });
    const status = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve); });
    check(game + ' existing complete-game browser acceptance: ' + output.trim(), status, 0);
  }
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ headless: true });
  try {
    if (mode === 'room-flow') await roomFlow();
    else if (mode === 'games') {
      if (process.argv.includes('--legacy')) await legacyGames();
      else if (process.argv.includes('--offline')) await offlineScreens();
      else { if (!onlyGame || onlyGame === 'hanna') { await hanna(); await hannaNavigation(); } if (!onlyGame || onlyGame === 'test') await quiz(); }
    } else await protectedScreens();
    check('No browser runtime errors', record.errors, []);
    console.log(`PASS ${mode}: ${record.checks.length} checks, ${record.screenshots.length} screenshots; external requests blocked: ${record.blockedExternal.length}`);
  } catch (error) { record.failure = error.stack; console.error(error); process.exitCode = 1; }
  finally {
    fs.writeFileSync(path.join(out, mode + (process.argv.includes('--offline') ? '-offline' : process.argv.includes('--legacy') ? '-legacy' : '') + '-browser.json'), JSON.stringify(record, null, 2));
    await browser.close(); await new Promise(resolve => server.close(resolve));
  }
})();
