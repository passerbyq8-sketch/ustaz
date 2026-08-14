# Archived religious runtime policy

Status: documentation only; not executable and not imported by runtime code.

The byte-exact archive is the Git tree at commit
`63b865157e4c0981ecf0d9a028008c4272f6e6c3` (`fix/p0-a-output-safety`). Keeping the snapshot in
Git avoids copying a second, drift-prone implementation into this directory. A reviewer can read
any archived file with, for example:

```text
git show 63b865157e4c0981ecf0d9a028008c4272f6e6c3:lib/ledger/engine.js
git show 63b865157e4c0981ecf0d9a028008c4272f6e6c3:lib/ledger/query-ir.js
git show 63b865157e4c0981ecf0d9a028008c4272f6e6c3:api/ask.js
```

That snapshot preserves the retired religious decisions, including:

- deterministic clarification and missing-qualifier follow-ups;
- intent-specific `required_slots` and completeness proofs;
- `FOLLOW_UP` and `SAFE_REJECTION` outcomes;
- source-type, authority, living/dead, attribution, and primary-adapter blockers;
- the former religious refusal messages;
- depth-specific interpretation and source-governance rules for brief, deep, and scholar modes;
- Brave search, public page fetching, and direct external corpus adapters used by the old path.

From the cleanup commit onward, a religious turn returns from `api/ask.js` through
`lib/stored-deen.js` before any of those archived decisions execute. It searches only
`lib/data/fiqh-search.json.gz`, gives the selected stored records to the answer model, and creates
cards only from those records. General questions and the non-religious security/authentication
paths retain their pre-cleanup implementation.

No JavaScript module may import or read `docs/archive/`. The archive is intentionally recoverable
through Git and intentionally unreachable from the deployed module graph.

The former `ledgerseam`, `namepresence`, and `transfermode` religious runtime contracts are part
of that same baseline snapshot. `ledgerseam` was replaced in the active gate roster by
`storeddeen`; the old guard files remain available for historical inspection but are not
executable release gates. The identity and transfer implementation files remain in Git for the
unchanged general path and for forensic comparison, but a religious request returns before them.
