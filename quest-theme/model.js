/* Preview-only presentation adapters. The live bank, pack rows and room protocol are immutable. */
(function (global) {
  'use strict';
  const PER_CATEGORY = 6;
  // Compact labels let setup screens render before the full question bank loads.
  const FALLBACK_CATEGORIES = Object.freeze([{"slug":"deen","name":"الدين"},{"slug":"prayer","name":"الصلاة"},{"slug":"quran","name":"القرآن الكريم"},{"slug":"juz-amma","name":"جزء عمّ"},{"slug":"juz-tabarak","name":"جزء تبارك"},{"slug":"adhkar","name":"أذكار اليوم"},{"slug":"prophets","name":"قصص الأنبياء"},{"slug":"seerah","name":"السيرة النبوية"},{"slug":"manners","name":"الآداب والأخلاق"},{"slug":"islamic-history","name":"التاريخ الإسلامي"},{"slug":"geography","name":"الجغرافيا"},{"slug":"world-history","name":"تاريخ العالم"},{"slug":"animals","name":"عالم الحيوان"},{"slug":"physics","name":"الفيزياء"},{"slug":"biology","name":"الأحياء"},{"slug":"chemistry","name":"الكيمياء"},{"slug":"math","name":"الرياضيات"},{"slug":"hadith","name":"الأحاديث النبوية"},{"slug":"rashidun","name":"الخلفاء الراشدون"},{"slug":"umayyad","name":"الدولة الأموية"},{"slug":"abbasid","name":"الدولة العباسية"},{"slug":"ayyubid","name":"الدولة الأيوبية"},{"slug":"mamluk","name":"دولة المماليك"},{"slug":"ottoman","name":"الدولة العثمانية"},{"slug":"arab-world","name":"العالم العربي"},{"slug":"kuwait-history","name":"تاريخ الكويت"},{"slug":"cuisine","name":"المطبخ"},{"slug":"poetry-fusha","name":"الشعر الفصيح"},{"slug":"poetry-nabati","name":"الشعر النبطي"},{"slug":"fitness-health","name":"الصحة واللياقة"},{"slug":"arabic-language","name":"اللغة العربية"},{"slug":"proverbs","name":"الأمثال"},{"slug":"kuwait-sea-heritage","name":"التراث البحري"},{"slug":"kuwait-old-life","name":"الحياة الكويتية القديمة"},{"slug":"marine-life","name":"الأحياء البحرية"},{"slug":"astronomy","name":"الفلك والفضاء"},{"slug":"earth-weather","name":"علوم الأرض والطقس"},{"slug":"human-body","name":"جسم الإنسان"},{"slug":"muslim-scientists","name":"علماء المسلمين"},{"slug":"inventions","name":"الاختراعات"},{"slug":"palm-plants","name":"النخلة والنبات"},{"slug":"horses-camels-falcons","name":"الخيل والإبل والصقور"},{"slug":"first-aid","name":"الإسعافات الأولية"},{"slug":"money-economy","name":"المال والاقتصاد"},{"slug":"riddles-logic","name":"الألغاز والذكاء"},{"slug":"tech-computing","name":"التقنية والحاسوب"},{"slug":"islamic-architecture","name":"العمارة الإسلامية"},{"slug":"sahaba","name":"الصحابة والصحابيات"},{"slug":"mothers-ahlulbayt","name":"أمهات المؤمنين وآل البيت"},{"slug":"ghazawat","name":"الغزوات والسرايا"},{"slug":"tajweed","name":"التجويد"},{"slug":"asmaa-husna","name":"أسماء الله الحسنى"},{"slug":"easy-fiqh","name":"فقه العبادات"}]);
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
  function catalog() {
    if (Array.isArray(global.DATA?.cats)) return global.DATA.cats.map((row, index) => ({ index, slug: row[0], name: row[1] }));
    return FALLBACK_CATEGORIES.map((row, index) => ({ index, ...row }));
  }
  function categories() {
    const rows = catalog();
    if (!Array.isArray(global.DATA?.qs)) return rows.map(row => ({ ...row, count: null }));
    const counts = rows.map(() => 0);
    global.DATA.qs.forEach((q, i) => { if (live(i) && counts[q[0]] !== undefined) counts[q[0]]++; });
    return rows.map(row => ({ ...row, count: counts[row.index] }));
  }
  /* Device-local cycle/recency overlay. Native base/pack history remains intact for
     fallback screens and rooms; only the Journey's local reservations use cycles. */
  function history() {
    const key = 'kunuz_journey_history_v1';
    let record = { v: 1, clock: 0, order: {}, cycles: {} }, memory = false;
    const id = i => String(global.DATA.qs[i][8] ?? global.DATA.qs[i][3]);
    const slug = cat => global.DATA.cats[cat][0];
    function read() {
      global.seenRead();
      if (memory) return;
      try {
        const saved = JSON.parse(global.localStorage.getItem(key));
        if (saved?.v === 1 && Number.isSafeInteger(saved.clock) && saved.clock >= 0 && saved.order && saved.cycles) record = saved;
      } catch (_) { memory = true; }
    }
    function write() {
      if (!memory) try { global.localStorage.setItem(key, JSON.stringify(record)); } catch (_) { memory = true; }
    }
    function has(i) {
      const cycle = record.cycles[slug(global.DATA.qs[i][0])];
      return cycle ? cycle.seen.includes(id(i)) : global.seenHas(i);
    }
    function mark(i) {
      read(); global.seenMark(i);
      record.order[id(i)] = ++record.clock;
      const cycle = record.cycles[slug(global.DATA.qs[i][0])];
      if (cycle && !cycle.seen.includes(id(i))) cycle.seen.push(id(i));
      write();
    }
    function restart(cat, indices) {
      read();
      // Reserving is not seeing: abandoned, unopened questions stay unseen.
      record.cycles[slug(cat)] = { reserved: indices.map(id), seen: [] };
      write();
    }
    return Object.freeze({ read, has, mark, restart, last: i => record.order[id(i)] || 0 });
  }
  function candidates(cat, seen, random = Math.random, excluded = new Set()) {
    const has = typeof seen === 'function' ? seen : seen.has;
    const last = typeof seen === 'function' ? () => 0 : seen.last;
    const rows = global.DATA.qs.map((q, i) => i).filter(i => live(i) && global.DATA.qs[i][0] === cat && !excluded.has(i));
    const unseen = shuffle(rows.filter(i => !has(i)), random);
    // Old legacy records have no viewing order; ties use their stable bank index.
    const oldest = rows.filter(i => has(i)).sort((a, b) => last(a) - last(b) || a - b);
    return { unseen, oldest };
  }
  /* Reserve only; history is marked by the real question-open event, never by setup. */
  function pool(cats, hasSeen, random = Math.random) {
    const reserved = new Set(), indices = [], slots = [], shortage = [], fallback = [], restarts = [];
    for (const cat of new Set(cats)) {
      const { unseen, oldest } = candidates(cat, hasSeen, random, reserved);
      if (unseen.length + oldest.length < PER_CATEGORY) { shortage.push(cat); continue; }
      const choices = unseen.length < PER_CATEGORY ? unseen.concat(oldest.slice(0, PER_CATEGORY - unseen.length)) : unseen;
      if (unseen.length < PER_CATEGORY) restarts.push(cat);
      let missing = 0;
      const categorySlots = LEVELS.map(desired => ({ cat, pts: POINTS[desired - 1], desired, actual: 0, index: null, used: false, by: -1 }));
      // First protect both questions of every available exact level. A missing hard
      // slot must not consume the second medium slot before that slot is assigned.
      for (const slot of categorySlots) {
        const index = choices.find(i => !reserved.has(i) && level(i) === slot.desired);
        if (index !== undefined) { slot.index = index; slot.actual = level(index); reserved.add(index); }
      }
      for (const slot of categorySlots) if (slot.index === null) {
        const available = choices.filter(i => !reserved.has(i));
        // Unknown classifications are a safe mixed fallback when the experiment is removed.
        available.sort((a, b) => Math.abs((level(a) || slot.desired) - slot.desired) - Math.abs((level(b) || slot.desired) - slot.desired));
        slot.index = available[0]; slot.actual = level(slot.index); reserved.add(slot.index); missing++;
      }
      indices.push(...choices.filter(i => categorySlots.some(slot => slot.index === i)));
      slots.push(...categorySlots);
      fallback.push({ cat, name: global.DATA.cats[cat][1], missing });
    }
    return { slots, indices, shortage, fallback, restarts };
  }
  function reserve(cats, seen, random = Math.random) {
    seen.read();
    const result = pool(cats, seen, random);
    if (!result.shortage.length) for (const cat of result.restarts) seen.restart(cat, result.indices.filter(i => global.DATA.qs[i][0] === cat));
    return result;
  }
  function rank(teams, score = t => t.score) {
    const order = teams.map((t, i) => i).sort((a, b) => score(teams[b]) - score(teams[a]) || a - b);
    const top = score(teams[order[0]]);
    return { order, winners: order.filter(i => score(teams[i]) === top) };
  }
  function hannaDelta(mode, correct, value) { return value * HANNA_POINTS[mode][correct ? 'right' : 'wrong']; }
  /* BE retains its scoring/turn/rank rules; category and slot totals follow the selected board. */
  function board(teams, cats, slots) {
    if (!Array.isArray(cats) || cats.length < 3 || cats.length > 6 || new Set(cats).size !== cats.length) return null;
    if (!global.BE) return { teams: teams.map(t => ({ ...t, score: 0 })), cats: cats.slice(), slots, turn: 0, used: {}, cur: null };
    const game = global.BE.newGame({ teams, cats });
    if (!game) return null;
    game.cats = cats.slice(); game.slots = slots; return game;
  }
  global.KunuzModel = Object.freeze({ PER_CATEGORY, LEVELS, POINTS, HANNA_POINTS, shuffle, level, live, catalog, categories, history, candidates, pool, reserve, rank, hannaDelta, board });
})(window);
