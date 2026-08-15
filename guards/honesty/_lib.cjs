'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const vm = require('vm');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function gitShow(root, revision, rel) {
  return cp.execFileSync('git', ['show', revision + ':' + rel], {
    cwd: root,
    encoding: null,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function functionSource(source, name) {
  const start = source.indexOf('function ' + name);
  if (start < 0) return null;
  const brace = source.indexOf('{', start);
  if (brace < 0) return null;
  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = brace; i < source.length; i++) {
    const char = source[i];
    const next = source[i + 1];
    if (lineComment) {
      if (char === '\n' || char === '\r') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') { blockComment = false; i++; }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '/') { lineComment = true; i++; continue; }
    if (char === '/' && next === '*') { blockComment = true; i++; continue; }
    if (char === "'" || char === '"' || char === '`') { quote = char; continue; }
    if (char === '{') depth++;
    else if (char === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  return null;
}

function loadNamedFunction(source, name) {
  const body = functionSource(source, name);
  if (!body) throw new Error('function-not-found:' + name);
  return vm.runInNewContext('(' + body + ')');
}

function domains(body) {
  if (!body) return [];
  return [...body.matchAll(/['"]([a-z0-9.\-]+\.[a-z]{2,})['"]/gi)].map((match) => match[1]);
}

function readJson(root, rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

module.exports = { domains, functionSource, gitShow, loadNamedFunction, readJson, sha256 };
