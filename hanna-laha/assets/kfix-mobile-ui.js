(function () {
  var root = document.documentElement;
  function sync() {
    var viewport = window.visualViewport;
    var active = document.activeElement;
    var editable = active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName);
    var open = !!(editable && viewport && window.innerHeight - viewport.height > 80);
    root.classList.toggle('kfix-keyboard-open', open);
    if (!open) { root.style.removeProperty('--kfix-visual-height'); return; }
    root.style.setProperty('--kfix-visual-height', Math.max(200, viewport.height) + 'px');
    if (active.closest('.journey-app')) return;
    var region = active.closest('form,main,[role=main]') || document.getElementById('root') || document.body;
    window.requestAnimationFrame(function () {
      var top = viewport.offsetTop + 8, bottom = viewport.offsetTop + viewport.height - 14;
      var field = active.getBoundingClientRect();
      if (field.top < top || field.bottom > bottom) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }
  document.addEventListener('focusin', function () { window.setTimeout(sync, 60); }, true);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', sync);
    window.visualViewport.addEventListener('scroll', sync);
  }
  window.addEventListener('orientationchange', sync);
})();
