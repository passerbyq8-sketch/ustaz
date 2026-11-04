import assert from 'node:assert/strict';
export class MemoryIapStore {
  values = new Map();
  ledger = [];

  async get(key) { return this.values.has(key) ? this.values.get(key) : null; }

  async eval(script, keys, args) {
    const [balanceKey, transactionKey, ledgerKey, markerKey] = keys;
    if (script.includes("event='trial_started'")) {
      const balance = this.values.has(balanceKey) ? JSON.parse(this.values.get(balanceKey)) : {};
      if (Number(balance.trialStartedAt) > 0) {
        return JSON.stringify({ ok: true, created: false, startedAt: Number(balance.trialStartedAt) });
      }
      const now = Number(args[0]);
      balance.trialStartedAt = now;
      this.values.set(balanceKey, JSON.stringify(balance));
      this.ledger.push({ id: 'trial-start:' + args[1], account: args[1], event: 'trial_started', time: now, creditsDelta: 0 });
      this.values.set(keys[1], JSON.stringify(this.ledger));
      return JSON.stringify({ ok: true, created: true, startedAt: now });
    }
    if (script.includes("event='test_adjust'")) {
      const balance = this.values.has(balanceKey) ? JSON.parse(this.values.get(balanceKey)) : {};
      const creditsBefore = Number(balance.credits) || 0;
      if (args[0] !== '') balance.credits = Number(args[0]);
      if (args[1] === 'clear') balance.trialStartedAt = null;
      else if (args[1] !== '') balance.trialStartedAt = Number(args[1]);
      if (args[5] === 'clear') balance.subscriptionExpiresAt = null;
      this.values.set(balanceKey, JSON.stringify(balance));
      this.ledger.push({ id: args[4], account: args[3], event: 'test_adjust', time: Number(args[2]), creditsDelta: (Number(balance.credits) || 0) - creditsBefore, trialStartedAt: balance.trialStartedAt ?? null, clearPass: args[5] === 'clear', subscriptionExpiresAt: balance.subscriptionExpiresAt ?? null });
      this.values.set(keys[1], JSON.stringify(this.ledger));
      return JSON.stringify({ ok: true });
    }
    if (script.includes("local prior = redis.call('GET', KEYS[2])")) {
      const prior = this.values.get(transactionKey);
      if (prior) {
        const old = JSON.parse(prior);
        return old.gameId && old.gameId !== args[1] ? JSON.stringify({ ok: false, code: 'iap-session-conflict' }) : prior;
      }
      const balance = this.values.has(balanceKey) ? JSON.parse(this.values.get(balanceKey)) : {};
      const now = Number(args[0]), started = Number(balance.trialStartedAt) || 0;
      const endsAt = started + Number(args[3]) * 86400000;
      let mode = '';
      if (started > 0 && now >= started && now <= endsAt + 1800000) mode = 'trial';
      else if ((Number(balance.subscriptionExpiresAt) || 0) > now) mode = 'subscription';
      else if ((Number(balance.credits) || 0) > 0) { mode = 'credit'; balance.credits -= 1; }
      else return JSON.stringify({ ok: false, code: 'iap-no-credit' });
      const result = { ok: true, mode, gameId: args[1], balance: { credits: Number(balance.credits) || 0, subscriptionExpiresAt: balance.subscriptionExpiresAt || null, freeUsedByGame: balance.freeUsedByGame || {} } };
      this.values.set(balanceKey, JSON.stringify(balance));
      this.values.set(transactionKey, JSON.stringify(result));
      return JSON.stringify(result);
    }
    assert.match(script, /local marker = redis\.call\('GET', KEYS\[4\]\)/);
    if (this.values.has(markerKey)) return 'DUPLICATE';
    const currentTransaction = this.values.get(transactionKey) || '';
    if (currentTransaction !== args[0]) return 'RETRY';
    const balance = this.values.has(balanceKey) ? JSON.parse(this.values.get(balanceKey)) : {};
    const credits = Number(balance.credits) || 0;
    const expiry = Number(balance.subscriptionExpiresAt) || 0;
    if (credits !== Number(args[1]) || expiry !== Number(args[2])) return 'RETRY';
    const gameIds = JSON.parse(args[3]);
    const usage = balance.freeUsedByGame || {};
    for (let i = 0; i < gameIds.length; i += 1) {
      const used = Number(usage[gameIds[i]]) || 0;
      if (used !== Number(args[5 + i])) return 'RETRY';
    }
    this.values.set(balanceKey, args[5 + gameIds.length]);
    this.values.set(transactionKey, args[6 + gameIds.length]);
    this.values.set(markerKey, '1');
    this.ledger.push(JSON.parse(args[7 + gameIds.length]));
    this.values.set(ledgerKey, JSON.stringify(this.ledger));
    return 'APPLIED';
  }
}
