'use strict';
// OTA-6: numeral choice, independent of Arabic/English interface direction.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../app.jsx'), 'utf8');
const digits = source.slice(source.indexOf('const PRAYER_AR_DIGITS ='), source.indexOf('function prayerClockUi('));
const greg = source.slice(source.indexOf('function prayerGregLabel('), source.indexOf('// A moment\'s minutes-of-day'));
assert(digits && greg);
function verify(code) {
  let checks = 0;
  for (const lang of ['ar', 'en']) for (const setting of ['latn', 'arab']) {
    const scope = { Intl, Date, EZ_LANG: lang, readPrayerPrefs: () => ({ digits: setting }) };
    const f = vm.runInNewContext(code + '\n' + greg + '\n({prayerDigits, prayerGregLabel})', scope);
    const expected = setting === 'arab' ? '\u0662\u0660\u0662\u0666-\u0661\u0661-\u0660\u0665' : '2026-11-05';
    assert.equal(f.prayerDigits('2026-11-05'), expected);
    assert.equal(f.prayerDigits('\u0662\u0660\u0662\u0666-\u0661\u0661-\u0660\u0665'), expected);
    const date = f.prayerGregLabel({ y: 2026, m: 11, d: 5 });
    assert(setting === 'arab' ? /\u0662\u0660\u0662\u0666/.test(date) && !/[0-9]/.test(date) : /2026/.test(date) && !/[\u0660-\u0669]/.test(date));
    checks += 3;
  }
  return checks;
}
const mutant = digits.replace("d = readPrayerPrefs().digits", "d = 'latn'");
assert.notEqual(mutant, digits);
if (process.argv.includes('--mutant')) verify(mutant);
else {
  const checked = verify(digits);
  assert.throws(() => verify(mutant), assert.AssertionError);
  for (const fragment of [
    'prayerDigits(hijri)',
    'prayerDigits(ez110Countdown(status.remainingMs))',
    'return prayerDigits(prayerClockL(mins))',
    'return prayerDigits(prayerCountdownText(ms))',
    'prayerDigits(hijriLabel(hijriForCivilDay(view.y, view.m, view.d, readHijriOffset())))',
    'prayerDigits(hijriLabel(hijriForCivilDay(todayP.y, todayP.m, todayP.d, readHijriOffset())))'
  ]) assert(source.includes(fragment), 'home/prayer/calendar date and time wiring: ' + fragment);
  console.log('PASS OTA-6: ' + checked + ' actual Arabic/English formatter checks; six UI paths; forced Western mutation rejected.');
}
