// kunuz-war-engine-guard.cjs -- the rules of the island war are ONE block of text (WAR-ENGINE in quest-harb.html).
// The one-device page runs it in the browser and the Hanna Laha room server runs a generated copy of the same text,
// so the two ways to play cannot have two rule books. This gate holds that together. ASCII output only.
//
//   W1 the page has exactly one block, and its sha-256 equals the pin kept here (guards/fixtures/war-engine.sha256);
//      when Hanna Laha is on this machine its generated copy and its own pin equal it too
//   W2 the page runs on the block: every rule goes through WarEngine, and no second copy of a rule is left in the page
//   W3 the geometry the page draws (the sea of each island, the routes) is the block's
//   W4 the rules: a battery of fights, the end of the war and the setup limits, then 300 random wars played to their end
//      (no error, the flags of the whole war never change)
//   W5 the battery bites: the block with one rule broken is caught each time
//
// usage: node guards/kunuz-war-engine-guard.cjs [--hl <Hanna Laha folder>]
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i > -1 ? argv[i + 1] : d; };
const HL = arg('hl', process.env.HL_REPO || 'C:/Users/passe/projects/hanna-laha');
const ascii = (s) => String(s).replace(/[^\x00-\x7f]/g, '?');
let fails = 0;
function report(id, name, ok, info) {
  if (!ok) fails++;
  console.log((ok ? 'PASS ' : 'FAIL ') + id + ' ' + name + (info ? ' :: ' + ascii(info) : ''));
}
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
const BEGIN = '/*WAR-ENGINE:BEGIN*/', END = '/*WAR-ENGINE:END*/';
function blockOf(text) {
  const t = text.replace(/\r\n/g, '\n');
  const a = t.indexOf(BEGIN), b = t.indexOf(END);
  if (a < 0 || b < a || t.indexOf(BEGIN, a + 1) >= 0 || t.indexOf(END, b + 1) >= 0) return null;
  return t.slice(a, b + END.length);
}

const page = fs.readFileSync(path.join(REPO, 'quest-harb.html'), 'utf8');
const block = blockOf(page);

// ---------------------------------------------------------------- W1
{
  const pin = fs.readFileSync(path.join(__dirname, 'fixtures', 'war-engine.sha256'), 'utf8').trim();
  const mine = block === null ? '' : sha(block);
  const notes = [];
  let ok = block !== null && mine === pin;
  if (block === null) notes.push('no single block');
  else if (mine !== pin) notes.push('the block (' + mine.slice(0, 12) + ') differs from the pin (' + pin.slice(0, 12) + ') -- run scripts/sync-war-engine.mjs in Hanna Laha');
  const copy = path.join(HL, 'apps', 'worker', 'src', 'war', 'war-engine.js');
  if (fs.existsSync(copy)) {
    const c = blockOf(fs.readFileSync(copy, 'utf8'));
    const hlPin = fs.readFileSync(path.join(HL, 'apps', 'worker', 'src', 'war', 'ENGINE.sha256'), 'utf8').trim();
    if (c === null || sha(c) !== mine) { ok = false; notes.push('the Hanna Laha copy differs from the page block'); }
    if (hlPin !== mine) { ok = false; notes.push('the Hanna Laha pin differs'); }
    notes.push('hanna-laha copy checked');
  } else notes.push('hanna-laha not on this machine');
  report('W1', 'one block, pinned, and the Hanna Laha copy is the same text', ok, 'sha=' + mine.slice(0, 12) + ' ' + notes.join('; '));
}

// ---------------------------------------------------------------- W2
{
  const outside = block === null ? page : page.replace(block, '');
  const must = ['WarEngine.tap(G,k)', 'WarEngine.undo(G)', 'WarEngine.next(G,', 'WarEngine.endTurn(G,', 'WarEngine.beginTurn(G,', 'WarEngine.beginDeploy(G)',
    'WarEngine.newWar(G,', 'WarEngine.buildSlots(', 'WarEngine.startFight(G)', 'WarEngine.fightNext(G)', 'WarEngine.fightAnswer(G,',
    'WarEngine.afterResult(G,', 'WarEngine.afterAttack(G)', 'WarEngine.canHit(G,', 'WarEngine.isDead(G,', 'WarEngine.warEnd(G)', 'WarEngine.aliveAt(',
    'WarEngine.isFast(G,', 'WarEngine.deployCount(G)', 'WarEngine.adj(', 'WarEngine.LINKS', 'WarEngine.HOLD'];
  const forbidden = [
    ['a local copy of the routes', /var LINKS=\[\[/],
    ['a local sea count', /function seaOwner\(s\)\{var lv=/],
    ['a local winner test', /function whoWon\(\)\{\s*var lv=/],
    ['a flag moved by the page', /G\.ban\[tgt\]--|G\.ban\[base\]--|G\.ban\[base\]\+\+;G\.ban\[tgt\]\+\+/],
    ['the page deciding a double hit', /hits\+=\(fast\?2:1\)|hits>=2/],
    ['a local burn threshold', /\*0\.66|\*0\.33/],
    ['the page taking an island', /G\.own\[tgt\]=G\.turn/],
  ];
  const missing = must.filter((m) => outside.indexOf(m) < 0);
  const found = forbidden.filter((f) => f[1].test(outside)).map((f) => f[0]);
  report('W2', 'the page runs on the block and keeps no second copy of a rule', missing.length === 0 && found.length === 0,
    'calls=' + (must.length - missing.length) + '/' + must.length + (missing.length ? ' missing ' + missing.slice(0, 4).join(' ') : '') + (found.length ? ' leftovers: ' + found.join(', ') : ''));
}

// ---------------------------------------------------------------- the engine, as the page runs it
const load = (text) => new Function(text + ';return WarEngine;')();
let E = null;
try { E = load(block); } catch (e) { report('W3', 'the block loads', false, e.message); }

// ---------------------------------------------------------------- W3
if (E) {
  const slots = [...page.matchAll(/\{x:\d+,y:\d+,r:\d+,s:(\d)\}/g)].map((m) => +m[1]);
  const same = slots.length === 12 && slots.every((s, k) => s === E.SEA[k]);
  const links = E.LINKS.length === 16 && E.LINKS.every((l) => l.length === 2 && l[0] !== l[1] && l[0] >= 0 && l[1] < 12);
  report('W3', 'the drawn seas are the engine\'s seas, and the routes are twelve islands wide', same && links, 'slots=' + slots.length + ' seasEqual=' + (same ? 1 : 0) + ' routes=' + E.LINKS.length);
}

// ---------------------------------------------------------------- W4 / W5 : the battery
function prng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function battery(W) {
  const bad = [];
  const mk = (owners, ban, over) => {
    const S = { players: [{ n: 'a', c: 0 }, { n: 'b', c: 1 }], own: {}, ban: {}, turn: 0, turnNo: 0, phase: 'attack', pool: 0, sel: null, tgt: null, base: 5, attacked: true,
      moveTgt: null, moveLeft: 0, placed: [], slotCat: [0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2], left: [50, 50, 50], used: {}, busy: true, fight: null, fuse: 0, shots: 1, winRule: 2,
      noOpts: false, deployMul: 2, deployFree: -1 };
    owners.forEach((o, k) => { S.own[k] = o; }); ban.forEach((b, k) => { S.ban[k] = b; });
    S.tgt = 2; return Object.assign(S, over || {});
  };
  const owners = [0, 1, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0];
  const fight = (S, ans) => {
    W.startFight(S); let st = W.fightNext(S), i = 0;
    while (st.t === 'ask') { const a = ans[i++] || null; st = W.fightAnswer(S, a === null ? null : a[0], a === null ? false : !!a[1]); if (i > 50) break; }
    return st;
  };
  const check = (name, cond) => { if (!cond) bad.push(name); };
  { const S = mk(owners, [3, 1, 3, 1, 1, 4, 1, 1, 1, 1, 1, 1]); const r = fight(S, [[false]]); check('miss moves a flag to the island attacked', r.kind === 'lose' && S.ban[5] === 3 && S.ban[2] === 4); }
  { const S = mk(owners, [3, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1]); fight(S, [[false]]); check('a lone flag does not leave the base', S.ban[5] === 1 && S.ban[2] === 3); }
  { const S = mk(owners, [3, 1, 3, 1, 1, 4, 1, 1, 1, 1, 1, 1]); const r = fight(S, [[true], [true]]); check('one hit is repelled by a right defender', r.kind === 'hold' && r.why === 'defended' && S.ban[5] === 4 && S.ban[2] === 3); }
  { const S = mk(owners, [3, 1, 3, 1, 1, 4, 1, 1, 1, 1, 1, 1]); const r = fight(S, [[true], [false]]); check('one hit and a wrong defender takes ONE flag', r.kind === 'take' && S.ban[5] === 5 && S.ban[2] === 2); }
  { const S = mk(owners, [3, 1, 3, 1, 1, 4, 1, 1, 1, 1, 1, 1]); const r = fight(S, [[true, true]]); check('a double hit is not repelled and the defender is not asked', r.kind === 'take' && r.why === 'double' && S.ban[5] === 5); }
  { const S = mk(owners, [3, 1, 3, 1, 1, 4, 1, 1, 1, 1, 1, 1], { shots: 3 }); const r = fight(S, [[true], [false], [true]]); check('two hits in three shots are not repelled, the prize is one flag', r.kind === 'take' && S.ban[5] === 5 && S.ban[2] === 2); }
  { const S = mk(owners, [3, 1, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1]); const r = fight(S, [[true, true]]); S.busy = false;
    const ev = W.afterResult(S, r); check('the last flag takes the island and offers the move', r.kind === 'fall' && S.own[2] === 0 && ev.t === 'move' && ev.left === 3 && S.phase === 'move'); }
  { const S = mk(owners, [3, 1, 3, 1, 1, 4, 1, 1, 1, 1, 1, 1]); const r = fight(S, [null]); check('no question for the attacker holds the island', r.kind === 'hold' && r.why === 'noQ'); }
  { const S = mk(owners, [3, 1, 3, 1, 1, 4, 1, 1, 1, 1, 1, 1], { left: [50, 50, 0] }); const r = fight(S, [[true]]); check('a spent category spares the defender', r.kind === 'hold' && r.why === 'noDef'); }
  { const S = mk(owners, [3, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1], { base: null, attacked: false, busy: false, tgt: null });
    const lone = W.tap(S, 3), good = W.tap(S, 0);
    check('a lone guard is refused as a base, two flags are accepted', lone.t === 'msg' && lone.code === 'guardOnly' && good.t === 'base' && S.base === 0); }
  { const S = mk([0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1], Array(12).fill(1)); S.own[2] = 0; S.own[4] = 0; S.own[5] = 0; check('two whole seas win', W.whoWon(S) === 0); S.winRule = 9; check('the whole archipelago is the other rule', W.whoWon(S) === null); }
  { check('choices burn at a third and two thirds', W.aliveAt(4, 4, 3961, 12000) === 3 && W.aliveAt(4, 4, 7921, 12000) === 2 && W.aliveAt(4, 4, 3960, 12000) === 4); }
  { const S = mk(owners, Array(12).fill(1)); S.fuse = 1000; check('a fast answer needs every choice alive', W.isFast(S, 4, 4) && !W.isFast(S, 3, 4)); S.fuse = 0; check('a fast answer needs a timer', !W.isFast(S, 4, 4)); }
  { const ok = { players: 3, cats: [1, 2, 3], fuse: 13000, shots: 2, winRule: 2, noOpts: false, deployFree: -1, deployMul: 2 };
    check('the setup limits', W.checkConfig(ok) === null && W.checkConfig(Object.assign({}, ok, { players: 5 })) === 'players' && W.checkConfig(Object.assign({}, ok, { cats: [1, 2] })) === 'cats' && W.checkConfig(Object.assign({}, ok, { fuse: 1000 })) === 'fuse'); }
  return bad;
}

function randomWars(W, n) {
  const problems = [], ends = {};
  for (let g = 0; g < n; g++) {
    const R = prng(g + 1), ri = (m) => Math.floor(R() * m);
    const players = 2 + ri(3), cats = 3 + ri(4);
    const left = Array.from({ length: cats }, () => 4 + ri(30));
    const S = { players: Array.from({ length: players }, (_, i) => ({ n: 'p' + i, c: i })), own: {}, ban: {}, turn: 0, turnNo: 0, phase: 'deploy', pool: 0, sel: null, tgt: null, base: null,
      attacked: false, moveTgt: null, moveLeft: 0, placed: [], slotCat: [], left, used: {}, busy: false, fight: null, fuse: ri(2) ? 13000 : 0, shots: 1 + ri(3), winRule: ri(2) ? 2 : 9,
      noOpts: false, deployMul: 1 + ri(3), deployFree: -1 };
    S.slotCat = W.buildSlots(left.map((_, i) => i), left, R);
    W.newWar(S, R, left);
    const total = 12 + players * W.deployCount(S);
    let ended = '', guard = 0;
    const settle = (ev) => { if (ev.t === 'over') ended = ev.why; else if (ev.t === 'turn' && !ev.canAttack) settle(W.endTurn(S, left)); };
    while (!ended && guard++ < 100000) {
      const sum = W.totalFlags(S) + (S.phase === 'deploy' ? (players - 1 - S.turn) * W.deployCount(S) : 0);
      if (sum !== total) { problems.push('war ' + g + ' flags ' + sum + '/' + total); break; }
      if (S.phase === 'deploy') {
        if (S.pool > 0) { const mine = [...Array(12).keys()].filter((k) => S.own[k] === S.turn); W.tap(S, mine[ri(mine.length)]); } else settle(W.next(S, left));
      } else if (S.phase === 'move') {
        if (S.moveLeft > 0 && R() < 0.5) W.tap(S, S.moveTgt); else settle(W.next(S, left));
      } else if (S.phase === 'attack') {
        if (S.base === null) {
          const c = [...Array(12).keys()].filter((k) => S.own[k] === S.turn && S.ban[k] >= 2 && !W.isDead(S, k) && [...Array(12).keys()].some((j) => S.own[j] !== S.turn && W.adj(k, j) && !W.isDead(S, j)));
          if (!c.length || R() < 0.03) settle(W.next(S, left)); else W.tap(S, c[ri(c.length)]);
        } else {
          const t = [...Array(12).keys()].filter((k) => W.canHit(S, k));
          if (!t.length || R() < 0.1) settle(W.next(S, left));
          else {
            const a = W.tap(S, t[ri(t.length)]); if (a.t !== 'attack') { problems.push('war ' + g + ' no attack'); break; }
            S.busy = true; W.startFight(S); let st = W.fightNext(S);
            while (st.t === 'ask') { if (!(left[st.ci] > 0)) st = W.fightAnswer(S, null, false); else { left[st.ci]--; st = W.fightAnswer(S, R() < 0.55, S.fuse > 0 && R() < 0.3); } }
            S.busy = false; const after = W.afterResult(S, st);
            if (after.t === 'over') ended = after.why; else if (after.t === 'turnEnd') settle(W.endTurn(S, left));
          }
        }
      } else break;
    }
    if (!ended) problems.push('war ' + g + ' did not end'); else ends[ended] = (ends[ended] || 0) + 1;
  }
  return { problems, ends };
}

if (E) {
  let bad = [], wars = { problems: [], ends: {} };
  try { bad = battery(E); wars = randomWars(E, 300); } catch (e) { bad = ['threw: ' + e.message]; }
  const total = Object.keys(wars.ends).reduce((a, k) => a + wars.ends[k], 0);
  report('W4', 'the rules battery passes and 300 random wars end with the flags unchanged', bad.length === 0 && wars.problems.length === 0 && total === 300,
    'rulesFailed=' + bad.length + (bad.length ? ' ' + bad.slice(0, 3).join(' | ') : '') + ' wars=' + total + ' ends=' + JSON.stringify(wars.ends) + ' problems=' + wars.problems.length + (wars.problems.length ? ' ' + wars.problems[0] : ''));

  // W5: break one rule at a time; the battery (or the wars) must notice
  const mutants = [
    ['a double hit needs three hits', (t) => t.replace('if(f.hits>=2)return take(S,"double");', 'if(f.hits>=3)return take(S,"double");')],
    ['a lost fight moves no flag', (t) => t.replace('if(S.ban[base]>1){S.ban[base]--;S.ban[tgt]++}\n    return result(S,"lose","lose")}', 'return result(S,"lose","lose")}')],
    ['the prize is two flags', (t) => t.replace('if(S.ban[tgt]>1){S.ban[tgt]--;S.ban[base]++;return result(S,"take",lead)}', 'if(S.ban[tgt]>2){S.ban[tgt]-=2;S.ban[base]+=2;return result(S,"take",lead)}')],
    ['a lone guard may attack', (t) => t.replace('if(S.ban[k]<2)return {t:"msg",code:"guardOnly"};', '')],
    ['one sea wins', (t) => t.replace('if(S.winRule===2&&seas(S,i)>=2)return i', 'if(S.winRule===2&&seas(S,i)>=1)return i')],
    ['choices burn at a half', (t) => t.replace('var BURN_FIRST=0.33', 'var BURN_FIRST=0.5')],
  ];
  const missed = [];
  mutants.forEach(([name, f]) => {
    const text = f(block);
    if (text === block) { missed.push(name + ' (anchor gone)'); return; }
    let caught = false;
    try { const M = load(text); if (battery(M).length) caught = true; else { const r = randomWars(M, 60); if (r.problems.length) caught = true; } }
    catch (e) { caught = true; }
    if (!caught) missed.push(name);
  });
  report('W5', 'the battery bites: six broken rule books are all caught', missed.length === 0, 'mutants=' + mutants.length + ' missed=' + missed.length + (missed.length ? ' ' + missed.join(', ') : ''));
}

console.log('SUMMARY ' + (fails ? 'FAILED ' + fails : 'all pass'));
process.exit(fails ? 1 : 0);
