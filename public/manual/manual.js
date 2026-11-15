// Follows the app's theme choice, falling back to the system, and remembers
// nothing — the toggle is a per-visit override.
// Follow the app's theme choice, then the system, and let the reader override.
  (function () {
    var root = document.documentElement;
    var KEY = 'pentix.theme';
    var stored = null;
    try { stored = localStorage.getItem(KEY); } catch (e) {}
    var systemLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    var mode = stored === 'light' || stored === 'dark' ? stored : (stored === 'system' ? (systemLight ? 'light' : 'dark') : (systemLight ? 'light' : 'dark'));
    var apply = function (value) {
      root.dataset.theme = value;
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', value === 'light' ? '#eef0f3' : '#08090b');
    };
    apply(mode);
    // Contents open on a wide screen (as a sidebar) and folded on a phone, so
    // the manual itself is what the reader lands on.
    var toc = document.querySelector('details.toc');
    if (toc) {
      var wide = window.matchMedia('(min-width: 861px)');
      var syncToc = function () {
        if (wide.matches) toc.setAttribute('open', '');
        else toc.removeAttribute('open');
      };
      syncToc();
      // A tablet turned on its side gains the sidebar instead of a stray fold.
      if (wide.addEventListener) wide.addEventListener('change', syncToc);
    }

    var button = document.getElementById('theme');
    if (button) button.addEventListener('click', function () {
      apply(root.dataset.theme === 'light' ? 'dark' : 'light');
    });
  })();
