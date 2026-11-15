/**
 * Builds public/manual.html — the web version of the tutorial — from the
 * content log that tools/make-tutorial-pdf.cjs writes while it lays out the
 * PDF. One source of prose, two outputs, so they cannot drift.
 *
 * Run: node tools/make-tutorial-pdf.cjs && node tools/make-manual-html.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONTENT = path.join(ROOT, 'artifacts', 'manual-content.json');
const SHOTS = path.join(ROOT, 'artifacts', 'tutorial');
const OUT_PAGE = path.join(ROOT, 'public', 'manual.html');
const OUT_SHOTS = path.join(ROOT, 'public', 'manual');

const entries = JSON.parse(fs.readFileSync(CONTENT, 'utf8'));

// The PDF prints "How to use this guide" as a hand-laid-out opening page, so it
// is not in the content log. The web manual needs it as a real chapter.
if (entries[0] && entries[0].type !== 'chapter') {
  entries.unshift({ type: 'chapter', title: 'How to use this guide', kicker: 'Before you start' });
}

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const slug = (title) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// --- images ship next to the page so the whole manual is one cached folder.
// The captures are 2x, so they keep their own width and are stored as WebP:
// the set drops from ~2 MB to a few hundred kB with nothing visible lost.
// Without sharp (an optional dev dependency) the PNGs are copied untouched.
fs.mkdirSync(OUT_SHOTS, { recursive: true });

let sharpish = null;
try {
  sharpish = require('sharp');
} catch {
  console.warn('sharp not installed — copying full-size PNGs instead');
}

const EXT = sharpish ? '.webp' : '.png';
const assetName = (file) => file.replace(/\.png$/i, EXT);
const wanted = new Set();
const useShot = (file) => {
  if (!file) return;
  if (!fs.existsSync(path.join(SHOTS, file))) {
    console.warn('missing screenshot', file);
    return;
  }
  wanted.add(file);
};

/** Writes only what changed, and clears anything an earlier run left behind. */
const emitShots = async () => {
  const emitted = new Set();
  for (const file of wanted) {
    const from = path.join(SHOTS, file);
    const name = assetName(file);
    const to = path.join(OUT_SHOTS, name);
    emitted.add(name);
    if (fs.existsSync(to) && fs.statSync(to).mtimeMs >= fs.statSync(from).mtimeMs) continue;
    if (sharpish) await sharpish(from).webp({ quality: 82, effort: 5 }).toFile(to);
    else fs.copyFileSync(from, to);
  }
  for (const existing of fs.readdirSync(OUT_SHOTS)) {
    if (existing === 'manual.js' || emitted.has(existing)) continue;
    fs.unlinkSync(path.join(OUT_SHOTS, existing));
  }
  return emitted;
};

// --- body
const chapters = [];
let body = '';
let open = false;

const closeChapter = () => {
  if (open) body += '</section>\n';
  open = false;
};

for (const entry of entries) {
  if (entry.type === 'chapter') {
    closeChapter();
    const id = slug(entry.title);
    chapters.push({ id, title: entry.title, kicker: entry.kicker });
    body += `<section class="chapter" id="${id}">\n`;
    if (entry.kicker) body += `<p class="kicker">${esc(entry.kicker)}</p>\n`;
    body += `<h1>${esc(entry.title)}</h1>\n`;
    open = true;
    continue;
  }
  if (entry.type === 'h2') {
    body += `<h2>${esc(entry.title)}</h2>\n`;
  } else if (entry.type === 'p') {
    body += `<p>${esc(entry.text)}</p>\n`;
  } else if (entry.type === 'ul') {
    body += '<ul>\n';
    for (const item of entry.items) {
      body += item.label
        ? `<li><strong>${esc(item.label)}</strong> ${esc(item.body)}</li>\n`
        : `<li>${esc(item.body)}</li>\n`;
    }
    body += '</ul>\n';
  } else if (entry.type === 'callout') {
    body += `<aside class="callout"><h3>${esc(entry.title)}</h3><p>${esc(entry.body)}</p></aside>\n`;
  } else if (entry.type === 'img') {
    useShot(entry.file);
    body +=
      `<figure><img src="manual/${esc(assetName(entry.file))}" alt="${esc(entry.caption || '')}" loading="lazy" />` +
      (entry.caption ? `<figcaption>${esc(entry.caption)}</figcaption>` : '') +
      '</figure>\n';
  } else if (entry.type === 'pair') {
    useShot(entry.a);
    useShot(entry.b);
    body +=
      `<figure class="pair"><div><img src="manual/${esc(assetName(entry.a))}" alt="" loading="lazy" /></div>` +
      `<div><img src="manual/${esc(assetName(entry.b))}" alt="" loading="lazy" /></div>` +
      (entry.caption ? `<figcaption>${esc(entry.caption)}</figcaption>` : '') +
      '</figure>\n';
  }
}
closeChapter();

const toc = chapters
  .map(
    (c, i) =>
      `<li><a href="#${c.id}"><span class="num">${String(i + 1).padStart(2, '0')}</span>${esc(c.title)}</a></li>`
  )
  .join('\n');

const html = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Pentix — Manual</title>
<meta name="description" content="The Pentix manual: drawing, nodes, shapes, patterns, export and everything else." />
<meta name="theme-color" content="#08090b" />
<style>
  :root {
    --ink-0: #08090b;
    --ink-1: #0c0e11;
    --ink-2: #12151a;
    --ink-3: #191d23;
    --line: #24282f;
    --text: #eceef1;
    --dim: #b3b9c2;
    --mute: #7d848e;
    --accent: #4c8dff;
    --panel: #101318;
  }
  :root[data-theme='light'] {
    --ink-0: #eef0f3;
    --ink-1: #f6f7f9;
    --ink-2: #ffffff;
    --ink-3: #e6e9ee;
    --line: #d7dbe2;
    --text: #14171c;
    --dim: #3f4750;
    --mute: #6d7681;
    --accent: #2f6fdb;
    --panel: #f4f6f9;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--ink-0); color: var(--text); }
  body {
    font: 16px/1.65 system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    -webkit-text-size-adjust: 100%;
  }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  header.top {
    position: sticky; top: 0; z-index: 10;
    display: flex; align-items: center; gap: 12px;
    padding: 12px 20px;
    background: color-mix(in srgb, var(--ink-0) 88%, transparent);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--line);
  }
  .brand { font-weight: 800; letter-spacing: -0.01em; white-space: nowrap; }
  .brand span { color: var(--mute); font-weight: 600; }
  header.top .spacer { flex: 1; }
  header.top a.btn, header.top button.btn {
    font-size: 13px; font-weight: 700; padding: 7px 12px; border-radius: 8px;
    border: 1px solid var(--line); color: var(--text); background: var(--ink-2);
    white-space: nowrap; cursor: pointer; font-family: inherit;
  }
  header.top a.btn.primary { background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--accent); border-color: transparent; }
  .wrap { display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: 40px; max-width: 1080px; margin: 0 auto; padding: 28px 20px 96px; }
  details.toc { position: sticky; top: 64px; align-self: start; max-height: calc(100vh - 96px); overflow: auto; }
  details.toc > summary {
    list-style: none; cursor: pointer; display: flex; align-items: center; gap: 8px;
    font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--mute);
    margin: 0 0 8px; padding: 2px 0;
  }
  details.toc > summary::-webkit-details-marker { display: none; }
  details.toc > summary::after { content: '▾'; font-size: 10px; }
  details.toc[open] > summary::after { content: '▴'; }
  nav.toc { }
  nav.toc h2 { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--mute); margin: 0 0 10px; }
  nav.toc ol { list-style: none; margin: 0; padding: 0; }
  nav.toc li a { display: flex; gap: 10px; padding: 6px 8px; border-radius: 7px; color: var(--dim); font-size: 13.5px; }
  nav.toc li a:hover { background: var(--ink-3); text-decoration: none; color: var(--text); }
  nav.toc .num { color: var(--mute); font-variant-numeric: tabular-nums; font-size: 12px; padding-top: 1px; }
  main { min-width: 0; }
  .lead { color: var(--mute); font-size: 15px; margin: -4px 0 26px; }
  section.chapter { padding-top: 8px; margin-bottom: 48px; scroll-margin-top: 80px; }
  .kicker { margin: 0 0 6px; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--accent); font-weight: 700; }
  h1 { font-size: clamp(24px, 4vw, 32px); line-height: 1.2; letter-spacing: -0.02em; margin: 0 0 18px; }
  h2 { font-size: 17px; margin: 30px 0 8px; letter-spacing: -0.01em; }
  p { margin: 0 0 12px; color: var(--dim); }
  ul { margin: 0 0 16px; padding-left: 20px; color: var(--dim); }
  li { margin-bottom: 7px; }
  li strong { color: var(--text); }
  aside.callout { margin: 20px 0; padding: 14px 16px; background: var(--panel); border-left: 3px solid var(--accent); border-radius: 8px; }
  aside.callout h3 { margin: 0 0 6px; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--accent); }
  aside.callout p { margin: 0; font-size: 14.5px; }
  figure { margin: 20px 0 24px; }
  figure img { display: block; width: 100%; max-width: 420px; height: auto; margin: 0 auto; border: 1px solid var(--line); border-radius: 10px; background: var(--ink-2); }
  figure.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  figure.pair > div { min-width: 0; }
  figure.pair img { max-width: none; }
  figcaption { margin-top: 8px; font-size: 12.5px; color: var(--mute); text-align: center; grid-column: 1 / -1; }
  footer.bottom { border-top: 1px solid var(--line); padding: 20px; text-align: center; color: var(--mute); font-size: 13px; }
  @media (max-width: 860px) {
    .wrap { grid-template-columns: 1fr; gap: 0; padding-top: 16px; }
    details.toc { position: static; max-height: none; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--line); }
    nav.toc ol { columns: 2; column-gap: 16px; }
  }
  @media (max-width: 520px) {
    nav.toc ol { columns: 1; }
    header.top { padding: 10px 14px; gap: 8px; }
    header.top a.btn, header.top button.btn { font-size: 12px; padding: 6px 10px; }
    .brand span.suffix { display: none; }
    .wrap { padding: 14px 16px 72px; }
  }
</style>
</head>
<body>
<header class="top">
  <span class="brand">Pentix <span class="suffix">· manual</span></span>
  <span class="spacer"></span>
  <button class="btn" id="theme" type="button" aria-label="Switch between light and dark">Theme</button>
  <a class="btn" href="pentix-tutorial.pdf" download>PDF</a>
  <a class="btn primary" href="./">Open Pentix</a>
</header>

<div class="wrap">
  <details class="toc" open>
    <summary>Contents</summary>
    <nav aria-label="Contents">
      <ol>
${toc}
      </ol>
    </nav>
  </details>
  <main>
    <p class="lead">Everything Pentix does, in order. This page and its images are stored on your device the first time you read it, so it opens without a connection.</p>
${body}
  </main>
</div>

<footer class="bottom">Pentix — a local-first vector logo studio. Your work never leaves the device.</footer>

<script src="manual/manual.js" defer></script>
</body>
</html>
`;

emitShots().then((emitted) => {
fs.writeFileSync(OUT_PAGE, html);
// A separate file: the deployed CSP allows only same-origin scripts.
fs.writeFileSync(
  path.join(OUT_SHOTS, 'manual.js'),
  `// Follows the app's theme choice, falling back to the system, and remembers
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
`
);
const shotsBytes = [...emitted].reduce(
  (sum, name) => sum + fs.statSync(path.join(OUT_SHOTS, name)).size,
  0
);
console.log(
  `wrote public/manual.html (${(Buffer.byteLength(html) / 1024).toFixed(0)} kB, ${chapters.length} chapters, ` +
    `${emitted.size} screenshots ${EXT} ${(shotsBytes / 1024).toFixed(0)} kB)`
);
});
