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

    // A hairline of progress so a long chapter never feels like no progress.
    var bar = document.getElementById('progress');
    if (bar) {
      var paint = function () {
        var doc = document.documentElement;
        var travel = (doc.scrollHeight || 0) - window.innerHeight;
        var done = travel > 0 ? (window.scrollY || doc.scrollTop || 0) / travel : 0;
        bar.style.width = Math.max(0, Math.min(1, done)) * 100 + '%';
      };
      paint();
      window.addEventListener('scroll', paint, { passive: true });
      window.addEventListener('resize', paint);
    }

    // The cover links land mid-page; keep the chapter heading clear of the bar.
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
      link.addEventListener('click', function () {
        var target = document.querySelector(link.getAttribute('href'));
        if (target) setTimeout(function () { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 0);
      });
    });

    var button = document.getElementById('theme');
    if (button) button.addEventListener('click', function () {
      apply(root.dataset.theme === 'light' ? 'dark' : 'light');
    });
  })();
