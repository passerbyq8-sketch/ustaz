(function () {
  'use strict';
  var link = document.querySelector('.iap-purchase');
  if (!link) return;

  var attempts = 0, timer;
  function checkFallback() {
    var status = window.KunuzThemeBoot?.status;
    if (status === 'mounted') return true;
    if (status !== 'fallback') return false;
    if (timer) window.clearInterval(timer);
    if (typeof window.ezikIapEnterHome !== 'function') return true;

    var requested = new URLSearchParams(location.search).get('iap_purchase') === '1', opened = false;
    window.ezikIapEnterHome(function (_notice, applicable) {
      link.hidden = applicable !== true;
      if (applicable === true && requested && !opened) {
        opened = true;
        window.ezikIapOpenPurchase?.();
      }
    }).catch(function () { link.hidden = true; });
    return true;
  }

  if (!checkFallback()) {
    timer = window.setInterval(function () {
      attempts += 1;
      if (checkFallback() || attempts >= 60) window.clearInterval(timer);
    }, 100);
  }
})();
