// lib/articles/public-view.js
// WHAT REACHES A SIGNED-OUT READER, AND NOTHING ELSE REACHES ONE.
//
// THE PROJECTION IS A WHITELIST, NOT A DELETION. publicArticle() BUILDS a new object out of six
// named fields; it never takes the stored record and removes things from it. The difference is
// the whole point: a `delete record.authorKey` is one forgotten line away from shipping an
// account key to the internet the day a tenth field is added, while a whitelist that does not
// name a field cannot emit it no matter what the record grows.
//
// THE FIELD THAT MUST NEVER APPEAR IS `authorKey`. It is `acct:v1:<provider>:<sub>` -- the
// account's own store key. Publishing it would hand every reader the identifier that names a
// person's record in the store, tell them which provider that person signed in with, and give
// them the provider's subject for that person. None of that is part of an article.
//
// AND `status` IS NOT PUBLISHED EITHER, though it is harmless in itself: everything that comes
// out of a public door is published by construction (lib/articles/store.js refuses to hand a
// draft to one), so a status field could only ever say 'published' and would be decoration that
// a future reader might mistake for a filter.

import { STATUS_PUBLISHED } from './store.js';

/** The six keys a public view may have, in order. There is no seventh. */
export const PUBLIC_FIELDS = Object.freeze([
  'slug', 'section', 'title', 'body', 'publishedAt', 'authorName',
]);

/**
 * THE DISPLAY NAME, RESOLVED AT SERVE TIME -- AND TODAY IT RESOLVES TO NOTHING. THIS IS MEASURED,
 * NOT ASSUMED, AND IT IS NOT AN OVERSIGHT.
 *
 * lib/auth/account.js ACCOUNT_FIELDS is exactly seven keys -- v, provider, sub, email,
 * emailVerified, createdAt, lastSeenAt -- and the writer names each one it stores, expressly so
 * that a provider sending a display name, a picture or a locale gets none of them kept. There is
 * therefore NO NAME ANYWHERE IN THIS SYSTEM to resolve: not on the account, not on the article
 * (which stores the account key alone, on purpose), and not in any configuration row.
 *
 * The honest thing a function can return in that situation is null, and the honest thing a route
 * can send is a present field holding null. What must NOT happen is any of the three tempting
 * repairs: deriving a name from the email address (which publishes part of the address), falling
 * back to the account key (which publishes the identifier this whole file exists to withhold), or
 * inventing a constant byline that nobody chose.
 *
 * So the seam is here, named, with one call site, returning null -- and where the name is to come
 * from is a decision recorded for the owner rather than taken here. When it is answered, this
 * function is the only place that changes.
 */
export function resolveDisplayName(authorKey) {
  return null;
}

/**
 * A stored record -> what a signed-out reader receives. Returns null for anything that is not a
 * published record, so even a caller that reached past the store's own filter emits nothing.
 */
export function publicArticle(record) {
  if (!record || typeof record !== 'object') return null;
  if (record.status !== STATUS_PUBLISHED) return null;
  return {
    slug: typeof record.slug === 'string' ? record.slug : '',
    section: typeof record.section === 'string' ? record.section : '',
    title: typeof record.title === 'string' ? record.title : '',
    body: typeof record.body === 'string' ? record.body : '',
    publishedAt: typeof record.publishedAt === 'string' ? record.publishedAt : null,
    authorName: resolveDisplayName(record.authorKey),
  };
}

/** The same projection over a list. A record that is not publishable is dropped, not emitted. */
export function publicArticles(records) {
  if (!Array.isArray(records)) return [];
  const out = [];
  for (const record of records) {
    const view = publicArticle(record);
    if (view) out.push(view);
  }
  return out;
}
