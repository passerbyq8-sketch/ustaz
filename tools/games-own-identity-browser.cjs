/* Local-only acceptance and before/after evidence for the two game screens.
   node tools/games-own-identity-browser.cjs --before|--after|--games
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
const mode = process.argv.includes('--before') ? 'before' : process.argv.includes('--after') ? 'after' : 'games';
const gameWidth = Number(process.argv.find(arg => arg.startsWith('--width='))?.split('=')[1]) || 390;
const onlyGame = process.argv.find(arg => arg.startsWith('--game='))?.split('=')[1];
const record = { mode, checks: [], screenshots: [], errors: [], blockedExternal: [] };
const referenceCommit = '8dca7e552c19cede94346dae19d62b36afdc9c4b';
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
const routes = { board: 'quest-board.html', harb: 'quest-harb.html', hanna: 'hanna-laha/', test: 'quest-test.html', hub: 'quest.html' };
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
  const file = (mode === 'games' ? name.replace(/-390$/, '-' + gameWidth) : name) + '.png';
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
    const baseCommit = '8dca7e552c19cede94346dae19d62b36afdc9c4b';
    const readBase = file => require('node:child_process').execFileSync('git', ['show', baseCommit + ':' + file], { cwd: root, encoding: 'utf8' }).replace(/\r\n/g, '\n');
    const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
    const before = readBase('quest-theme/journey.js'), after = read('quest-theme/journey.js');
    for (const name of ['categories', 'settings', 'home', 'hannaLock', 'hannaBeat', 'hannaReveal', 'settleHannaTile', 'judgeHanna']) {
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
    check('theme.css: only scoped new screen classes', added.split('\n').filter(line => line.includes('{')).every(line => /^\.ezik-treasure-theme \.journey-app\[data-game=(hanna|test)\] \.j-(hanna|quiz)-/.test(line)));
  }
  for (const width of [390, 1280]) {
    for (const game of ['board', 'harb', 'hanna']) {
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
      }
      await context.close();
    }
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
  check('Hanna one question per selected category', (await current(page)).slots, 3);
  await shot(page, 'hanna-list-390');
  const outcomes = [[true, false], [false, false], [true, true]];
  const totals = [0, 0], seen = new Set();
  for (let round = 0; round < 3; round++) {
    await click(page, '.j-hanna-category:not(:disabled)');
    let state = await current(page);
    check('Hanna turn ' + round, state.turn, round % 2);
    check('Hanna keeps existing unset confidence ' + round, state.q.confidence, null);
    check('Hanna full screen question ' + round, await page.locator('.j-board-grid,.j-hanna-category-list').count(), 0);
    check('Hanna four answer choices ' + round, await page.locator('[data-action="answer"]').count(), 4);
    check('Hanna unopened category gets a unique question ' + round, !seen.has(state.q.index)); seen.add(state.q.index);
    if (round === 0) await shot(page, 'hanna-question-390');
    for (let response = 0; response < 2; response++) {
      state = await current(page);
      const team = state.q.activeTeam, mode = team === 0 ? 'bold' : 'safe', right = outcomes[round][team];
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
    if (round < 2) {
      check('Hanna completed categories disabled ' + round, await page.locator('.j-hanna-category:disabled').count(), round + 1);
      check('Hanna next team highlighted ' + round, await page.locator('.j-team[aria-current="true"]').count(), 1);
    }
    if (round === 0) await shot(page, 'hanna-completed-category-390');
  }
  check('Hanna finishes after the last category', (await current(page)).stage, 'results');
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
  check('Hanna abandoning a question finishes its category', (await current(page)).stage, 'results');
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
    if (mode === 'games') {
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
