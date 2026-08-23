// api/lessons-browse.js -- the server-side edge for the lessons browse service.
//
// The upstream token stays on the server. Every response is rebuilt from named fields here;
// an upstream field that is not in the measured contract is discarded before the browser can
// see it. In particular, no lesson-text field has a place in any row shape below.

const SEARCH_URL = 'https://lib.ezik.app/lessons/browse';

const AUTH_HEADER_NAME = 'authorization';
const AUTH_VALUE_PREFIX = 'Bearer ';
const TIMEOUT_MS = 12000;
const MAX_BYTES = 4 * 1024 * 1024;

export const LEVELS = Object.freeze(['scholars', 'series', 'lessons']);

export const ROW_FIELDS_BY_LEVEL = Object.freeze({
  scholars: Object.freeze(['scholar_id', 'count']),
  series: Object.freeze(['series', 'count']),
  lessons: Object.freeze(['unit_id', 'title', 'url'])
});

export const RESPONSE_FIELDS_BY_LEVEL = Object.freeze({
  scholars: Object.freeze(['rows', 'total']),
  series: Object.freeze(['rows', 'total', 'page', 'pages']),
  lessons: Object.freeze(['rows', 'total', 'page', 'pages'])
});

const UNAVAILABLE_BODY = Object.freeze({
  ok: false,
  error: { code: 'LESSONS_BROWSE_UNAVAILABLE', message: 'تصفّحُ الدروسِ غيرُ متاحٍ الآن.' }
});
const UPSTREAM_BODY = Object.freeze({
  ok: false,
  error: { code: 'LESSONS_BROWSE_UPSTREAM_UNAVAILABLE', message: 'تعذّرَ تصفّحُ الدروسِ الآن.' }
});
const BAD_REQUEST_BODY = Object.freeze({
  ok: false,
  error: { code: 'LESSONS_BROWSE_BAD_REQUEST', message: 'طلبُ التصفّحِ غيرُ صالح.' }
});
const METHOD_BODY = Object.freeze({
  ok: false,
  error: { code: 'METHOD_NOT_ALLOWED', message: 'الطريقةُ غيرُ مسموحة.' }
});

const has = (source, key) =>
  source != null && typeof source === 'object'
  && Object.prototype.hasOwnProperty.call(source, key) && source[key] != null;

const carry = (target, source, key) => {
  if (has(source, key)) target[key] = source[key];
};

function shapeScholarsRow(row) {
  const out = {};
  carry(out, row, 'scholar_id');
  carry(out, row, 'count');
  return out;
}

function shapeSeriesRow(row) {
  const out = {};
  carry(out, row, 'series');
  carry(out, row, 'count');
  return out;
}

function shapeLessonsRow(row) {
  const out = {};
  carry(out, row, 'unit_id');
  carry(out, row, 'title');
  carry(out, row, 'url');
  return out;
}

function shapeScholarsResponse(payload) {
  const out = {};
  if (Array.isArray(payload?.rows)) out.rows = payload.rows.map(shapeScholarsRow);
  carry(out, payload, 'total');
  return out;
}

function shapeSeriesResponse(payload) {
  const out = {};
  if (Array.isArray(payload?.rows)) out.rows = payload.rows.map(shapeSeriesRow);
  carry(out, payload, 'total');
  carry(out, payload, 'page');
  carry(out, payload, 'pages');
  return out;
}

function shapeLessonsResponse(payload) {
  const out = {};
  if (Array.isArray(payload?.rows)) out.rows = payload.rows.map(shapeLessonsRow);
  carry(out, payload, 'total');
  carry(out, payload, 'page');
  carry(out, payload, 'pages');
  return out;
}

/** Pure response shaper, exported so the guard can exercise it without a network call. */
export function shapeBrowseResponse(level, payload) {
  if (level === 'scholars') return shapeScholarsResponse(payload);
  if (level === 'series') return shapeSeriesResponse(payload);
  if (level === 'lessons') return shapeLessonsResponse(payload);
  return {};
}

/** A page is a positive integer. Every other representation becomes the first page. */
export function normalizePage(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : 1;
}

function readBody(req) {
  const raw = req?.body;
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' ? raw : {};
}

const hasScholar = (value) => typeof value === 'string' && value.trim().length > 0;

function hasRequiredInput(level, body) {
  if (level === 'scholars') return true;
  if (level === 'series') return hasScholar(body.scholar_id);
  return hasScholar(body.scholar_id) && typeof body.series === 'string';
}

function buildUpstreamBody(level, body) {
  if (level === 'scholars') return { level: 'scholars' };
  if (level === 'series') {
    return { level: 'series', scholar_id: body.scholar_id, page: normalizePage(body.page) };
  }
  return {
    level,
    scholar_id: body.scholar_id,
    series: body.series,
    page: normalizePage(body.page)
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json(METHOD_BODY);

  const body = readBody(req);
  const level = body.level;
  if (!LEVELS.includes(level)) return res.status(400).json(BAD_REQUEST_BODY);
  if (!hasRequiredInput(level, body)) return res.status(400).json(BAD_REQUEST_BODY);

  const token = process.env.SEARCH_API_TOKEN;
  if (typeof token !== 'string' || token.length === 0) {
    console.warn('[lessons-browse] unavailable', { reason: 'SEARCH_API_TOKEN_MISSING' });
    return res.status(503).json(UNAVAILABLE_BODY);
  }

  let response;
  try {
    response = await fetch(SEARCH_URL, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        [AUTH_HEADER_NAME]: AUTH_VALUE_PREFIX + token
      },
      body: JSON.stringify(buildUpstreamBody(level, body))
    });
  } catch {
    console.warn('[lessons-browse] upstream unreachable', { reason: 'FETCH_FAILED' });
    return res.status(502).json(UPSTREAM_BODY);
  }

  if (response.status === 401) {
    console.warn('[lessons-browse] upstream rejected credentials', { reason: 'UPSTREAM_UNAUTHORIZED' });
    return res.status(502).json(UPSTREAM_BODY);
  }
  if (!response.ok) {
    console.warn('[lessons-browse] upstream unavailable', { reason: 'UPSTREAM_STATUS' });
    return res.status(502).json(UPSTREAM_BODY);
  }

  const declared = Number(response.headers?.get?.('content-length') || 0);
  if (declared > MAX_BYTES) {
    console.warn('[lessons-browse] upstream body unreadable', { reason: 'BODY_TOO_LARGE' });
    return res.status(502).json(UPSTREAM_BODY);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    console.warn('[lessons-browse] upstream body unreadable', { reason: 'BODY_UNREADABLE' });
    return res.status(502).json(UPSTREAM_BODY);
  }

  res.setHeader('Cache-Control', 'private, no-store');
  return res.status(200).json(shapeBrowseResponse(level, payload));
}
