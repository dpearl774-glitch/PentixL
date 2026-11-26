/**
 * Builds artifacts/Pentix-Tutorial.pdf and public/pentix-tutorial.pdf.
 *
 * The document is laid out twice: the first pass records which page each
 * chapter starts on, the second prints those numbers in the table of contents.
 * Screenshots come from artifacts/tutorial (see the README note in the commit).
 *
 * Run: node tools/make-tutorial-pdf.cjs
 * Needs pdfkit: npm install --no-save pdfkit
 */
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(ROOT, 'artifacts', 'tutorial');
const OUTS = [path.join(ROOT, 'artifacts', 'Pentix-Tutorial.pdf'), path.join(ROOT, 'public', 'pentix-tutorial.pdf')];

const INK = '#14171c';
const MUTED = '#5c636d';
const ACCENT = '#2f6fdb';
const RULE = '#dde1e7';
const PANEL = '#f4f6f9';
const HERO = '#0e1116';
const M = 54;
const BOTTOM = 56;

let CHAPTERS = [];

/**
 * Helvetica only covers WinAnsi, so a command glyph came out as punctuation
 * soup. Spell the keys the way the on-screen sheet does and use a guillemet
 * for menu paths, all of which the font can actually print.
 */
const pdfSafe = (value) =>
  String(value)
    .replace(/⌘-/g, 'Cmd-')
    .replace(/⌘/g, 'Cmd ')
    .replace(/⇧/g, 'Shift ')
    .replace(/⌃/g, 'Ctrl ')
    .replace(/⌥/g, 'Alt ')
    .replace(/⌫/g, 'Delete')
    .replace(/↑/g, 'Up')
    .replace(/→/g, '›')
    .replace(/⋯/g, '…');

async function build(toc) {
  if (!toc) CHAPTERS = [];
  const doc = new PDFDocument({ size: 'A4', margins: { top: M, bottom: BOTTOM, left: M, right: M }, bufferPages: true });
  const drawText = doc.text.bind(doc);
  doc.text = (str, ...rest) => drawText(typeof str === 'string' ? pdfSafe(str) : str, ...rest);
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));

  const W = doc.page.width - M * 2;
  /** Structured copy of everything the document says, for the web manual. */
  const rec = [];
  const PAGE_BOTTOM = doc.page.height - BOTTOM;
  let y = M;
  let chapter = '';
  const pageChapters = ['Pentix tutorial'];
  const starts = {};

  const addPage = () => { doc.addPage(); pageChapters.push(chapter || 'Pentix tutorial'); y = M; };
  const need = (h) => { if (y + h > PAGE_BOTTOM) addPage(); };

  const text = (str, { size = 10.5, font = 'Helvetica', color = INK, gap = 9, x = M, width = W, lineGap = 3.2, align = 'left' } = {}) => {
    doc.font(font).fontSize(size);
    const h = doc.heightOfString(str, { width, lineGap, align });
    need(h);
    doc.fillColor(color).text(str, x, y, { width, lineGap, align });
    y += h + gap;
  };

  const h1 = (title, kicker) => {
    rec.push({ type: 'chapter', title, kicker: kicker || null });
    chapter = title;
    if (y > M + 8) addPage();
    starts[title] = pageChapters.length;
    CHAPTERS.push({ title, number: CHAPTERS.length + 1 });
    if (kicker) {
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(ACCENT).text(kicker.toUpperCase(), M, y, { characterSpacing: 1.1 });
      y += 14;
    }
    doc.font('Helvetica-Bold').fontSize(23).fillColor(INK);
    const th = doc.heightOfString(title, { width: W });
    doc.text(title, M, y, { width: W });
    y += th + 9;
    doc.moveTo(M, y).lineTo(M + 46, y).lineWidth(2.5).strokeColor(ACCENT).stroke();
    y += 15;
  };

  const h2 = (title) => {
    rec.push({ type: 'h2', title });
    need(70);
    y += 6;
    text(title, { size: 12.5, font: 'Helvetica-Bold', gap: 6 });
  };

  const p = (str) => {
    rec.push({ type: 'p', text: str });
    text(str);
  };

  const bullets = (items) => {
    rec.push({
      type: 'ul',
      items: items.map((item) =>
        typeof item === 'string' ? { body: item } : { label: item.label || null, body: item.body }
      ),
    });
    for (const item of items) {
      const label = typeof item === 'string' ? null : item.label;
      const body = typeof item === 'string' ? item : item.body;
      if (label) {
        doc.font('Helvetica-Bold').fontSize(10);
        const lh = doc.heightOfString(label, { width: W - 16 });
        doc.font('Helvetica').fontSize(10.2);
        const bh = doc.heightOfString(body, { width: W - 26, lineGap: 3 });
        need(lh + bh + 8);
        doc.circle(M + 3, y + 5, 2).fillColor(ACCENT).fill();
        doc.fillColor(INK).font('Helvetica-Bold').fontSize(10).text(label, M + 16, y, { width: W - 16 });
        y += lh + 1;
        doc.fillColor(INK).font('Helvetica').fontSize(10.2).text(body, M + 16, y, { width: W - 26, lineGap: 3 });
        y += bh + 9;
      } else {
        doc.font('Helvetica').fontSize(10.2);
        const bh = doc.heightOfString(body, { width: W - 26, lineGap: 3 });
        need(bh + 10);
        doc.circle(M + 3, y + 5, 2).fillColor(ACCENT).fill();
        doc.fillColor(INK).text(body, M + 16, y, { width: W - 26, lineGap: 3 });
        y += bh + 9;
      }
    }
    y += 3;
  };

  const callout = (body, title = 'Good to know') => {
    rec.push({ type: 'callout', title, body });
    const inner = 12;
    doc.font('Helvetica-Bold').fontSize(8.5);
    const th = doc.heightOfString(title.toUpperCase(), { characterSpacing: 0.8 });
    doc.font('Helvetica').fontSize(9.5);
    const bh = doc.heightOfString(body, { width: W - inner * 2, lineGap: 3 });
    const h = th + bh + 22;
    need(h + 12);
    doc.rect(M, y, W, h).fill(PANEL);
    doc.rect(M, y, 3, h).fill(ACCENT);
    doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(8.5).text(title.toUpperCase(), M + inner, y + 9, { characterSpacing: 0.8 });
    doc.fillColor(INK).font('Helvetica').fontSize(9.5).text(body, M + inner, y + 11 + th, { width: W - inner * 2, lineGap: 3 });
    y += h + 14;
  };

  const image = (file, caption, maxWidth = 262) => {
    rec.push({ type: 'img', file, caption: caption || null });
    const full = path.join(SHOTS, file);
    if (!fs.existsSync(full)) { console.warn('missing screenshot', file); return; }
    const probe = doc.openImage(full);
    let w = Math.min(maxWidth, W);
    let h = (probe.height / probe.width) * w;
    const limit = (PAGE_BOTTOM - M) * 0.72;
    if (h > limit) { h = limit; w = (probe.width / probe.height) * h; }
    doc.font('Helvetica').fontSize(8.5);
    const capH = caption ? doc.heightOfString(caption, { width: W, align: 'center' }) + 10 : 0;
    need(h + capH + 18);
    const x = M + (W - w) / 2;
    doc.rect(x - 6, y - 6, w + 12, h + 12).lineWidth(0.6).strokeColor(RULE).stroke();
    doc.image(full, x, y, { width: w, height: h });
    y += h + 10;
    if (caption) { doc.fillColor(MUTED).font('Helvetica').fontSize(8.5).text(caption, M, y, { width: W, align: 'center' }); y += capH; }
    y += 6;
  };

  const pair = (a, b, caption) => {
    rec.push({ type: 'pair', a, b, caption: caption || null });
    const aPath = path.join(SHOTS, a);
    const bPath = path.join(SHOTS, b);
    if (!fs.existsSync(aPath) || !fs.existsSync(bPath)) {
      console.warn('missing screenshot pair', a, b);
      return;
    }
    const gap = 14;
    const w = (W - gap) / 2;
    const pa = doc.openImage(aPath);
    const pb = doc.openImage(bPath);
    const h = Math.max((pa.height / pa.width) * w, (pb.height / pb.width) * w);
    const capH = caption ? doc.heightOfString(caption, { width: W, align: 'center' }) + 10 : 0;
    need(h + capH + 18);
    doc.rect(M - 5, y - 5, w + 10, h + 10).lineWidth(0.6).strokeColor(RULE).stroke();
    doc.image(aPath, M, y, { width: w });
    doc.rect(M + w + gap - 5, y - 5, w + 10, h + 10).lineWidth(0.6).strokeColor(RULE).stroke();
    doc.image(bPath, M + w + gap, y, { width: w });
    y += h + 10;
    if (caption) { doc.fillColor(MUTED).font('Helvetica').fontSize(8.5).text(caption, M, y, { width: W, align: 'center' }); y += capH; }
    y += 6;
  };

  /** A pull quote. The web manual sets these as large type, so the PDF does too. */
  const quote = (body, note) => {
    rec.push({ type: 'quote', text: body, note: note || null });
    doc.font('Helvetica-BoldOblique').fontSize(15);
    const bh = doc.heightOfString(body, { width: W - 24, lineGap: 3 });
    doc.font('Helvetica').fontSize(9.5);
    const nh = note ? doc.heightOfString(note, { width: W - 24, lineGap: 3 }) + 4 : 0;
    const h = bh + nh + 10;
    need(h + 10);
    doc.rect(M, y, 2.5, h).fill(ACCENT);
    doc.fillColor(INK).font('Helvetica-BoldOblique').fontSize(15).text(body, M + 16, y, { width: W - 24, lineGap: 3 });
    if (note) {
      doc.fillColor(MUTED).font('Helvetica').fontSize(9.5).text(note, M + 16, y + bh + 4, { width: W - 24, lineGap: 3 });
    }
    y += h + 12;
  };

  /** The four-move tour, numbered in the margin. */
  const tour = (items) => {
    rec.push({ type: 'tour', items });
    for (const [index, item] of items.entries()) {
      doc.font('Helvetica-Bold').fontSize(10.2);
      const lh = doc.heightOfString(item.label, { width: W - 30 });
      doc.font('Helvetica').fontSize(9.6);
      const bh = doc.heightOfString(item.body, { width: W - 30, lineGap: 2.5 });
      need(lh + bh + 8);
      doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(8.6).text(String(index + 1).padStart(2, '0'), M + 2, y + 1, { lineBreak: false });
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(10.2).text(item.label, M + 26, y, { width: W - 30 });
      doc.fillColor(MUTED).font('Helvetica').fontSize(9.6).text(item.body, M + 26, y + lh + 1, { width: W - 30, lineGap: 2.5 });
      y += lh + bh + 7;
    }
    y += 4;
  };

  /** A dashed try-it box. */
  const tryBox = (title, body) => {
    rec.push({ type: 'try', title, body });
    doc.font('Helvetica-Bold').fontSize(8.4);
    const th = doc.heightOfString(title.toUpperCase(), { characterSpacing: 0.7 });
    doc.font('Helvetica').fontSize(9.4);
    const bh = doc.heightOfString(body, { width: W - 34, lineGap: 3 });
    const h = th + bh + 20;
    need(h + 10);
    doc.save();
    doc.rect(M, y, W, h).lineWidth(0.8).dash(3, { space: 3 }).strokeColor(ACCENT).stroke();
    doc.restore();
    doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(8.4).text(title.toUpperCase(), M + 14, y + 8, { characterSpacing: 0.7 });
    doc.fillColor(INK).font('Helvetica').fontSize(9.4).text(body, M + 14, y + 9 + th, { width: W - 34, lineGap: 3 });
    y += h + 12;
  };

  /** Shortcut grid; every key is its own box in the web manual. */
  const keysGrid = (items) => {
    rec.push({ type: 'keys', items });
    const colW = W / 2;
    const rowH = 17;
    need(Math.ceil(items.length / 2) * rowH + 8);
    items.forEach((item, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = M + col * colW;
      const lineY = y + row * rowH;
      const label = (Array.isArray(item.keys) ? item.keys : [item.key]).join(item.sep || ' ');
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(8.6).text(label, x, lineY, { width: 76, lineBreak: false });
      doc.fillColor(MUTED).font('Helvetica').fontSize(8.6).text(item.what, x + 80, lineY, { width: colW - 84, lineBreak: false });
    });
    y += Math.ceil(items.length / 2) * rowH + 8;
  };

  /** The reference card's two-column table. */
  const refGrid = (rows) => {
    rec.push({ type: 'refgrid', rows });
    for (const [what, reach] of rows) {
      doc.font('Helvetica-Bold').fontSize(9.5);
      const wh = doc.heightOfString(what, { width: 118, lineGap: 2.5 });
      doc.font('Helvetica').fontSize(9.5);
      const rh = doc.heightOfString(reach, { width: W - 126, lineGap: 2.5 });
      need(Math.max(wh, rh) + 8);
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(9.5).text(what, M, y, { width: 118, lineGap: 2.5 });
      doc.fillColor(MUTED).font('Helvetica').fontSize(9.5).text(reach, M + 126, y, { width: W - 126, lineGap: 2.5 });
      y += Math.max(wh, rh) + 8;
    }
    y += 8;
  };

  /* ------------------------------------------------------------- cover */
  const heroH = 500;
  doc.rect(0, 0, doc.page.width, heroH).fill(HERO);
  doc.roundedRect(322, 248, 176, 176, 4).fillOpacity(1).fill('#1b2740');
  doc.roundedRect(322, 248, 176, 176, 4).lineWidth(1).strokeOpacity(1).stroke('#4f6f9e');
  doc.circle(430, 366, 104).fillOpacity(1).fill(ACCENT);
  doc.circle(430, 366, 104).lineWidth(1.2).strokeOpacity(0.55).stroke('#ffffff');
  doc.font('Helvetica-Bold').fontSize(8.6).fillColor('#8fb4ff').text('VECTOR STUDIO FOR YOUR PHONE', M, 150, { characterSpacing: 1.5 });
  doc.font('Helvetica-Bold').fontSize(62).fillColor('#ffffff').text('Pentix', M, 168);
  doc.moveTo(M, 252).lineTo(M + 58, 252).lineWidth(3).strokeColor(ACCENT).stroke();
  doc.font('Helvetica').fontSize(17).fillColor('#dbe4f0').text('The complete tutorial', M, 268);
  doc.font('Helvetica').fontSize(9.6).fillColor('#93a1b5').text(
    'From your first stroke to a finished vector mark,\nwritten for the phone-first workspace.', M, 296, { width: 230, lineGap: 4 }
  );
  doc.rect(0, heroH - 4, doc.page.width, 4).fill(ACCENT);

  y = heroH + 34;
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(ACCENT).text("WHAT'S INSIDE", M, y, { characterSpacing: 1.2 });
  y += 20;
  for (const [title, body] of [
    ['Draw', 'Pen with corner and smooth nodes, freehand pencil with three levels of smoothing, pressure brush for tapered strokes.'],
    ['Combine', 'The shape builder: brush the regions you want, then Merge or Erase. Pathfinder for whole-selection booleans.'],
    ['Deliver', 'Colour and text, layers and object order, backup files you own, and SVG or PNG export with options for mono and transparency.'],
  ]) {
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text(title, M, y, { width: 96 });
    doc.font('Helvetica').fontSize(9.6).fillColor(MUTED).text(body, M + 104, y, { width: W - 104, lineGap: 3 });
    const bh = doc.heightOfString(body, { width: W - 104, lineGap: 3 });
    y += Math.max(18, bh) + 12;
  }
  y += 6;
  doc.moveTo(M, y).lineTo(M + W, y).lineWidth(0.6).strokeColor(RULE).stroke();
  y += 12;
  doc.font('Helvetica').fontSize(8.6).fillColor(MUTED).text('18 chapters · 16 screenshots from the app · A4, for reading on screen or on paper', M, y);

  /* ---------------------------------------------------------- contents */
  addPage();
  chapter = '';
  if (toc) {
    y = M;
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(ACCENT).text('CONTENTS', M, y, { characterSpacing: 1.2 });
    y += 18;
    doc.font('Helvetica-Bold').fontSize(23).fillColor(INK).text('What is where', M, y);
    y += 32;
    doc.moveTo(M, y).lineTo(M + 46, y).lineWidth(2.5).strokeColor(ACCENT).stroke();
    y += 20;
    for (const entry of toc) {
      const number = entry.number ? String(entry.number).padStart(2, '0') : '—';
      doc.font('Helvetica-Bold').fontSize(8.6).fillColor(ACCENT).text(number, M, y + 2, { width: 22, lineBreak: false });
      doc.font('Helvetica').fontSize(10.4).fillColor(INK).text(entry.title, M + 26, y, { width: W - 90, lineBreak: false });
      const titleW = doc.widthOfString(entry.title) + 26;
      const pageLabel = String(entry.page);
      const pw = doc.font('Helvetica-Bold').fontSize(9.4).widthOfString(pageLabel);
      doc.font('Helvetica-Bold').fontSize(9.4).fillColor(ACCENT).text(pageLabel, doc.page.width - M - pw, y + 1, { lineBreak: false });
      const from = M + 26 + titleW + 6;
      const to = doc.page.width - M - pw - 8;
      for (let x = from; x < to; x += 4.2) doc.circle(x, y + 7.6, 0.5).fillColor('#c3cad4').fill();
      y += 22.5;
    }
    y += 10;
    doc.moveTo(M, y).lineTo(M + W, y).lineWidth(0.5).strokeColor(RULE).stroke();
    y += 12;
    doc.font('Helvetica').fontSize(8.6).fillColor(MUTED).text(
      'Chapters follow the order you meet the tools. The last page is a reference card worth keeping open.', M, y, { width: W, lineGap: 3 }
    );
  }

  /* ------------------------------------------------------- how to use */
  addPage();
  chapter = 'How to use this guide';
  starts['How to use this guide'] = pageChapters.length;
  if (toc) toc.push({ title: 'How to use this guide', page: pageChapters.length, number: null });
  y = M;
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(ACCENT).text('BEFORE YOU START', M, y, { characterSpacing: 1.1 });
  y += 16;
  doc.font('Helvetica-Bold').fontSize(21).fillColor(INK).text('How to use this guide', M, y);
  y += 30;
  doc.moveTo(M, y).lineTo(M + 46, y).lineWidth(2.5).strokeColor(ACCENT).stroke();
  y += 16;

  rec.push({ type: 'chapter', title: 'How to use this guide', kicker: 'Before you start' });
  p('Pentix is a vector design studio built for a phone held in two hands: a pen, a pencil, a shape builder and a pathfinder, all reachable by either thumb. This guide walks through every tool in the order you will meet them, with the real screens of the app beside the explanation.');
  quote('Four moves, and you have made a mark.', 'Everything else in this guide is a refinement of these.');
  tour([
    { label: 'Set the board', body: '600 × 600 px is the square a mark gets delivered at. Start blank.' },
    { label: 'Draw', body: 'Pen for corners and curves, pencil for freehand. One shape is enough to begin.' },
    { label: 'Combine', body: 'Overlapping shapes go through the shape builder. Brush, then commit.' },
    { label: 'Export', body: 'SVG to keep editing, PNG to hand over. Check it in preview mode first.' },
  ]);
  pair('01-welcome.png', '06-build.png', 'Left: starting a document. Right: the shape builder turning two shapes into one.');

  text('HOW TO USE THIS GUIDE', { size: 8.5, font: 'Helvetica-Bold', color: ACCENT, gap: 6 });
  bullets([
    { label: 'Read it in order the first time.', body: 'Chapters follow the real workflow: set up a board, draw, combine, colour, save, export.' },
    { label: 'The screens are real captures.', body: 'A 600 × 600 px board at 54% zoom unless a caption says otherwise.' },
    { label: 'Five tabs live on the bottom dock.', body: 'Select, Shapes, Text, Draw and Layers. The options bar above it changes with the active tool, so the screens differ by one tool at a time.' },
  ]);
  callout('You can reopen this guide whenever you like: the Manual row in the app menu opens it as a web page, Download PDF below that saves a copy to print or share, and Gestures & shortcuts links to it as well.');

  /* ------------------------------------------------------ getting started */
  h1('Getting in', 'Chapter 1');
  p('Open pentixl.vercel.app in Safari or Chrome. On a phone, add it to your home screen so it opens full screen without browser bars: Share, then “Add to Home Screen”. Everything you draw stays on the device — there is no account and nothing is uploaded.');
  p('The first screen is a start sheet. You can set up a board, open one of the ready-made marks to learn by pulling them apart, or go straight to this manual.');
  image('01-welcome.png', 'The start sheet: the tutorial, artboard settings, a blank 600 × 600 board, and the starter marks you can open and edit.');
  h2('Three ways to begin');
  bullets([
    { label: 'Artboard settings.', body: 'Choose the board size first — px, cm or in, with presets for the square boards a logo is delivered at.' },
    { label: 'Start blank.', body: 'A 600 × 600 board with nothing on it. This is what the rest of this guide uses.' },
    { label: 'A starter mark.', body: 'Pentix Px, Orbit, Prism, Stack, Pulse or Apex, plus Golden Ratio, Modular, Radial and Diagonal construction grids. They are ordinary documents: open one, inspect the nodes, build on it.' },
  ]);
  callout('Tap Done on the sheet to reach the canvas. Later, Projects in the menu reopens your documents, and New document starts a fresh board.');

  /* --------------------------------------------------------------- tour */
  h1('The screen at a glance', 'Chapter 2');
  p('The shell is fixed, so your hands learn it once: one compact top bar, one canvas, five dock tabs and a sheet for the active tool. The few view controls that do not belong on the bar — Layers, Grid and Preview — live in its ⋯ menu.');
  image('02-blank.png', 'A blank board: compact top bar, rulers, the ⇧⌃⌥ and Precise pills under the zoom control, the five-tab dock, and the options bar for the current tool.');
  h2('Top bar');
  bullets([
    { label: 'Menu.', body: 'Save, backup, projects, canvas settings, references, patterns, the tutorial, help and feedback.' },
    { label: 'Document name.', body: 'Tap to rename. A dot beside it means changes are being written.' },
    { label: 'Undo and redo.', body: 'Step backwards or forwards through the document history.' },
    { label: 'More actions.', body: 'The ⋯ menu holds Layers, the alignment Grid and Preview, which hides every panel, ruler and selection, leaving only the artboard.' },
    { label: 'Export.', body: 'The accent button opens the export panel for SVG or PNG, with options for size, colour and transparency.' },
  ]);
  h2('Modifiers and Precise');
  bullets([
    { label: '⇧⌃⌥ pill.', body: 'Under the zoom control. Tap it, arm SHIFT, CTRL or ALT, then tap Done before dragging. Clear is the release action; tapping the pill only opens or closes the tray. The armed glyphs stay lit on the pill.' },
    { label: 'Precise pill.', body: 'Opens the optional trackpad for node, select, pen, pencil and shape-builder work: steer the crosshair, click to press, drag to move, scroll to pan and ⌘-scroll to zoom. It hides on Text, where it has no job.' },
  ]);
  h2('Dock and options');
  p('The dock has five fixed, labelled destinations. Select, Shapes and Text are direct; Draw opens a tray with the pen, pencil, pressure brush, node editor, shape builder and pan tool; Layers opens the document stack. The options bar directly above the dock carries that tool’s controls — smoothness for the pencil, pressure for the brush, Merge and Erase while building.');

  /* ------------------------------------------------------------ drawing */
  h1('Drawing with the pen', 'Chapter 3');
  p('The pen places anchors. Tap to place a corner, drag to pull out a curve, and tap the first anchor to close the shape.');
  image('04-pen.png', 'The pen hint reads “Tap to place a point · drag to pull curves”. An open path shows its anchors and the rubber band to the next tap.');
  bullets([
    { label: 'Corner node.', body: 'A plain tap. The path changes direction sharply there.' },
    { label: 'Smooth node.', body: 'Tap and drag without lifting: two handles come out symmetrically and further taps continue the curve smoothly.' },
    { label: 'Break a handle.', body: 'Hold ALT and drag one handle to make a cusp — a corner with one curved side.' },
    { label: 'Close the path.', body: 'Tap the first anchor and it fills. End on a different anchor to leave it open.' },
    { label: 'Delete a node.', body: 'ALT + tap on the node while editing its path.' },
    { label: 'Commit.', body: 'Press Done in the options bar, or the check on the canvas.' },
  ]);
  callout('Double-tap any object with the select tool to edit its nodes. The options bar switches to node controls; Select in the dock returns you to object mode.');

  h1('Freehand: pencil and brush', 'Chapter 4');
  p('The pencil turns a finger or stylus stroke into a small number of smooth nodes when you lift, instead of leaving hundreds of anchors behind.');
  image('03-pencil.png', 'The pencil options: “Draw freehand · end on the start to close”, with Tight, Smooth and Loose and the smoothing amount.');
  bullets([
    { label: 'Tight, Smooth, Loose.', body: 'How closely the fitted curve follows your finger. Tight is most faithful, Loose evens out the most wobble.' },
    { label: 'Closing.', body: 'Finish where you started. A cue ring appears when the stroke will close into a filled shape.' },
    { label: 'Single tap.', body: 'Places one dot in the stroke colour.' },
    { label: 'Pressure brush.', body: 'The next tool along draws with a tapered width. Pressure follows a stylus or your finger speed; you can also choose Speed or a flat Uniform width.' },
  ]);

  /* ------------------------------------------------------------- shapes */
  h1('Shapes and the shape library', 'Chapter 5');
  p('The square icon on the dock opens the shape tools: square, circle, triangle, star, polygon and line, plus the whole library of seventeen shapes. Drag on the canvas to place one; hold SHIFT while dragging to keep it square or circular.');
  image('05-shapes.png', 'A circle and a square on the board. Each is its own object, ready to be combined or edited.');
  p('Once placed, a shape is an ordinary path: double-tap to edit its anchors, recolour it, duplicate it, or combine it with something else.');

  /* ------------------------------------------------------ shape builder */
  h1('The shape builder', 'Chapter 6');
  quote('This is the heart of Pentix.', 'If you learn one thing here, learn this.');
  p('Two or more overlapping shapes on a layer are split into regions — the parts belonging to only one shape, and the parts they share. You brush the regions you want, and Pentix rebuilds the artwork as one clean outline.');
  image('06-build.png', 'Regions are outlined and hatched once you brush one. The floating pill switches between Merge, Erase and Build; the options bar repeats the controls.');
  h2('The three moves');
  bullets([
    { label: 'Merge.', body: 'Brush the regions you want to keep together and commit. The shapes become one object whose outline is exactly the union — no crescent left over, nothing doubled.' },
    { label: 'Erase.', body: 'Brush regions and commit, and that patch is cut out of every shape it touches. What remains is still your artwork, with the hole gone.' },
    { label: 'Tap or drag.', body: 'A drag collects every region the finger crosses. In erase mode a single tap removes just that one region, which is the quickest way to clear a few chips.' },
  ]);
  image('08-erase.png', 'Erase mode: the region under your finger is hatched before you commit it. A tap takes one region, a drag takes every region it crosses.');
  h2('What a build guarantees');
  bullets([
    { label: 'One object per piece.', body: 'A merge produces a single object. An erase produces one object for each remaining piece, and a shape the build never touched keeps its identity — no drift, no duplicate.' },
    { label: 'Sharp where it should be.', body: 'Corners the shapes form together stay sharp; curves stay curves.' },
    { label: 'Paint survives.', body: 'The result takes its fill and stroke from the region it grew out of, so a merge never looks like a recolour.' },
    { label: 'Honest names.', body: 'A cut circle is no longer a circle, so built objects become Shape 1, Shape 2 and so on. Untouched shapes keep their names.' },
  ]);
  image('07-merge.png', 'After committing: one object, one outline, one fill. Nothing is doubled and no crescent is left behind.');
  h2('A worked example');
  tryBox('Try it in thirty seconds', 'Circle, then a square across its right side. Open the shape builder, brush both regions, commit with Merge. Undo and brush only the shared region instead — you get the lens.');
  p('Draw a circle, then a square overlapping its right side. Open the shape builder, brush the circle’s own region and the shared region, and commit with Merge. You now have a circle-and-square silhouette as a single path. Switch to Erase, tap the square’s free corner, and that corner is cut away cleanly.');

  /* --------------------------------------------------------- pathfinder */
  h1('Pathfinder', 'Chapter 7');
  p('When you want a boolean operation across a whole selection rather than a brushed area, select two or more objects and open Effects in the options bar: Pathfinder holds Unite, Minus, Intersect, Exclude and Divide.');
  image('13b-pathfinder.png', 'With two objects selected the options bar offers Arrange, Effects and 3D; Effects holds Pathfinder and its five operations.');
  bullets([
    { label: 'Unite.', body: 'One silhouette from the union of everything selected.' },
    { label: 'Minus.', body: 'Cuts the objects in front out of the object at the back.' },
    { label: 'Intersect.', body: 'Keeps only the area every selected object covers.' },
    { label: 'Exclude.', body: 'Keeps everything except the shared area.' },
  ]);
  callout('The shape builder suits hand-brushed, local edits; the pathfinder suits a whole selection you already know should combine. Both produce the same quality of outline.');

  /* ------------------------------------------------------------- layers */
  h1('Layers and objects', 'Chapter 8');
  p('The Layers tab on the dock opens the Layers & objects sheet. It lists everything from front to back; each row is an object, and every layer shows its objects directly beneath it — nothing collapses, so there is nothing to expand.');
  image('09-layers.png', 'The layers sheet: layer opacity, GROUP and OBJECT modes, then object rows with visibility, lock, order arrows and delete.');
  bullets([
    { label: 'Visibility and lock.', body: 'The eye hides an object without deleting it; the padlock freezes it so it cannot be selected or moved by accident.' },
    { label: 'Opacity.', body: 'The slider on a layer sets it for everything in that layer.' },
    { label: 'Restacking.', body: 'Tap an arrow to step an object one place, or hold the arrow to send it to the front or back. Drag a row onto another to restack, or drop it on a layer name to move it into that layer.' },
    { label: 'Groups move together.', body: 'Tap any member on the canvas and the whole group comes with it, so a drag moves every piece. For one object, switch GROUP to OBJECT in this sheet and tap its row; double-tapping into its nodes also selects just that object. Ungroup releases the group’s contents into the layer beneath.' },
    { label: 'On a keyboard.', body: 'ALT + arrow up or down reorders; add SHIFT to jump to the front or back.' },
  ]);

  /* ------------------------------------------------------------- colour */
  h1('Colour', 'Chapter 9');
  p('Fill and stroke live in the Object tab of the options bar. The panel gives you swatches, a full picker, and a way to keep a colour you have mixed for reuse.');
  image('10-colour.png', 'The Paint sheet: fill and stroke, the palette and the picker. The red slash on NONE means no fill at all.');
  bullets([
    { label: 'Fill and stroke separately.', body: 'Tap Object in the options bar for the selected object, then tap the fill swatch or the stroke swatch to choose which one you are editing.' },
    { label: 'No fill or no stroke.', body: 'A red line crosses the thumbnail whenever that paint is set to none, so an empty chip never reads as a dark colour. “None” also survives a build, so combining shapes never adds an outline you did not ask for.' },
    { label: 'Saved colours.', body: 'Save this colour adds the current value to your palette at the top of the panel.' },
    { label: 'Patterns.', body: 'Named pattern swatches live in the menu, for fills you want to reuse across documents.' },
  ]);

  /* --------------------------------------------------------------- text */
  h1('Text', 'Chapter 10');
  p('The T on the dock is the type tool. Tap the canvas to place a label and start typing; tap an existing label with the type tool to edit it.');
  image('11-text.png', 'Editing a label: the type sheet with its typeface, size, letter spacing and line height.');
  bullets([
    { label: 'Editing.', body: 'Double-tap a label with the select tool, or tap it once with the type tool.' },
    { label: 'To curves.', body: 'Converts the glyphs into editable paths. Do this before an operation that needs geometry, such as the shape builder or a pathfinder boolean.' },
    { label: 'Warp.', body: 'Effects → Warp bends a label without turning it into geometry: pick Arch, Wave, Bulge, Fisheye, Twist or Free, then Apply warp. It stays real type, so you can retype it, restyle it, move it, rotate it and scale it afterwards — the bend goes with it. To curves is only for when you want the letters as paths you can pull around by their nodes.' },
    { label: 'Fonts.', body: 'The menu’s Fonts section loads your own typefaces and keeps them on the device between sessions.' },
  ]);

  /* ------------------------------------------------ images and references */
  h1('Images, references and tracing', 'Chapter 11');
  p('Three different jobs, three different places in the menu.');
  bullets([
    { label: 'References.', body: 'Import one or several images as a locked underlay to draw over. They travel with the document, sit behind the artwork, and can be unlocked when you need to move them.' },
    { label: 'Trace an image.', body: 'Turns a high-contrast silhouette into real paths you can edit — the quickest route from a scanned sketch to vector artwork.' },
    { label: 'Patterns.', body: 'Named swatches you define once and reuse as fills.' },
  ]);

  /* ------------------------------------------------------ saving/backup */
  h1('Saving, backup and projects', 'Chapter 12');
  p('Pentix saves as you work. The menu tells you exactly where that stands, and the backup command writes a real file you control.');
  image('13-menu.png', 'The menu: save state, backup, projects and canvas settings, with the studio tools, help and the tutorial below them.');
  bullets([
    { label: 'Save.', body: '“Stored on this device” means the document is written locally. The dot beside the title shows a change is being written.' },
    { label: 'Backup & restore.', body: 'Writes a backup file you can keep anywhere, and restores one you saved earlier. When it reads “Not protected”, take a backup — clearing browser data would otherwise remove the document.' },
    { label: 'Projects.', body: 'Every document made on this device, newest first.' },
    { label: 'New document.', body: 'Starts a fresh board without touching the current one.' },
    { label: 'Clean up fragments.', body: 'Deletes invisible leftovers — tiny slivers and stray fragments that take up space but cannot be seen or used.' },
  ]);

  /* -------------------------------------------------------------- export */
  h1('Export', 'Chapter 13');
  p('The Export button in the top bar opens the export panel. SVG is for further editing and for the web; PNG is for handing a file to someone.');
  image('12-export.png', 'The export panel: a live preview, SVG or PNG, colour and transparent background, then the markup with Copy code and Download.');
  bullets([
    { label: 'SVG.', body: 'Real vector output: paths, fills and strokes, editable in any vector tool.' },
    { label: 'PNG.', body: 'Raster output at the board size, or larger for print.' },
    { label: 'Include.', body: 'Export the whole artboard, or only the selection when you want one element on its own.' },
    { label: 'One colour.', body: 'Flattens every fill to black or white for reversed and mono versions of a mark.' },
    { label: 'Background.', body: 'The artboard colour is separate from the artwork. Turning it off drops the background entirely, which gives a transparent PNG or SVG.' },
  ]);
  callout('Grid, rulers and guides are editing aids. They are never included in an export.');

  /* ------------------------------------------------------------- preview */
  h1('Preview mode', 'Chapter 14');
  p('Before judging a mark, look at it with nothing else on screen. Preview, under More actions in the top bar, hides every panel, ruler, grid, guide and selection.');
  image('15-preview.png', 'Preview mode: artwork only, with Exit preview in the corner. Drag to pan, pinch to zoom, or press Escape to return.');

  /* ------------------------------------------------------------ gestures */
  h1('Gestures and shortcuts', 'Chapter 15');
  p('The same help sheet lives in the app under the menu, so you never have to remember this chapter.');
  image('14-help.png', 'Gestures & shortcuts, opened from the menu. The sheet also links straight to this manual.');
  h2('On the canvas');
  bullets([
    { label: 'Two fingers.', body: 'Pan and pinch to zoom. You can switch this off in the menu if you keep nudging it while drawing.' },
    { label: 'One finger.', body: 'Drags the active tool. On empty space with the select tool it starts a marquee.' },
    { label: 'Tap the canvas.', body: 'Deselects — or places a label, with the type tool.' },
    { label: 'Hold space.', body: 'Pans while held, then returns you to the tool you were on.' },
  ]);
  h2('On a keyboard');
  keysGrid([
    { keys: ['V'], what: 'select' },
    { keys: ['A'], what: 'direct selection' },
    { keys: ['P'], what: 'pen' },
    { keys: ['N'], what: 'pencil' },
    { keys: ['B'], what: 'brush' },
    { keys: ['M'], what: 'shape builder' },
    { keys: ['U'], what: 'shapes' },
    { keys: ['T'], what: 'text' },
    { keys: ['H'], what: 'pan tool' },
    { keys: ['space'], what: 'hold to pan' },
    { keys: ['⌘Z'], what: 'undo' },
    { keys: ['⇧⌘Z'], what: 'redo' },
    { keys: ['⌘D'], what: 'duplicate' },
    { keys: ['⌘S'], what: 'save' },
    { keys: ['⌘C', '⌘V'], sep: ' / ', what: 'copy, paste' },
    { keys: ['⌫'], what: 'delete' },
    { keys: ['esc'], what: 'cancel, or leave preview' },
    { keys: ['alt', '↑'], sep: ' + ', what: 'restack the selection' },
  ]);
  callout('Hold SHIFT while you rotate to snap the angle to 15° steps, and while you drag a shape to keep it square or circular.');

  /* -------------------------------------------------------------- quality */
  h1('Getting clean results', 'Chapter 16');
  h2('Why nothing happened when I brushed');
  bullets([
    { label: 'Not enough shapes.', body: 'The shape builder needs two or more shapes on the layer to make regions. A single shape has nothing to divide.' },
    { label: 'Nothing selected yet.', body: 'In merge mode a tap only collects a region. Commit with Build, the pill’s Build button, or drag instead of tapping.' },
    { label: 'Locked or hidden objects.', body: 'Locked and hidden objects do not take part in a build. Unlock them first.' },
  ]);
  h2('Why a piece disappeared');
  bullets([
    { label: 'Slivers are dropped.', body: 'A leftover thinner than about three quarters of a square unit is noise, so it is discarded rather than left as an unusable fragment.' },
    { label: 'A shape can vanish entirely.', body: 'If the brushed area covers a whole shape, that shape is gone — undo if that was not the intent.' },
  ]);
  h2('Keeping the file healthy');
  bullets([
    { label: 'Clean up fragments occasionally.', body: 'Long editing sessions leave invisible slivers behind; the menu command removes them.' },
    { label: 'Flatten at the end.', body: 'Build and pathfinder operations are best done once the shapes are in place, not on every small edit.' },
    { label: 'Back up before big changes.', body: 'A backup file is the only protection against clearing browser data or losing a device.' },
  ]);

  /* ------------------------------------------------------------ reference */
  h1('Reference card', 'Chapter 17');
  p('The whole app on one page. Keep it open while you work.');
  refGrid([
    ['Draw a precise corner or curve', 'Pen — tap for a corner, drag for a curve, tap the first node to close'],
    ['Draw a loose shape quickly', 'Pencil — smoothness in the options bar changes how closely it follows your finger'],
    ['Place a square, circle, star, polygon', 'Shapes on the dock; SHIFT while dragging keeps it even'],
    ['Join two shapes into one outline', 'Build — brush the regions, then commit with Merge'],
    ['Cut a shape out of another', 'Build in Erase mode, or Pathfinder → Minus'],
    ['Combine a whole selection', 'Select both, then Effects → Pathfinder → Unite / Minus / Intersect / Exclude'],
    ['Edit the nodes of anything', 'Double-tap it with Select, or hold CTRL'],
    ['Make text editable geometry', 'Select the label → To curves'],
    ['Bend a label', 'Select it → Effects → Warp, pick a style, Apply warp. It stays real type'],
    ['Tidy a hand-drawn path', 'Select it → Effects → Simplify'],
    ['Recolour something', 'Object tab in the options bar; a red slash on the chip means none. Save this colour keeps it'],
    ['Hide the app and just look', 'More actions → Preview in the top bar'],
    ['Keep a copy off the device', 'Menu → Backup & restore'],
    ['Hand the mark to someone', 'Export — SVG to edit, PNG to send'],
  ]);
  y += 14;
  text('Pentix is free while it is being tested. If something behaves oddly, use Send feedback in the menu: it attaches the details needed to fix it, and you can describe what you were doing in your own words.', { size: 9, color: MUTED });

  /* --------------------------------------------------------------- footer */
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    if (i === 0) continue;
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const bottom = doc.page.height - 36;
    doc.moveTo(M, bottom - 8).lineTo(doc.page.width - M, bottom - 8).lineWidth(0.5).strokeColor(RULE).stroke();
    doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(pageChapters[i] || 'Pentix tutorial', M, bottom - 3, { width: W * 0.7, lineBreak: false });
    doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(String(i + 1), doc.page.width - M - 40, bottom - 3, { width: 40, align: 'right', lineBreak: false });
    doc.page.margins.bottom = savedBottom;
  }

  // pdfkit is a stream: the bytes only exist once it has finished emitting.
  const finished = new Promise((resolve) => doc.on('end', resolve));
  doc.end();
  await finished;
  return { starts, chapters: CHAPTERS, chunks, content: rec };
}

// Pass one measures, pass two prints the numbers. The contents page is reserved
// in both, so the layout is identical and the numbers stay true.
void (async () => {
  const first = await build(null);
  const toc = first.chapters.map((c) => ({ title: c.title, number: c.number, page: first.starts[c.title] }));
  toc.unshift({ title: 'How to use this guide', page: first.starts['How to use this guide'], number: null });
  const second = await build(toc);

  const pdf = Buffer.concat(second.chunks);
  // The web manual only needs the structured copy. Set this when regenerating
  // copy on a machine without the screenshot set, so the shipped PDF keeps its
  // images instead of being replaced by a text-only build.
  if (process.env.PENTIX_MANUAL_CONTENT_ONLY !== '1') {
    for (const out of OUTS) fs.writeFileSync(out, pdf);
  }
  // The web manual is generated from this, so both tell the same story.
  fs.writeFileSync(
    path.join(ROOT, 'artifacts', 'manual-content.json'),
    JSON.stringify(second.content, null, 2)
  );
  console.log('wrote', OUTS.join(' and '), `${(pdf.length / 1048576).toFixed(1)} MB`);
})();
