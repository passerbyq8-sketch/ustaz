'use strict';

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function captureProcessEnv(keys, env = process.env) {
  return [...new Set(keys)].map((key) => ({
    key,
    had: hasOwn(env, key),
    value: env[key],
  }));
}

function restoreProcessEnv(snapshot, env = process.env) {
  for (const entry of snapshot) {
    if (entry.had) env[entry.key] = entry.value;
    else delete env[entry.key];
  }
}

function processEnvMatches(snapshot, env = process.env) {
  return snapshot.every((entry) => entry.had
    ? hasOwn(env, entry.key) && env[entry.key] === entry.value
    : !hasOwn(env, entry.key));
}

async function withRestoredProcessEnv(keys, work, env = process.env) {
  const snapshot = captureProcessEnv(keys, env);
  try {
    return await work();
  } finally {
    restoreProcessEnv(snapshot, env);
    if (!processEnvMatches(snapshot, env)) {
      throw new Error('guard failed to restore process.env');
    }
  }
}

module.exports = {
  captureProcessEnv,
  restoreProcessEnv,
  processEnvMatches,
  withRestoredProcessEnv,
};
