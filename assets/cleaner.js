(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  if (!$('cl-drop')) return;
  var V = '/assets/vendor/';
  var S = { name: '', bytes: null, pdf: null, n: 0, sel: new Set(), sugg: {}, busy: false, url: null, libs: null };
  var drop = $('cl-drop'), input = $('cl-file'), grid = $('cl-grid'), status = $('cl-status'), work = $('cl-work'), result = $('cl-result');

  function say(t, bad) { status.textContent = t; status.className = 'cl-status' + (bad ? ' err' : ''); }
  function fmt(b) { return b > 1048576 ? (b / 1048576).toFixed(2) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error('Could not load ' + src)); };
      document.head.appendChild(s);
    });
  }
  function libs() {
    if (S.libs) return S.libs;
    S.libs = Promise.all([
      import(V + 'pdf.min.mjs'),
      window.PDFLib ? 0 : loadScript(V + 'pdf-lib.min.js')
    ]).then(function (r) {
      r[0].GlobalWorkerOptions.workerSrc = V + 'pdf.worker.min.mjs';
      return r[0];
    });
    return S.libs;
  }

  function reset() {
    if (S.pdf && S.pdf.destroy) S.pdf.destroy();
    if (S.url) URL.revokeObjectURL(S.url);
    S.name = ''; S.bytes = null; S.pdf = null; S.n = 0; S.sel = new Set(); S.sugg = {}; S.url = null;
    grid.innerHTML = ''; work.hidden = true; result.hidden = true; input.value = '';
    say('No file selected. Everything runs in your browser.');
  }

  function updateCount() {
    $('cl-count').textContent = S.sel.size + ' of ' + S.n + ' pages marked for removal';
    $('cl-run').disabled = S.busy || !S.n || S.sel.size >= S.n;
    var cells = grid.children;
    for (var i = 0; i < cells.length; i++) {
      var on = S.sel.has(i); cells[i].setAttribute('aria-pressed', on ? 'true' : 'false');
      cells[i].classList.toggle('rm', on);
    }
  }

  function toggle(i) { if (S.busy) return; if (S.sel.has(i)) S.sel.delete(i); else S.sel.add(i); updateCount(); }

  function buildGrid() {
    grid.innerHTML = '';
    var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); renderThumb(e.target); } });
    }, { rootMargin: '300px' }) : null;
    for (let i = 0; i < S.n; i++) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'pg'; b.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-label', 'Page ' + (i + 1) + '. Press to mark for removal.');
      b.dataset.i = i; b.innerHTML = '<canvas width="160" height="210"></canvas><span class="num">' + (i + 1) + '</span><span class="tag" hidden></span><span class="x" aria-hidden="true">Remove</span>';
      b.addEventListener('click', function () { toggle(i); });
      grid.appendChild(b); if (io) io.observe(b); else renderThumb(b);
    }
    updateCount();
  }

  async function renderThumb(b) {
    try {
      var page = await S.pdf.getPage(parseInt(b.dataset.i, 10) + 1), cv = b.querySelector('canvas');
      var vp0 = page.getViewport({ scale: 1 }), sc = 160 / vp0.width, vp = page.getViewport({ scale: sc });
      cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
      await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise; page.cleanup();
    } catch (e) { /* thumbnail failed; page can still be selected */ }
  }

  async function scanText() {
    for (var i = 0; i < S.n; i++) {
      try {
        var p = await S.pdf.getPage(i + 1), tc = await p.getTextContent();
        var t = tc.items.map(function (x) { return x.str; }).join(' ');
        var r = PdfCore.suggestReason(t, i, S.n);
        if (r) { S.sugg[i] = r; var tag = grid.children[i].querySelector('.tag'); tag.hidden = false; tag.textContent = 'Suggested'; tag.title = r; grid.children[i].setAttribute('aria-label', 'Page ' + (i + 1) + '. Suggested for removal: ' + r + '.'); }
        p.cleanup();
      } catch (e) { /* ignore */ }
    }
    var k = Object.keys(S.sugg).length;
    $('cl-sugg').disabled = !k;
    say(k ? k + ' page' + (k > 1 ? 's look' : ' looks') + ' like advertising. These are suggestions only: check every page before cleaning.' : 'No obvious ad pages found by text. Select pages by hand or try the page range box.');
  }

  async function open(file) {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') { say('That is not a PDF file. Choose a file ending in .pdf.', true); return; }
    reset(); S.busy = true; say('Loading PDF tools…');
    try {
      var pdfjs = await libs();
      say('Reading “' + file.name + '”…');
      S.bytes = new Uint8Array(await file.arrayBuffer()); S.name = file.name.replace(/\.pdf$/i, '');
      S.pdf = await pdfjs.getDocument({ data: S.bytes.slice(), wasmUrl: V + 'wasm/', standardFontDataUrl: V + 'standard_fonts/' }).promise;
      S.n = S.pdf.numPages; work.hidden = false; $('cl-name').textContent = file.name + ' · ' + fmt(S.bytes.length) + ' · ' + S.n + ' pages';
      buildGrid(); S.busy = false; updateCount(); say('Scanning pages for advertising…'); await scanText();
    } catch (e) {
      S.busy = false; var pw = e && (e.name === 'PasswordException');
      reset(); say(pw ? 'This PDF is password-protected. Remove the password first, then try again.' : 'Could not read this PDF. It may be damaged or not a real PDF.', true);
    }
  }

  async function run() {
    if (S.busy || !S.n) return;
    var m = { top: 0, right: 0, bottom: 0, left: 0 }, any = false;
    ['top', 'right', 'bottom', 'left'].forEach(function (k) {
      var v = Math.min(30, Math.max(0, parseFloat($('cl-' + k).value) || 0)); m[k] = v / 100; if (v) any = true;
    });
    if (!S.sel.size && !any) { say('Nothing to do yet: mark at least one page or set a margin to trim.', true); return; }
    S.busy = true; updateCount(); say('Cleaning…');
    try {
      var r = await PdfCore.clean(window.PDFLib, S.bytes, Array.from(S.sel), m);
      var blob = new Blob([r.bytes], { type: 'application/pdf' });
      if (S.url) URL.revokeObjectURL(S.url); S.url = URL.createObjectURL(blob);
      var a = $('cl-dl'); a.href = S.url; a.download = S.name + '-cleaned.pdf';
      $('cl-sum').textContent = 'Pages: ' + r.before + ' → ' + r.after + ' · Size: ' + fmt(S.bytes.length) + ' → ' + fmt(r.bytes.length) + (any ? ' · Margins trimmed' : '');
      result.hidden = false; say('Done. Open the cleaned file and check it before you delete the original.'); a.focus();
    } catch (e) {
      var enc = /encrypt/i.test(e.message || '');
      say(enc ? 'This PDF is encrypted, so it cannot be edited here.' : (e.message || 'Cleaning failed. Try again with a fresh copy of the file.'), true);
    }
    S.busy = false; updateCount();
  }

  input.addEventListener('change', function () { open(input.files && input.files[0]); });
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { var f = e.dataTransfer && e.dataTransfer.files[0]; open(f); });
  $('cl-sugg').addEventListener('click', function () { Object.keys(S.sugg).forEach(function (k) { S.sel.add(+k); }); updateCount(); });
  $('cl-first').addEventListener('click', function () { if (S.n) { S.sel.add(0); updateCount(); } });
  $('cl-last').addEventListener('click', function () { if (S.n) { S.sel.add(S.n - 1); updateCount(); } });
  $('cl-clear').addEventListener('click', function () { S.sel.clear(); updateCount(); });
  $('cl-range-go').addEventListener('click', function () {
    var r = PdfCore.parseRange($('cl-range').value, S.n);
    if (r.error) { say(r.error, true); return; } r.pages.forEach(function (i) { S.sel.add(i); }); updateCount(); say('Range added.');
  });
  $('cl-run').addEventListener('click', run);
  $('cl-reset').addEventListener('click', reset);
  $('cl-again').addEventListener('click', reset);
  window.addEventListener('pagehide', function () { if (S.url) URL.revokeObjectURL(S.url); });
  reset();
})();
