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
//
// AN ARTICLE CARRIES NO AUTHOR FIELD AT ALL. DECISION D-7, TAKEN BY THE OWNER ON 2026-09-07:
// articles are published UNSIGNED, under the application's own name.
//
// Until that decision this file projected an `authorName` and resolved it through a named seam
// that returned null on every article, because no display name existed anywhere in the system to
// resolve -- and the seam was left standing with the question written on it. The question has now
// been answered, and the answer was not "find a name". So the field is GONE rather than nulled,
// and the seam is gone with it.
//
// THREE THINGS THAT WERE NOT DONE INSTEAD, each of them a worse answer to the same decision:
//
//   NOT a constant byline. Putting the application's name into the data would make every response
//   carry an assertion about authorship that the store never recorded, and would freeze into the
//   wire format a piece of branding that belongs to the client's layout.
//   NOT a null `authorName` kept "for the shape". A field that is always null is a promise to a
//   client that something may one day arrive in it, and D-7 is the decision that nothing will.
//   NOT a new byline field of any kind. The owner said unsigned INITIALLY; a field added now
//   would be a guess at a shape he has not chosen, and an unused field is the hardest kind to
//   remove later.
//
// HOW A READER SEES AN UNSIGNED ARTICLE IS A CLIENT DECISION AND HAS NOT BEEN TAKEN. That is a
// layout question, and it is answered where layout is answered, on nothing this file emits.
//
// `authorKey` REMAINS ON THE STORED RECORD, and it is untouched by any of this: it is how an
// editor's own work is identified inside the store and it is where a byline would one day be
// resolved FROM. It must continue never to appear in any public response -- which is the rule at
// the top of this file, and it is now the only rule about authorship this projection has.

import { STATUS_PUBLISHED, safeKind } from './store.js';

/**
 * The six keys a public view may have, in order. There is no seventh.
 *
 * `kind` JOINED ON 2026-09-07 FOR DECISION D-11, and it is the only field that has ever been
 * added to this whitelist. It is the writer's own choice of SHAPE -- a question-and-answer card,
 * or an article -- and a reader's list has to draw the two differently, so it has to travel. It
 * says nothing about who wrote the piece, names nothing in the store, and cannot be turned into
 * an identifier: it is one of two words, both of them written here in this file.
 *
 * IT IS PROJECTED THROUGH safeKind() RATHER THAN COPIED. A record written before the field
 * existed has no `kind` at all, and a whitelist that emitted `undefined` for it would hand every
 * client a third case to handle that the store never intended. The default is the plain shape.
 */
export const PUBLIC_FIELDS = Object.freeze([
  'slug', 'section', 'kind', 'title', 'body', 'publishedAt',
]);

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
    kind: safeKind(record.kind),
    title: typeof record.title === 'string' ? record.title : '',
    body: typeof record.body === 'string' ? record.body : '',
    publishedAt: typeof record.publishedAt === 'string' ? record.publishedAt : null,
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
