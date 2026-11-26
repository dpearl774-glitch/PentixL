/**
 * Builds public/manual.html — the web version of the tutorial — from the
 * content log that tools/make-tutorial-pdf.cjs writes while it lays out the
 * PDF. One source of prose, two outputs, so they cannot drift.
 *
 * The page's shell (hero, tiles, styles, header, footer) lives in
 * tools/manual-template.html, a copy of the page as shipped, with {{TOC}},
 * {{BODY}}, {{CHAPTER_COUNT}} and {{SCREEN_COUNT}} where the generated parts
 * go. tools/manual.js is the shipped script, copied beside the screenshots so
 * the reading-progress bar and theme toggle stay part of the build.
 *
 * Run: node tools/make-tutorial-pdf.cjs && node tools/make-manual-html.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONTENT = path.join(ROOT, 'artifacts', 'manual-content.json');
const TEMPLATE = path.join(ROOT, 'tools', 'manual-template.html');
const SCRIPT = path.join(ROOT, 'tools', 'manual.js');
const SHOTS = path.join(ROOT, 'artifacts', 'tutorial');
const OUT_PAGE = path.join(ROOT, 'public', 'manual.html');
const OUT_SHOTS = path.join(ROOT, 'public', 'manual');

const entries = JSON.parse(fs.readFileSync(CONTENT, 'utf8'));

// The PDF prints "How to use this guide" as a hand-laid-out opening page, so
// older content logs start at Chapter 1. The web manual needs it as a real
// chapter, and the PDF now records it too; this keeps an old log readable.
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
  // A content-only rebuild (no artifacts/tutorial folder) must not clear the
  // screenshots already published beside the manual page.
  if (!wanted.size) return emitted;
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

const kbd = (item) => {
  const keys = Array.isArray(item.keys) ? item.keys : [item.key];
  const sep = item.sep == null ? ' ' : item.sep;
  return keys.map((key) => `<kbd>${esc(key)}</kbd>`).join(sep);
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
  } else if (entry.type === 'quote') {
    body += `<blockquote class="pull">${esc(entry.text)}`;
    if (entry.note) body += `<span>${esc(entry.note)}</span>`;
    body += '</blockquote>\n';
  } else if (entry.type === 'tour') {
    body += '<ol class="tour">\n';
    for (const item of entry.items) {
      body += `  <li><strong>${esc(item.label)}</strong>${esc(item.body)}</li>\n`;
    }
    body += '</ol>\n';
  } else if (entry.type === 'try') {
    body += `<div class="try"><h3>${esc(entry.title)}</h3><p>${esc(entry.body)}</p></div>\n`;
  } else if (entry.type === 'keys') {
    body += '<ul class="keys">\n';
    for (const item of entry.items) {
      body += `  <li>${kbd(item)} ${esc(item.what)}</li>\n`;
    }
    body += '</ul>\n';
  } else if (entry.type === 'refgrid') {
    body += '<table class="refgrid">\n';
    body += '  <thead><tr><th>To do this</th><th>Reach for</th></tr></thead>\n';
    body += '  <tbody>\n';
    for (const [what, reach] of entry.rows) {
      body += `    <tr><td>${esc(what)}</td><td>${esc(reach)}</td></tr>\n`;
    }
    body += '  </tbody>\n</table>\n';
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

const template = fs.readFileSync(TEMPLATE, 'utf8');
for (const token of ['{{TOC}}', '{{BODY}}', '{{CHAPTER_COUNT}}', '{{SCREEN_COUNT}}']) {
  if (!template.includes(token)) throw new Error(`manual template is missing ${token}`);
}

const html = template
  .replace('{{TOC}}', () => toc)
  .replace('{{BODY}}', () => body)
  .replace('{{CHAPTER_COUNT}}', () => String(chapters.length))
  .replace('{{SCREEN_COUNT}}', () => String(wanted.size));

emitShots().then((emitted) => {
  // The page is checked in with CRLF; keep one line-ending style so a rebuild
  // only shows real copy changes.
  fs.writeFileSync(OUT_PAGE, html.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'));
  // A separate file: the deployed CSP allows only same-origin scripts.
  fs.copyFileSync(SCRIPT, path.join(OUT_SHOTS, 'manual.js'));
  const shotsBytes = [...emitted].reduce(
    (sum, name) => sum + fs.statSync(path.join(OUT_SHOTS, name)).size,
    0
  );
  console.log(
    `wrote public/manual.html (${(Buffer.byteLength(html) / 1024).toFixed(0)} kB, ${chapters.length} chapters, ` +
      `${emitted.size} screenshots ${EXT} ${(shotsBytes / 1024).toFixed(0)} kB)`
  );
});
