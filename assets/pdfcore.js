/* PdfCore: pure helpers for the PDF page cleaner (no DOM). */
(function (root) {
  'use strict';
  var AD_RE = /wuolah|studocu|publicidad|anuncio|patrocin|advert|sponsor|sin\s+anuncios|ad-?free|unlock\s+full|descarg[ao]\s+(este|el)\s+documento|sube\s+tus\s+apuntes|upload\s+your\s+documents|premium/i;

  function parseRange(str, n) {
    var out = [], bad = null;
    String(str || '').split(',').forEach(function (part) {
      part = part.trim(); if (!part) return;
      var m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part);
      if (!m) { bad = bad || 'Could not read “' + part + '”. Use numbers like 1, 3, 5-7.'; return; }
      var a = parseInt(m[1], 10), b = m[2] ? parseInt(m[2], 10) : a;
      if (a < 1 || b < a || b > n) { bad = bad || 'Range “' + part + '” is outside pages 1–' + n + '.'; return; }
      for (var i = a; i <= b; i++) out.push(i - 1);
    });
    return { pages: out, error: bad };
  }

  function suggestReason(text, index, count) {
    var t = (text || '').replace(/\s+/g, ' ').trim();
    if (AD_RE.test(t)) return 'Mentions advertising or a note-sharing site';
    if (count > 2 && (index === 0 || index === count - 1) && t.length < 12) return 'Almost no text on a first or last page';
    return '';
  }

  /* Map visual margins (fractions of the visible page) onto an unrotated box. */
  function cropBox(box, rotation, m) {
    var r = ((rotation % 360) + 360) % 360, s;
    if (r === 90) s = { left: m.top, top: m.right, right: m.bottom, bottom: m.left };
    else if (r === 180) s = { top: m.bottom, right: m.left, bottom: m.top, left: m.right };
    else if (r === 270) s = { right: m.top, bottom: m.right, left: m.bottom, top: m.left };
    else s = { top: m.top, right: m.right, bottom: m.bottom, left: m.left };
    return {
      x: box.x + box.width * s.left,
      y: box.y + box.height * s.bottom,
      width: box.width * (1 - s.left - s.right),
      height: box.height * (1 - s.top - s.bottom)
    };
  }

  async function clean(PDFLib, bytes, removeIdx, margins) {
    var doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
    var total = doc.getPageCount(), rm = Array.from(new Set(removeIdx)).filter(function (i) { return i >= 0 && i < total; }).sort(function (a, b) { return b - a; });
    if (rm.length >= total) throw new Error('You selected every page. Keep at least one page.');
    rm.forEach(function (i) { doc.removePage(i); });
    var m = margins || { top: 0, right: 0, bottom: 0, left: 0 };
    if (m.top + m.right + m.bottom + m.left > 0) {
      doc.getPages().forEach(function (p) {
        var b = cropBox(p.getCropBox(), p.getRotation().angle, m);
        p.setCropBox(b.x, b.y, b.width, b.height);
      });
    }
    var out = await doc.save({ useObjectStreams: true });
    return { bytes: out, before: total, after: total - rm.length };
  }

  var api = { parseRange: parseRange, suggestReason: suggestReason, cropBox: cropBox, clean: clean, AD_RE: AD_RE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PdfCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
