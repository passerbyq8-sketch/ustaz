// Registers tools/reviewer-capture-hook.mjs. Kept separate because `module.register` must run
// before the modules it wants to intercept are resolved, which is what `--import` guarantees.
import { register } from 'node:module';
register('./reviewer-capture-hook.mjs', import.meta.url);
