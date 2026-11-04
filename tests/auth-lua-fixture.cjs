'use strict';
// Executes the deliberately small Lua subset used by auth CAS/consume. Conditions,
// reads and writes come from the actual script: removing a comparison or DEL changes
// behavior. There is no dispatch that assumes a script's intended operation succeeded.
const vm = require('node:vm');
function runAuthLua(script, keys, args, store) {
  const expression = s => s.replace(/#KEYS/g, 'KEYS.length')
    .replace(/~=/g, '!==').replace(/==/g, '==').replace(/\bnil\b/g, 'null')
    .replace(/\bor\b/g, '||').replace(/\band\b/g, '&&').replace(/\bnot\s+/g, '!');
  const lines = [];
  for (const raw of String(script).split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('--')) continue;
    let m;
    if ((m = /^local (\w+) = (.+)$/.exec(line))) lines.push('let ' + m[1] + ' = ' + expression(m[2]) + ';');
    else if ((m = /^for (\w+) = (.+), (.+) do$/.exec(line))) lines.push(`for (let ${m[1]} = ${expression(m[2])}; ${m[1]} <= ${expression(m[3])}; ${m[1]}++) {`);
    else if ((m = /^if (.+) then (.+) end$/.exec(line))) lines.push('if (' + expression(m[1]) + ') { ' + expression(m[2]) + '; }');
    else if ((m = /^if (.+) then$/.exec(line))) lines.push('if (' + expression(m[1]) + ') {');
    else if ((m = /^elseif (.+) then$/.exec(line))) lines.push('} else if (' + expression(m[1]) + ') {');
    else if (line === 'else') lines.push('} else {');
    else if (line === 'end') lines.push('}');
    else if (/^(return |redis\.call\()/.test(line)) lines.push(expression(line) + ';');
    else throw Error('unsupported auth Lua statement');
  }
  const oneBased = values => new Proxy(values, { get(target, prop) { return /^\d+$/.test(String(prop)) ? target[Number(prop) - 1] : target[prop]; } });
  const redis = { call(command, key, value, ex, ttl) {
    if (command === 'GET') return store.get(key);
    if (command === 'DEL') return store.del(key);
    if (command === 'SET') return store.set(key, value, ex === 'EX' ? Number(ttl) : 0);
    throw Error('unsupported auth Redis command');
  } };
  return vm.runInNewContext('(function(){\n' + lines.join('\n') + '\n})()',
    { KEYS: oneBased(keys), ARGV: oneBased(args), redis, tonumber: Number }, { timeout: 1000 });
}
module.exports = { runAuthLua };
