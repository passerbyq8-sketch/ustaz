// api/gold-price.js -- ITEM 96. THE DAY'S GOLD PRICE, AND THE ONLY REASON THIS ENDPOINT EXISTS.
//
// WHAT IT IS. One GET, no body, no query, no secret, no environment variable and no store. It
// fetches ONE page from the Kuwait Ministry of Commerce and Industry, reads four numbers and one
// date line out of the markup, and hands them back as TEXT. It is not on the answer path: it
// calls no model, touches nothing under lib/ that answers a question, and is reached only by the
// Shariah calculator, at most once per device per calendar day.
//
// THE SOURCE. https://www.moci.gov.kw/ar/nthm-lasaar/gold/ -- server-rendered HTML with the
// table in the markup, so nothing here executes JavaScript or drives a browser. The ministry
// serves no robots.txt at all (measured 2026-09-12: /robots.txt answers 404 with the site's own
// "page not found" shell), so there is no rule of theirs to honour or to evade, and the request
// carries this app's ONE honest name -- lib/user-agent.js, directive 6-alif -- rather than a
// browser token it would be untrue to send.
//
// THE PRICES ARE STRINGS AND THEY STAY STRINGS. Not one Number(), parseFloat(), parseInt() or
// arithmetic operator is applied to a price anywhere in this file. What the ministry printed is
// what is validated, what is put in the response, and what the calculator's own exact-fraction
// parser is handed on the other side. A price that made a round trip through a 64-bit double
// would be a different number from the one the ministry published, and the calculator receiving
// it is built on the premise that money is never a float -- see the item 95 block in app.jsx for
// the worked fils that premise was bought with.
//
// A PARTIAL PARSE IS A FAILURE. There is no half-filled prices object and there is no default:
// if the table is gone, if one karat row is missing, or if one price cell is not a plain decimal
// number, the whole answer is { ok: false } and the reader is asked to type the price in. A
// price the ministry did not publish today, dressed as one it did, is the one outcome worth less
// than an empty field.
//
// THE TWO SHAPES, BOTH HTTP 200. Success carries source, url, updated_text, prices and
// fetched_at; failure carries ok:false and a short ascii reason and nothing else. The status is
// 200 either way because the ministry being unreachable is not this endpoint failing -- it is
// this endpoint reporting, truthfully, that today's price could not be had.
import { EZIK_USER_AGENT } from '../lib/user-agent.js';

// The one URL, written once. It is echoed back in the success body so that whoever reads the
// response can go and check the number against the page it came from.
export const GOLD_URL = 'https://www.moci.gov.kw/ar/nthm-lasaar/gold/';
// Eight seconds, as the build order specifies. The ministry answered in well under one during
// every measurement of this work; the budget is for the day it does not.
export const GOLD_TIMEOUT_MS = 8000;
// The four karats the calculator offers, in the order the ministry prints them. The ounce row is
// read past deliberately: a calculator whose nisab is 85 GRAMS has no use for it.
export const GOLD_KARATS = ['24', '22', '21', '18'];
// A PLAIN DECIMAL NUMBER, and nothing else is one. Digits, optionally a dot and more digits. No
// sign, no exponent, no thousands separator and no Arabic-Indic digit -- the ministry prints
// ASCII, and a page that stopped doing so is a page whose shape changed, which is a failure and
// not a thing to be silently converted.
const PLAIN_DECIMAL = /^[0-9]+(?:\.[0-9]+)?$/;

// Tags out, the five named entities in, whitespace collapsed. Numeric entities are deliberately
// NOT decoded: the table and the date line carry none, and a decoder here would be a second
// place that could disagree with the browser about what the ministry wrote.
function goldText(fragment) {
  return String(fragment)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * THE PARSER. Exported so that the acceptance battery drives the real one against a saved copy
 * of the real page rather than a second implementation written to agree with it.
 * @param {string} html the ministry page, whole or the slice carrying the table and the date
 * @returns {{ok:true, updated_text:string, prices:Object}|{ok:false, reason:string}}
 */
export function parseGoldPage(html) {
  const src = String(html || '');
  const table = /<table[^>]*id=["']gold_price["'][^>]*>([\s\S]*?)<\/table>/i.exec(src);
  if (!table) return { ok: false, reason: 'table_missing' };
  // The date the MINISTRY printed, raw. It is never parsed into a date object, never reformatted
  // and never replaced by a date this code computed: the line under the field has to be able to
  // say "the ministry last updated this on ..." and mean it, including on a day when the
  // ministry did not update it at all.
  const stamp = /<span[^>]*id=["']update_time["'][^>]*>([\s\S]*?)<\/span>/i.exec(src);
  if (!stamp) return { ok: false, reason: 'date_missing' };
  const updated = goldText(stamp[1]);
  if (!updated) return { ok: false, reason: 'date_missing' };

  const prices = {};
  for (const row of table[1].split(/<tr\b/i).slice(1)) {
    const type = /class=["']gold_type["'][^>]*>([\s\S]*?)<\//i.exec(row);
    const dinar = /class=["']price_dinar["'][^>]*>([\s\S]*?)<\//i.exec(row);
    if (!type || !dinar) continue;
    // The row's own label decides which karat it is. The ounce row carries no digits at all, so
    // it falls out here without being named; a karat the calculator does not offer falls out the
    // same way rather than being carried along unused.
    const digits = /[0-9]+/.exec(goldText(type[1]));
    if (!digits || GOLD_KARATS.indexOf(digits[0]) === -1) continue;
    if (Object.prototype.hasOwnProperty.call(prices, digits[0])) continue;
    // The cell reads "43.179 <the dinar's own name>": the number is the first token and the
    // currency word is the ministry's label, not part of the price. What is kept is that token,
    // character for character.
    const cell = goldText(dinar[1]).split(' ')[0];
    if (!PLAIN_DECIMAL.test(cell)) return { ok: false, reason: 'bad_price' };
    prices[digits[0]] = cell;
  }
  for (const k of GOLD_KARATS) {
    if (!Object.prototype.hasOwnProperty.call(prices, k)) return { ok: false, reason: 'karat_missing' };
  }
  return { ok: true, updated_text: updated, prices: prices };
}

/**
 * THE ROUND TRIP. Separated from the handler so that the battery can drive the transport
 * failures -- a timeout and a non-200 -- through the real code with a fetch of its own.
 * @returns {Promise<{ok:true, updated_text:string, prices:Object}|{ok:false, reason:string}>}
 */
export async function fetchGoldPrice() {
  let response;
  try {
    response = await fetch(GOLD_URL, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(GOLD_TIMEOUT_MS),
      headers: { 'User-Agent': EZIK_USER_AGENT, Accept: 'text/html' },
    });
  } catch (error) {
    // The two are told apart because they mean different things to whoever reads the log: the
    // ministry was slow, or the ministry was not there.
    const name = String(error && error.name ? error.name : '');
    return { ok: false, reason: name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'network' };
  }
  if (!response || response.status !== 200) return { ok: false, reason: 'bad_status' };
  let body;
  try { body = await response.text(); } catch (error) { return { ok: false, reason: 'network' }; }
  return parseGoldPage(body);
}

export default async function handler(req, res) {
  // ONE METHOD. Anything else is answered in the failure shape rather than with a 405, because
  // this endpoint has exactly two response shapes and both are 200 -- and because a POST that
  // could make this server open an outbound connection is an amplifier nobody asked for.
  if (req.method !== 'GET') {
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({ ok: false, reason: 'method' });
  }
  const read = await fetchGoldPrice();
  if (!read.ok) {
    // THE ONLY THING THIS ENDPOINT LOGS, and it is the reason alone: no question text, no reader,
    // no headers and no body. A failure nobody can see is a failure nobody can fix, and a log
    // line that carried more than the reason would be a second copy of somebody's data.
    console.warn('[gold-price] degraded', String(read.reason));
    // A FAILURE IS NEVER CACHED. The success header below is ten minutes; a ten-minute-old
    // failure served to everybody is how a one-second outage becomes a ten-minute one.
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({ ok: false, reason: read.reason });
  }
  // A cached success still carries its OWN updated_text, so it cannot lie about its date: the
  // line the reader sees is the line the ministry printed on the page this body was read from,
  // whatever minute the body itself is served in.
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=0');
  return res.status(200).json({
    ok: true,
    source: 'moci.gov.kw',
    url: GOLD_URL,
    updated_text: read.updated_text,
    prices: read.prices,
    fetched_at: new Date().toISOString(),
  });
}
