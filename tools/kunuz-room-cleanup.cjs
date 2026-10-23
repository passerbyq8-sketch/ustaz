'use strict';

// Cleanup can finish after navigation to the hub, which has no War globals.
async function waitForRoomExit(page, timeout = 30000) {
  await page.waitForFunction(() => window.KunuzJourney?.state.ready && !globalThis.RM?.on, null, { timeout });
}

async function waitForWarRoom(page, timeout = 30000) {
  await page.waitForFunction(() => window.KunuzJourney?.state.ready && globalThis.RM?.on && globalThis.RM?.ws?.readyState === 1 && globalThis.RM?.snap, null, { timeout });
}

async function ensureWarRoom(page, { base = 'https://ezik.app', session } = {}) {
  const active = () => page.evaluate(() => !!(globalThis.RM?.on && globalThis.RM?.ws?.readyState === 1 && globalThis.RM?.snap));
  if (await active()) return;
  if (new URL(page.url()).pathname !== '/quest-harb.html') await page.goto(base + '/quest-harb.html');
  await page.waitForFunction(() => window.KunuzJourney?.state.ready && !document.documentElement.classList.contains('kunuz-theme-pending'));
  if (session) {
    await page.evaluate(value => {
      localStorage.setItem('kz_harb_room_v1', JSON.stringify(value));
      if (value.deviceId) localStorage.setItem('kz_harb_dev_v1', value.deviceId);
    }, session);
    // Refresh the entry's saved-room control, then use its normal resume action.
    await page.reload();
    await page.waitForFunction(() => window.KunuzJourney?.state.ready && !document.documentElement.classList.contains('kunuz-theme-pending'));
  }
  if (!await active()) await page.locator('[data-action="resume-room"]').click();
  await waitForWarRoom(page);
}

module.exports = { ensureWarRoom, waitForWarRoom, waitForRoomExit };
