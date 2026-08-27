# EZIK — round report · parental gate + child AI consent + three text corrections

**2026-08-27 · tree `ustaz` · branch `feat/parental-gate-20260827` · base `main` at `683bbce`**
**Ends at preview. No merge into `main`, no push to `main`.**

Order: `ORDER-EZIK-PARENTAL-GATE-2026-08-27.md`, as amended by `ORDER-EZIK-PARENTAL-GATE-ERRATA-1.md`.

---

## Preview

**https://ustaz-git-feat-parental-gate-20260827-musaed-s-projects1.vercel.app**

Deployment `dpl_4MH6y6TFnBhmjS381eGr4ZEf99Ex`, head `60c40d8`. It is SSO-protected at the edge;
open it with the automation bypass (`?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=…`)
or from a signed-in Vercel session.

Commits: `5466a27` (the work) · `60c40d8` (the gate widening and the CORE ledger) · this report.

---

## 1 · What §0 measured, and what the errata settled

The §0 report is in the session transcript; the three findings it raised were all accepted by the
errata. Recorded here as **measured**, not as work performed:

- **The parental code never lived on the device, and it still does not.** D12 (`3ba5823`,
  2026-08-07) moved it to `api/parent-code.js` — scrypt over a random salt, `timingSafeEqual`, a
  record at `pc:v1:rec:<deviceId>`, and a two-dimension attempt limiter the client cannot reset.
  **So the owner's requirement that the parental code survive «حذف كل البيانات» is already
  satisfied, and nothing in this round had to make it true.** `resetAll` cannot remove what it
  cannot reach: the only device keys near it are `parent_pin_hash` (a dead migration seed, never
  written since D12) and `mrb_device_v1`, and both are already declared `MUST_STAY` on the roster
  with the delete.html sentence that justifies them.
- **The truth gate needed no widening.** `tools/delete-truth-measure.cjs:626–635` already fails on
  an unexpected survivor *and* on an expected survivor that did not survive, and `:521` already
  asserts the classification is total. The clause was withdrawn; nothing there was touched.
- **The adhkar banner header was already true.** It was corrected in `ff2df55` the day before.
  What was false was the paragraph under it.

### Roster and assertion counts — before and after

|  | before | after |
|---|---|---|
| keys `delete-truth-measure.cjs` classifies | 45 (27 go, 20 stay, 0 unclassified) | **45 (27 go, 20 stay, 0 unclassified)** |
| `deletetruth` cases | 28/28 | **28/28** |

**Unchanged, and that is the result.** This round added **no device storage key at all** — not for
the code, not for its age, not for the consent dimension. There was nothing to register.

---

## 2 · §1 — the code keeps its place and gains two things

### 2·1 · An age — `api/parent-code.js`

A record now carries `setAt`, and `CODE_MAX_AGE_MS` (365 days, written as 365 days and said so)
after that instant the code is **expired**.

**Expiry is judged in the endpoint, never by a store TTL**, and the errata asked for exactly that.
A TTL deletes the record, and a deleted record cannot tell the screen that a code ever existed —
the parent would meet a blank create form and conclude their code was never saved. The record
therefore **outlives the credential**, which is what lets the interface say what happened.

For authority, an expired record is exactly a device with no code:

| | live record | expired record | no record |
|---|---|---|---|
| `status` | `hasCode:true, expired:false` | `hasCode:false, expired:true` | `hasCode:false, expired:false` |
| `verify` | opens the panel | `401 parent-expired`, **no attempt spent** | `401 parent-refused` |
| `set` | refused | **writes over it** | accepted |

`hasCode` still means "can this code open the panel", so a cached bundle that never learned about
`expired` still lands in create mode — the right destination. `expired` is purely additive.

**A record from before this round has no `setAt` and is NOT expired.** We do not know when it was
set, and guessing "long ago" would throw every existing parent out of their own panel on deploy
day. It is **stamped instead, best-effort, on its next successful verify** — same salt, same
digest, nothing about the credential moves — so its twelve months run from the first instant we
could honestly start counting. A stamp that fails to write changes no answer.

### 2·2 · A way out — the `delete` action, guarded by the code itself

Same scrypt comparison as `verify`, in the same request, under the same two-dimension limiter. A
wrong code spends an attempt exactly as a wrong verify does. **An unconfirmed removal fails
closed** (`parent-unavailable`): a parent told the code is gone while it still stands would hand
the device on believing the panel was open. On success the record is removed and `status` reads
as no code set.

No other verb was opened up: `status` / `verify` / `set` / `delete` and nothing else.

### 2·3 · The control — `ParentCodeCard`, on the parents' dashboard

Two deliberate steps, for the reason «حذف كل البيانات» is two: a control that removes a parent's
own barrier must not be reachable by one stray tap on a phone a child is holding. The card asks
for the code again — reaching the screen already cost one correct code, so a second entry proves
nothing about *who* is holding the device and everything about *intent*.

**It writes nothing to the device.** The typed code is POSTed once and dropped. No digest, no
timestamp, no flag. The server owns the wording of every failure, as `ParentGate` does.

### 2·4 · One new sentence in `delete.html`, in both languages

**Added beside the two pinned sentences, never in place of them.** Both are byte-identical and
`deletetruth` still finds them at `:95` / `:139`.

### 2·5 · Biometrics

Not in this round, as ordered. **Zero WebAuthn, zero platform authenticator, zero
`navigator.credentials`** anywhere in the change set.

---

## 3 · §2 — the consent belongs to a profile

The record answered for the **device**, which was wrong in exactly one direction: a second child
profile on a tablet whose first profile had consented was **never asked**, and the app behaved as
though somebody had spoken for a child nobody had spoken for.

The record now carries the `pid` it was given for, and it counts for that profile alone. Both
halves of the comparison must be a non-empty string and equal, so:

- a record with **no pid** — every record written before today — matches nothing, and **a profile
  that predates this change is asked once at first use**, never assumed to have consented;
- a record for **another pid** matches nothing, and the new profile is asked in its own right;
- a device with **no readable profile** yields no pid and matches nothing either.

**Same key `ezik_ai_consent_v1`, same roster entry, no new storage.** The pid rides inside the
record under the key `delete.html` already names, which is what keeps both the page and the
roster true without either being touched. It stays device-local: the pid is never sent — the
server still sees only the `x-ezik-ai-consent` version header.

The one-time consent a **new** profile is created behind falls out of this: the create handler
mints the pid and writes the profile, the consent branch sits above every screen, and a brand-new
profile has no matching record — so the parent answers **before the profile can be used**,
whatever the device answered for anybody else.

---

## 4 · §3 — the three text corrections

### 4·1 · One name for the delete-all action — every location changed

| Location | before | after |
|---|---|---|
| `app.jsx:17198` — the button itself | `حذف كل البيانات وإعادة البدء` | **`حذف كل البيانات`** |
| `app.jsx:472` — ar `auth.deleteBody` | quotes the old name | quotes **`حذف كل البيانات`** |
| `app.jsx:813` — en `auth.deleteBody` | quotes the old name | quotes **`حذف كل البيانات`** |
| `delete.html:88` — the third wording | `«مسح كلّ البيانات»` | **`«حذف كل البيانات»`** |
| `delete.html:132` — English | `"Erase all data"` | **`"Delete all data"`** |

`app.jsx:11443`, the confirm dialog, already read `هل أنت متأكد من حذف كل البيانات؟` — it carries
the unified name inside a question and was left as it stands; flattening it would have broken the
sentence, not unified it.

No guard asserted the old wording. `chat-history-guard.cjs:347` and `:676` already named the new
one. `مسح كلّ البيانات` and `Erase all data` now appear nowhere in the tree.

### 4·2 · The false adhkar paragraph — deleted, not reworded

`app.jsx:6710–6715`, six lines opening `IT IS OFF UNTIL THE PARAMETER SAYS OTHERWISE …` and
closing `… because the default direction here is the screen that is already true of production.`
It claimed the group doors were off for everyone; they were raised for everyone in `8665d66`, and
the paragraph was contradicted by the `🔴 RAISED FOR EVERYONE` paragraph eleven lines below it.
Gone. No guard pinned the text.

### 4·3 · The scheduling sentence — both screens, both languages

**ar:** `تُجدوَلُ على هذا الجهازِ حتّى {n} من الأيّامِ القادمة — وتقِلُّ إن كثُرَتِ التذكيراتُ — وتُجدَّدُ كلّما فُتِحَ التطبيق.`
**en:** `Scheduled on this device for up to {n} days ahead — fewer when you add more reminders — and refreshed each time you open the app.`

Applied to `reminders.window` (`app.jsx:442` / `:783`, the reminders screen) **and** to the
sibling `prayer.notify.note` (`app.jsx:426` / `:768`, the prayer screen), which carried the
identical falsehood. Why it was false: `ezikSchedPayload` sorts ascending precisely because *"the
shell cuts the FARTHEST when its cap is reached"* (`app.jsx:15195`), so seven days holds at low
counts and not at high ones.

---

## 5 · Gates — widened, never created

`gates.json` is **99 entries**, unchanged. Suite **99/99 EXIT=0**, recon **PASS=190 WARN=1
FAIL=0**, tree clean.

| gate | before | after | what was widened |
|---|---|---|---|
| 64 `lockpackage` | 82 | **110** | B10 (the age: the 365-day boundary from both sides, the record surviving its own expiry, `status` reporting it, `set` writing over it, a record with no age not expiring and being stamped) and B11 (the way out: wrong code, limiter, right code, status afterwards, no record, unconfirmed removal, expired code, no new verb). B8 gains six client checks. B2's carrier search skips `setAt` **and pins its shape** — a 13-digit epoch integer contains a given 4-digit run about one time in a thousand, so leaving it in the haystack would have reddened the gate at random with no code change behind it. |
| 51 `aiconsent` | 277 | **291** | new part M: the per-profile rule from six directions, plus a check that no second storage key was invented. |
| 12 `history`, 20 `chatux`, 21 `a11y`, 61 `i18nui` | 150 / 439 / 138 / 277 | same | `AI_CONSENT_SEED` becomes a function of the pid and each seed site passes the pid of the profile beside it. **Not one assertion was removed or relaxed**; all four were opening on the consent screen and now measure the screen they always meant to. |
| 89 `vacuousassert` | — | — | **It caught this round's own new guard code**: B8's `!/localStorage/.test(card)` passed loudest when `card` was `''` because its anchor had moved — item 106's trap, inside a check written against item 106's trap. `card.length > 0 &&` added to that assertion. |
| 17 `bankintegrity` | — | — | CORE ledger re-cut, not widened. |

**No gate was created. No assertion was deleted, weakened, or skipped.**

### The CORE ledger

`app.js` 1193820 → **1200997** (+7177). `CORE_BYTES` 2036667 → **2043844** — exactly that delta;
no CORE entry was added or removed. All three `app.js` pins moved in the same commit (the `sw.js`
byte table, the constant, the `SW_PROSE` mirror in the bank guard), and the 13-file seal on
`sw.js` is re-cut last. `CACHE` is **not** bumped: install rewrites every CORE entry into the same
store.

### Data files — untouched, all four copies verified on disk

| file | bytes | SHA-256[0:8] |
|---|---|---|
| `adhkar.json` | 177392 | **19EF96B9** ✓ |
| `adhkar-split-27.json` | 7182 | **56C0FC1A** ✓ |
| `lib/data/adhkar.json` | 177392 | **19EF96B9** ✓ |
| `lib/data/adhkar-split-27.json` | 7182 | **56C0FC1A** ✓ |

`git diff main..HEAD -- '*adhkar*.json'` is empty.

---

## 6 · Measured on the preview, in a real browser — 32/32

Headless Chrome over CDP against the preview URL, not a local harness. **A real code was set and
really deleted against the live server record**, on a throwaway device id, twice.

```
0. the preview really is this branch
  PASS  the preview serves app.js at the byte length on disk   [served 1200997]
1. §2 -- the consent belongs to a profile
  PASS  a record for THIS profile still opens straight into the app
  PASS  a record with NO pid -- every record written before today -- asks once at first use
  PASS  another profile's answer is not this profile's answer
  PASS  ...and nothing was silently rewritten while it asked
  PASS  answering writes the answer against the profile that gave it   [pid:"PREVIEW-PID-1"]
2. §3.1 / §3.3 -- the three texts, as painted
  PASS  the reminders screen carries the new scheduling sentence
  PASS  ...and the promise of seven days flat is gone from it
  PASS  ...and it says the count falls as reminders are added
3. §1 -- the parent code: create, delete, and back to no code
  PASS  a device with no record opens the CREATE form, not the verify form
  PASS  ...and an adult profile meets no arithmetic challenge
  PASS  ...and nothing about an expiry is claimed, because nothing expired
  PASS  a saved code lands on the parents' dashboard
  PASS  ...which now carries the code card
  PASS  ...and the delete-all button now carries ONE name
  PASS  the delete control arms rather than firing
  PASS  a WRONG code is refused by the server, and the code is still set   [server said: رمز خاطئ]
  PASS  the RIGHT code deletes it, and the card says so
  PASS  ...and the SERVER agrees the device has no code set   [{"hasCode":false,"expired":false}]
  PASS  the whole walk invented no storage key for the code
        [child_profile,ezik_ai_consent_v1,ezik_ui_lang_v1,mrb_device_v1]
4.  PASS  no verb beyond status/verify/set/delete was opened up
5. delete.html
  PASS  the page still promises what it promised, in Arabic / ...and in English
  PASS  the page now names the in-app delete, in Arabic / ...and in English
  PASS  the delete-all action is named the same way the app names it / ...and in English
  PASS  the twelve months are stated to the reader
OK: 32/32 checks passed
```

One check failed on the first run and it was **the probe's own error, not the app's**:
`fetch('/app.js').then(r=>r.text()).then(t=>t.length)` counts code points, and `app.js` is full of
Arabic literals, so a byte-identical file measured 51,453 short. Corrected to `arrayBuffer()`.

### Tap-paths

**The parental-code card (new):**
`القائمة` (chat header, by aria-label) → `الإعدادات` (drawer profile row, **only while the drawer
is open**) → `التحكم` → the code form → the parents' dashboard → the card **رمز لوحة الأهل** →
`حذف رمز لوحة الأهل` → type the code → `تأكيد الحذف`.

**The expiry line (new):** the same path, on a device whose record is over twelve months old. It
draws above the code field of the **create** form only.

**The scheduling sentence:** `القائمة` → `الإعدادات` → scroll to `تذكيراتُ العبادة` (last line of
the group) · and the prayer copy at Home → the prayer/qibla sheet.

**The per-profile consent:** no new screen — the existing consent screen, now reached by a profile
that has not answered for itself.

### New Arabic written this round — for the owner to approve or replace

The three strings the order fixed verbatim are not listed; these are the ones I had to write.

| # | where | text |
|---|---|---|
| 1 | `api/parent-code.js` `parent-expired` | `انتهت مدّة الرمز. اختر رمزًا جديدًا` |
| 2 | card label | `رمز لوحة الأهل` *(the app's existing name for it)* |
| 3 | card status, code set | `مضبوطٌ على هذا الجهاز، ويُطلَب عند فتح لوحة الأهل.` |
| 4 | card status, after deletion | `لا رمز على هذا الجهاز الآن. سيُطلَب ضبطُ رمزٍ جديدٍ عند فتح لوحة الأهل.` |
| 5 | the delete button | `حذف رمز لوحة الأهل` |
| 6 | armed hint | `أدخِلِ الرمزَ نفسَه لتأكيد حذفه.` |
| 7 | confirm button | `تأكيد الحذف` |
| 8 | delete failed, no server sentence | `تعذّر الحذف الآن. جرّب بعد قليل.` |
| 9 | `ParentGate`, create form after an expiry | `انتهت مدّة الرمز السابق بعد اثني عشر شهراً من ضبطه. اختر رمزاً جديداً.` |
| 10 | `delete.html`, new paragraph | `ولك أن تحذفَ رمزَ قفلِ الوالدينِ من داخِلِ التطبيقِ نفسِه: افتحْ لوحةَ الأهلِ واضغطْ «حذف رمز لوحة الأهل» ثمّ أدخِلِ الرمزَ نفسَه للتأكيدِ. ويُمحى عندَنا في الحالِ. والرمزُ ينتهي من تلقاءِ نفسِه بعدَ اثني عشرَ شهرًا من ضبطِه، فيُطلَبُ رمزٌ جديد.` |

And the one English sentence: the `delete.html` mirror of #10, and the `{n}`-preserving
`reminders.window` / `prayer.notify.note` pair the errata fixed verbatim.

---

## 7 · 🔴 What is NOT provable in a browser, and what still needs a device

**Not provable in a browser at all:**

1. **The twelve months actually elapsing.** No browser can wait a year, and the endpoint offers no
   way to backdate a record, so the *live* expiry was never seen on the preview. What was proved
   is the judgment, over the wire, on records whose `setAt` the test wrote: `lockpackage` B10
   drives both sides of the boundary one minute apart, plus the survival of the record, the
   `status` shape, the overwrite, the no-age case and the stamp. **The 365-day arithmetic itself
   is asserted, never observed.** The first real expiry in production will be twelve months after
   the first real `set` — and no device on earth carries a `setAt` yet, so **the earliest possible
   real expiry is twelve months from this deploy**, not from any older code.
2. **That the stamp on a legacy record fires in production.** It is measured against the store
   double, and against a real deploy only insofar as no legacy record was reachable to test with:
   the preview device ids were all new.
3. **What Anthropic, ElevenLabs and Brave do with data after it leaves us** — unchanged from
   before, and the consent screen still declines to promise it.

**Needs a device, not a browser:**

4. **The reminder scheduling the corrected sentence describes.** A browser tab has no bridge and
   fires nothing — the screen already says so to the reader in its own line. That "fewer when you
   add more reminders" is true of the *shell's* cap is read off `ezikSchedPayload`'s ascending
   sort and the shell contract, and the cap itself lives in `murabbi-shell`. **The number of
   reminders a real phone actually arms was not measured this round** and would need an install.
5. **The parental code on a real store install.** The preview shares production KV, so the server
   half is real; what a browser cannot show is the code surviving an app *uninstall/reinstall*
   (it does — the record is server-side and keyed by `mrb_device_v1`, which the shell persists)
   versus surviving a *clear-site-data* (it does not reach it — the device id goes with it, which
   is the deliberate escape hatch D12 preserved and `delete.html` describes).
6. **Biometrics.** Out of this round by order; it needs a shell capability that does not exist.

**Left standing, deliberately:** `parent_pin_hash` is still declared `MUST_STAY` on the roster and
is still a dead key — nothing writes it, and the migration path that reads it is untouched. It is
not this round's business to retire it.
