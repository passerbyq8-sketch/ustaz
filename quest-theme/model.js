/* Preview-only presentation adapters. The live bank, pack rows and room protocol are immutable. */
(function (global) {
  'use strict';
  const PER_CATEGORY = 6;
  const LEVELS = Object.freeze([1, 2, 3, 1, 2, 3]);
  const POINTS = Object.freeze([200, 400, 600]);
  const HANNA_POINTS = Object.freeze({
    bold: Object.freeze({ right: 1, wrong: -.5 }),
    safe: Object.freeze({ right: .5, wrong: 0 })
  });
  function shuffle(list, random = Math.random) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function level(index) {
    const q = global.DATA.qs[index];
    if (q.kzPack) return q.kzPack.level;
    return global.LEVELS_EXPERIMENT !== false && global.KUNUZ_LEVELS?.levels[q[8]] || 0;
  }
  function live(index) { return global.DATA.qs[index]?.[2] !== 0; }
  function categories() {
    const counts = global.DATA.cats.map(() => 0);
    global.DATA.qs.forEach((q, i) => { if (live(i)) counts[q[0]]++; });
    return global.DATA.cats.map((c, i) => ({ index: i, slug: c[0], name: c[1], count: counts[i] }));
  }
  /* Reserve only; history is marked by the real question-open event, never by setup. */
  function pool(cats, hasSeen, random = Math.random) {
    const reserved = new Set(), slots = [], shortage = [], fallback = [];
    for (const cat of cats) {
      const candidates = shuffle(global.DATA.qs.map((q, i) => i).filter(i => live(i) && global.DATA.qs[i][0] === cat && !hasSeen(i)), random);
      if (candidates.length < PER_CATEGORY) { shortage.push(cat); continue; }
      let missing = 0;
      for (const desired of LEVELS) {
        const available = candidates.filter(i => !reserved.has(i));
        // Unknown classifications are a safe mixed fallback when the experiment is removed.
        available.sort((a, b) => Math.abs((level(a) || desired) - desired) - Math.abs((level(b) || desired) - desired));
        const index = available[0], actual = level(index);
        if (actual !== desired) missing++;
        reserved.add(index);
        slots.push({ cat, pts: POINTS[desired - 1], desired, actual, index, used: false, by: -1 });
      }
      fallback.push({ cat, name: global.DATA.cats[cat][1], missing });
    }
    return { slots, indices: [...reserved], shortage, fallback };
  }
  function rank(teams, score = t => t.score) {
    const order = teams.map((t, i) => i).sort((a, b) => score(teams[b]) - score(teams[a]) || a - b);
    const top = score(teams[order[0]]);
    return { order, winners: order.filter(i => score(teams[i]) === top) };
  }
  function hannaDelta(mode, correct, value) { return value * HANNA_POINTS[mode][correct ? 'right' : 'wrong']; }
  /* BE retains its scoring/turn/rank rules; this adapter expands its old fixed-size entry. */
  function board(teams, cats, slots) {
    if (!global.BE) return { teams: teams.map(t => ({ ...t, score: 0 })), cats: cats.slice(), slots, turn: 0, used: {}, cur: null };
    const padded = cats.concat(categories().map(c => c.index).filter(c => !cats.includes(c))).slice(0, global.BE.CATS);
    const game = global.BE.newGame({ teams, cats: padded });
    game.cats = cats.slice(); game.slots = slots; return game;
  }
  global.KunuzModel = Object.freeze({ PER_CATEGORY, LEVELS, POINTS, HANNA_POINTS, shuffle, level, live, categories, pool, rank, hannaDelta, board });
})(window);
