/*
 * board.js — Tampilan papan catur interaktif (dipakai di mode bermain & mode belajar)
 * ------------------------------------------------------------
 * - Ketuk/klik bidak → kotak tujuan sah ditandai titik hijau, kotak makan ditandai lingkaran merah
 * - Bisa juga diseret (drag & drop) dengan mouse atau jari
 * - Menyorot langkah terakhir (kuning lembut), raja yang terkena skak (merah), petunjuk (biru)
 * - Animasi halus saat bidak bergerak
 */
(function (global) {
  'use strict';
  var Chess = global.Chess;

  function BoardView(el, opts) {
    opts = opts || {};
    this.el = el;
    this.orientation = 'w';
    this.chess = null;
    this.selected = -1;
    this.targets = [];         // daftar langkah sah dari kotak terpilih
    this.lastMove = null;      // {from, to}
    this.hint = null;          // {from, to}
    this.markers = [];         // kotak bertanda bintang (mode belajar)
    this.onMove = opts.onMove || function () {};
    this.canMove = opts.canMove || function () { return true; };   // (warna) → boleh digerakkan pengguna?
    this.onSelect = opts.onSelect || function () {};
    this.pieceEls = {};
    this.drag = null;
    this._build();
  }

  BoardView.prototype._build = function () {
    var el = this.el;
    el.classList.add('board');
    el.innerHTML = '';
    el.setAttribute('role', 'grid');
    el.setAttribute('aria-label', 'Papan catur');
    this.squaresEl = document.createElement('div');
    this.squaresEl.className = 'squares';
    this.squares = [];
    for (var v = 0; v < 64; v++) {
      var s = document.createElement('div');
      s.className = 'sq';
      this.squaresEl.appendChild(s);
      this.squares.push(s);
    }
    this.piecesEl = document.createElement('div');
    this.piecesEl.className = 'pieces';
    el.appendChild(this.squaresEl);
    el.appendChild(this.piecesEl);

    var self = this;
    el.addEventListener('pointerdown', function (e) { self._down(e); });
    el.addEventListener('pointermove', function (e) { self._moveDrag(e); });
    el.addEventListener('pointerup', function (e) { self._up(e); });
    el.addEventListener('pointercancel', function () { self._cancelDrag(); });
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  };

  BoardView.prototype._vis = function (idx) { return this.orientation === 'w' ? idx : 63 - idx; };

  BoardView.prototype.setOrientation = function (color) {
    if (this.orientation === color) return;
    this.orientation = color;
    this.render();
  };
  BoardView.prototype.flip = function () { this.setOrientation(this.orientation === 'w' ? 'b' : 'w'); };

  /** Tampilkan posisi. opts.animate = objek langkah yang akan dianimasikan. */
  BoardView.prototype.setPosition = function (chess, opts) {
    opts = opts || {};
    this.chess = chess;
    var lm = chess.lastMove();
    this.lastMove = opts.lastMove !== undefined ? opts.lastMove : (lm ? { from: lm.from, to: lm.to } : null);
    this.selected = -1;
    this.targets = [];
    this.render(opts.animate || null);
  };

  BoardView.prototype.setHint = function (from, to) { this.hint = from >= 0 ? { from: from, to: to } : null; this.render(); };
  BoardView.prototype.clearHint = function () { if (this.hint) { this.hint = null; this.render(); } };
  BoardView.prototype.setMarkers = function (list) { this.markers = list || []; this.render(); };

  BoardView.prototype.select = function (sq) {
    this.selected = sq;
    var seen = {};
    this.targets = this.chess.moves({ square: sq }).filter(function (m) {
      if (seen[m.to]) return false;
      seen[m.to] = true;
      return true;
    });
    this.onSelect(sq);
    this.render();
  };
  BoardView.prototype.deselect = function () {
    if (this.selected < 0) return;
    this.selected = -1;
    this.targets = [];
    this.render();
  };

  BoardView.prototype.render = function (anim) {
    var chess = this.chess;
    if (!chess) return;
    var checkSq = -1;
    if (chess.inCheck()) checkSq = chess.kingSq[chess.turn];
    var targetMap = {};
    this.targets.forEach(function (m) { targetMap[m.to] = m.captured ? 'capture' : 'move'; });
    var self = this;

    for (var v = 0; v < 64; v++) {
      var idx = this.orientation === 'w' ? v : 63 - v;
      var s = this.squares[v];
      var cls = 'sq ' + (Chess.isLightSquare(idx) ? 'light' : 'dark');
      if (this.lastMove && (idx === this.lastMove.from || idx === this.lastMove.to)) cls += ' last';
      if (idx === this.selected) cls += ' selected';
      if (targetMap[idx]) cls += targetMap[idx] === 'capture' ? ' capture' : ' target';
      if (idx === checkSq) cls += ' check';
      if (this.hint && (idx === this.hint.from || idx === this.hint.to)) cls += ' hint';
      if (this.markers.indexOf(idx) >= 0) cls += ' marker';
      s.className = cls;
      s.dataset.sq = idx;
      var name = Chess.sqName(idx);
      var html = '';
      var row = v >> 3, col = v & 7;
      if (col === 0) html += '<span class="coord rank">' + name.charAt(1) + '</span>';
      if (row === 7) html += '<span class="coord file">' + name.charAt(0) + '</span>';
      if (this.markers.indexOf(idx) >= 0) html += '<span class="star">★</span>';
      s.innerHTML = html;
      var p = chess.board[idx];
      s.setAttribute('aria-label', name + (p ? ' ' + global.Pieces.name(p) + (p < 'a' ? ' putih' : ' hitam') : ''));
    }

    // Bidak
    this.piecesEl.innerHTML = '';
    this.pieceEls = {};
    for (var i = 0; i < 64; i++) {
      var pc = chess.board[i];
      if (!pc) continue;
      var d = document.createElement('div');
      d.className = 'piece';
      var vv = this._vis(i);
      d.style.left = ((vv & 7) * 12.5) + '%';
      d.style.top = ((vv >> 3) * 12.5) + '%';
      d.innerHTML = global.Pieces.svg(pc);
      this.piecesEl.appendChild(d);
      this.pieceEls[i] = d;
    }

    if (anim) this._animate(anim);
  };

  BoardView.prototype._animate = function (m) {
    var self = this;
    var pairs = [[m.from, m.to]];
    if (m.castle) {
      var white = m.color ? m.color === 'w' : m.to > 32;
      if (m.castle === 'k') pairs.push(white ? [63, 61] : [7, 5]);
      else pairs.push(white ? [56, 59] : [0, 3]);
    }
    if (m.dragged) pairs.shift();   // bidak yang diseret sudah di tempatnya
    // Bidak yang dimakan memudar
    if (m.captured) {
      var capSq = m.ep ? m.to + (m.color === 'w' ? 8 : -8) : m.to;
      var vv = this._vis(capSq);
      var ghost = document.createElement('div');
      ghost.className = 'piece ghost';
      ghost.style.left = ((vv & 7) * 12.5) + '%';
      ghost.style.top = ((vv >> 3) * 12.5) + '%';
      ghost.innerHTML = global.Pieces.svg(m.captured);
      this.piecesEl.insertBefore(ghost, this.piecesEl.firstChild);
      setTimeout(function () { if (ghost.parentNode) ghost.parentNode.removeChild(ghost); }, 320);
    }
    pairs.forEach(function (pr) {
      var el = self.pieceEls[pr[1]];
      if (!el) return;
      var a = self._vis(pr[0]), b = self._vis(pr[1]);
      var dx = ((a & 7) - (b & 7)) * 100, dy = ((a >> 3) - (b >> 3)) * 100;
      el.style.transition = 'none';
      el.style.transform = 'translate(' + dx + '%,' + dy + '%)';
      el.classList.add('moving');
      void el.offsetWidth; // paksa reflow
      el.style.transition = '';
      el.style.transform = '';
      setTimeout(function () { el.classList.remove('moving'); }, 260);
    });
  };

  // ---------- Interaksi ----------
  BoardView.prototype._sqFromPoint = function (x, y) {
    var r = this.el.getBoundingClientRect();
    var col = Math.floor((x - r.left) / r.width * 8), row = Math.floor((y - r.top) / r.height * 8);
    if (col < 0 || col > 7 || row < 0 || row > 7) return -1;
    var v = row * 8 + col;
    return this.orientation === 'w' ? v : 63 - v;
  };

  BoardView.prototype._isTarget = function (sq) {
    for (var i = 0; i < this.targets.length; i++) if (this.targets[i].to === sq) return true;
    return false;
  };

  BoardView.prototype._ownPiece = function (sq) {
    var p = this.chess && this.chess.board[sq];
    if (!p) return false;
    var color = p < 'a' ? 'w' : 'b';
    return color === this.chess.turn && this.canMove(color);
  };

  BoardView.prototype._down = function (e) {
    if (!this.chess || (e.button !== undefined && e.button > 0)) return;
    var sq = this._sqFromPoint(e.clientX, e.clientY);
    if (sq < 0) return;
    if (this.selected >= 0 && this._isTarget(sq)) {
      var from = this.selected;
      this.deselect();
      this.onMove(from, sq, { dragged: false });
      return;
    }
    if (this._ownPiece(sq)) {
      var wasSelected = this.selected === sq;
      if (!wasSelected) this.select(sq);
      var el = this.pieceEls[sq];
      this.drag = { sq: sq, x: e.clientX, y: e.clientY, el: el, active: false, wasSelected: wasSelected, id: e.pointerId };
      try { this.el.setPointerCapture(e.pointerId); } catch (err) { /* abaikan */ }
      e.preventDefault();
    } else {
      this.deselect();
    }
  };

  BoardView.prototype._moveDrag = function (e) {
    var d = this.drag;
    if (!d || !d.el) return;
    var dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.active && Math.abs(dx) + Math.abs(dy) > 6) {
      d.active = true;
      d.el.classList.add('dragging');
    }
    if (d.active) {
      d.el.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(1.15)';
      var over = this._sqFromPoint(e.clientX, e.clientY);
      if (this._overSq !== over) {
        if (this._overEl) this._overEl.classList.remove('drag-over');
        this._overSq = over;
        this._overEl = null;
        if (over >= 0) {
          this._overEl = this.squares[this._vis(over)];
          this._overEl.classList.add('drag-over');
        }
      }
    }
  };

  BoardView.prototype._clearOver = function () {
    if (this._overEl) this._overEl.classList.remove('drag-over');
    this._overEl = null; this._overSq = -1;
  };

  BoardView.prototype._up = function (e) {
    var d = this.drag;
    this.drag = null;
    this._clearOver();
    if (!d) return;
    try { this.el.releasePointerCapture(d.id); } catch (err) { /* abaikan */ }
    if (d.active) {
      var to = this._sqFromPoint(e.clientX, e.clientY);
      if (to >= 0 && to !== d.sq && this._isTarget(to)) {
        this.deselect();
        this.onMove(d.sq, to, { dragged: true });
      } else {
        d.el.classList.remove('dragging');
        d.el.style.transform = '';
      }
    } else if (d.wasSelected) {
      this.deselect();   // ketuk bidak yang sama lagi → batal pilih
    }
  };

  BoardView.prototype._cancelDrag = function () {
    var d = this.drag;
    this.drag = null;
    this._clearOver();
    if (d && d.el) { d.el.classList.remove('dragging'); d.el.style.transform = ''; }
  };

  global.BoardView = BoardView;
})(window);
