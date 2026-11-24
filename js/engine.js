/*
 * engine.js — Logika aturan catur
 * ------------------------------------------------------------
 * Representasi papan: array 64 kotak, indeks 0 = a8, 7 = h8, 56 = a1, 63 = h1.
 * Bidak: huruf besar = Putih (P N B R Q K), huruf kecil = Hitam (p n b r q k).
 * Mendukung: semua langkah sah, rokade, en passant, promosi,
 * deteksi skak / skakmat / remis (pat, pengulangan 3x, 50 langkah,
 * bidak tidak cukup), notasi SAN, FEN, undo.
 * Tidak bergantung pada DOM, sehingga bisa diuji di Node.js.
 */
(function (global) {
  'use strict';

  var START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  // Bit hak rokade
  var WK = 1, WQ = 2, BK = 4, BQ = 8;

  // Kotak penting
  var A8 = 0, H8 = 7, A1 = 56, H1 = 63, E1 = 60, E8 = 4;

  function fileOf(sq) { return sq & 7; }
  function rankRow(sq) { return sq >> 3; }
  function sqName(sq) { return 'abcdefgh'.charAt(sq & 7) + (8 - (sq >> 3)); }
  function sqIndex(name) {
    if (typeof name === 'number') return name;
    if (!/^[a-h][1-8]$/.test(name)) return -1;
    return (8 - parseInt(name.charAt(1), 10)) * 8 + (name.charCodeAt(0) - 97);
  }
  function colorOf(p) { return p < 'a' ? 'w' : 'b'; }
  function typeOf(p) { return p.toLowerCase(); }
  function opposite(c) { return c === 'w' ? 'b' : 'w'; }
  function isLightSquare(sq) { return ((sq >> 3) + (sq & 7)) % 2 === 0; }

  // ---------- Tabel lompatan & arah (dihitung sekali) ----------
  function buildJumps(offsets) {
    var table = [];
    for (var sq = 0; sq < 64; sq++) {
      var r = sq >> 3, f = sq & 7, list = [];
      for (var i = 0; i < offsets.length; i++) {
        var nr = r + offsets[i][0], nf = f + offsets[i][1];
        if (nr >= 0 && nr < 8 && nf >= 0 && nf < 8) list.push(nr * 8 + nf);
      }
      table.push(list);
    }
    return table;
  }
  function buildRays(dirs) {
    // rays[sq] = array of arrays (satu per arah)
    var table = [];
    for (var sq = 0; sq < 64; sq++) {
      var r = sq >> 3, f = sq & 7, perDir = [];
      for (var d = 0; d < dirs.length; d++) {
        var ray = [], nr = r + dirs[d][0], nf = f + dirs[d][1];
        while (nr >= 0 && nr < 8 && nf >= 0 && nf < 8) {
          ray.push(nr * 8 + nf);
          nr += dirs[d][0]; nf += dirs[d][1];
        }
        perDir.push(ray);
      }
      table.push(perDir);
    }
    return table;
  }
  var KNIGHT = buildJumps([[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]);
  var KING = buildJumps([[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]);
  var DIAG = buildRays([[-1, -1], [-1, 1], [1, -1], [1, 1]]);
  var ORTHO = buildRays([[-1, 0], [1, 0], [0, -1], [0, 1]]);

  // ---------- Kelas utama ----------
  function Chess(fen) {
    this.load(fen || START_FEN);
  }

  Chess.START_FEN = START_FEN;
  Chess.sqName = sqName;
  Chess.sqIndex = sqIndex;
  Chess.colorOf = colorOf;
  Chess.typeOf = typeOf;
  Chess.isLightSquare = isLightSquare;

  /** Memuat posisi dari FEN. Mengembalikan true bila berhasil. */
  Chess.prototype.load = function (fen) {
    var parts = String(fen).trim().split(/\s+/);
    if (parts.length < 2) parts.push('w');
    var rows = parts[0].split('/');
    if (rows.length !== 8) return false;
    var board = new Array(64).fill(null);
    for (var r = 0; r < 8; r++) {
      var f = 0;
      for (var i = 0; i < rows[r].length; i++) {
        var ch = rows[r].charAt(i);
        if (/[1-8]/.test(ch)) { f += parseInt(ch, 10); }
        else if (/[pnbrqkPNBRQK]/.test(ch)) { if (f > 7) return false; board[r * 8 + f] = ch; f++; }
        else return false;
      }
      if (f !== 8) return false;
    }
    this.board = board;
    this.turn = parts[1] === 'b' ? 'b' : 'w';
    var c = parts[2] || '-';
    this.castling = (c.indexOf('K') >= 0 ? WK : 0) | (c.indexOf('Q') >= 0 ? WQ : 0) |
                    (c.indexOf('k') >= 0 ? BK : 0) | (c.indexOf('q') >= 0 ? BQ : 0);
    this.ep = (parts[3] && parts[3] !== '-') ? sqIndex(parts[3]) : -1;
    this.halfmove = parseInt(parts[4], 10) || 0;
    this.fullmove = parseInt(parts[5], 10) || 1;
    this.kingSq = { w: board.indexOf('K'), b: board.indexOf('k') };
    this._sanitizeCastling();
    this.startFen = this.fen();
    this.stack = [];          // catatan untuk undo
    this.moveList = [];       // langkah-langkah yang sudah dimainkan (dengan SAN)
    this.posKeys = [this.positionKey()];
    return true;
  };

  /** Hapus hak rokade yang tidak mungkin (raja/benteng tidak di tempatnya). */
  Chess.prototype._sanitizeCastling = function () {
    var b = this.board;
    if (b[E1] !== 'K') this.castling &= ~(WK | WQ);
    if (b[H1] !== 'R') this.castling &= ~WK;
    if (b[A1] !== 'R') this.castling &= ~WQ;
    if (b[E8] !== 'k') this.castling &= ~(BK | BQ);
    if (b[H8] !== 'r') this.castling &= ~BK;
    if (b[A8] !== 'r') this.castling &= ~BQ;
  };

  Chess.prototype.clone = function () {
    var c = new Chess(this.startFen);
    for (var i = 0; i < this.moveList.length; i++) {
      var m = this.moveList[i];
      c.move({ from: m.from, to: m.to, promotion: m.promotion });
    }
    return c;
  };

  Chess.prototype.get = function (sq) { return this.board[sqIndex(sq)]; };

  Chess.prototype.fen = function () {
    var out = '';
    for (var r = 0; r < 8; r++) {
      var empty = 0;
      for (var f = 0; f < 8; f++) {
        var p = this.board[r * 8 + f];
        if (!p) { empty++; continue; }
        if (empty) { out += empty; empty = 0; }
        out += p;
      }
      if (empty) out += empty;
      if (r < 7) out += '/';
    }
    var c = (this.castling & WK ? 'K' : '') + (this.castling & WQ ? 'Q' : '') +
            (this.castling & BK ? 'k' : '') + (this.castling & BQ ? 'q' : '');
    return out + ' ' + this.turn + ' ' + (c || '-') + ' ' +
      (this.ep >= 0 ? sqName(this.ep) : '-') + ' ' + this.halfmove + ' ' + this.fullmove;
  };

  /**
   * Kunci posisi untuk deteksi pengulangan: susunan bidak, giliran,
   * hak rokade, dan kotak en passant (hanya jika en passant benar-benar bisa dilakukan).
   */
  Chess.prototype.positionKey = function () {
    var s = '';
    for (var i = 0; i < 64; i++) s += this.board[i] || '.';
    var ep = '-';
    if (this.ep >= 0) {
      var moves = this._legal();
      for (var j = 0; j < moves.length; j++) if (moves[j].ep) { ep = sqName(this.ep); break; }
    }
    return s + this.turn + this.castling + ep;
  };

  // ---------- Deteksi serangan ----------
  /** Apakah kotak sq diserang oleh warna `by`? */
  Chess.prototype.isAttacked = function (sq, by) {
    var b = this.board, r = sq >> 3, f = sq & 7, i, t, p;
    // Pion
    if (by === 'w') {
      if (r < 7) {
        if (f > 0 && b[sq + 7] === 'P') return true;
        if (f < 7 && b[sq + 9] === 'P') return true;
      }
    } else {
      if (r > 0) {
        if (f > 0 && b[sq - 9] === 'p') return true;
        if (f < 7 && b[sq - 7] === 'p') return true;
      }
    }
    var N = by === 'w' ? 'N' : 'n', K = by === 'w' ? 'K' : 'k';
    var B = by === 'w' ? 'B' : 'b', R = by === 'w' ? 'R' : 'r', Q = by === 'w' ? 'Q' : 'q';
    var kn = KNIGHT[sq];
    for (i = 0; i < kn.length; i++) if (b[kn[i]] === N) return true;
    var kg = KING[sq];
    for (i = 0; i < kg.length; i++) if (b[kg[i]] === K) return true;
    var rays = DIAG[sq];
    for (var d = 0; d < 4; d++) {
      var ray = rays[d];
      for (i = 0; i < ray.length; i++) {
        p = b[ray[i]];
        if (p) { if (p === B || p === Q) return true; break; }
      }
    }
    rays = ORTHO[sq];
    for (d = 0; d < 4; d++) {
      ray = rays[d];
      for (i = 0; i < ray.length; i++) {
        p = b[ray[i]];
        if (p) { if (p === R || p === Q) return true; break; }
      }
    }
    return false;
  };

  /** Daftar kotak bidak warna `by` yang menyerang kotak sq. */
  Chess.prototype.attackersOf = function (sq, by) {
    var b = this.board, r = sq >> 3, f = sq & 7, out = [], i, p;
    if (by === 'w') {
      if (r < 7) {
        if (f > 0 && b[sq + 7] === 'P') out.push(sq + 7);
        if (f < 7 && b[sq + 9] === 'P') out.push(sq + 9);
      }
    } else if (r > 0) {
      if (f > 0 && b[sq - 9] === 'p') out.push(sq - 9);
      if (f < 7 && b[sq - 7] === 'p') out.push(sq - 7);
    }
    var N = by === 'w' ? 'N' : 'n', K = by === 'w' ? 'K' : 'k';
    var B = by === 'w' ? 'B' : 'b', R = by === 'w' ? 'R' : 'r', Q = by === 'w' ? 'Q' : 'q';
    KNIGHT[sq].forEach(function (s) { if (b[s] === N) out.push(s); });
    KING[sq].forEach(function (s) { if (b[s] === K) out.push(s); });
    [[DIAG, B], [ORTHO, R]].forEach(function (pair) {
      var rays = pair[0][sq];
      for (var d = 0; d < 4; d++) {
        for (i = 0; i < rays[d].length; i++) {
          p = b[rays[d][i]];
          if (p) { if (p === pair[1] || p === Q) out.push(rays[d][i]); break; }
        }
      }
    });
    return out;
  };

  Chess.prototype.inCheck = function (color) {
    color = color || this.turn;
    var k = this.kingSq[color];
    return k >= 0 && this.isAttacked(k, opposite(color));
  };

  // ---------- Pembuatan langkah ----------
  function mk(from, to, piece, captured, extra) {
    var m = { from: from, to: to, piece: piece, captured: captured || null, promotion: null, ep: false, castle: null, double: false };
    if (extra) for (var k in extra) m[k] = extra[k];
    return m;
  }

  /** Langkah semu (belum dicek apakah raja sendiri terkena skak). */
  Chess.prototype._pseudo = function (capturesOnly) {
    var b = this.board, us = this.turn, them = opposite(us), moves = [];
    var isOwn = us === 'w' ? function (p) { return p < 'a'; } : function (p) { return p >= 'a'; };
    for (var sq = 0; sq < 64; sq++) {
      var p = b[sq];
      if (!p || !isOwn(p)) continue;
      var t = typeOf(p), i, to, q;
      if (t === 'p') {
        var dir = us === 'w' ? -8 : 8;
        var startRow = us === 'w' ? 6 : 1;
        var promoRow = us === 'w' ? 0 : 7;
        var r = sq >> 3, f = sq & 7;
        to = sq + dir;
        if (to >= 0 && to < 64 && !b[to]) {
          if ((to >> 3) === promoRow) pushPromos(moves, sq, to, p, null, us);
          else if (!capturesOnly) {
            moves.push(mk(sq, to, p));
            if (r === startRow && !b[to + dir]) moves.push(mk(sq, to + dir, p, null, { double: true }));
          }
        }
        var caps = [];
        if (f > 0) caps.push(to - 1);
        if (f < 7) caps.push(to + 1);
        for (i = 0; i < caps.length; i++) {
          var c = caps[i];
          if (c < 0 || c > 63) continue;
          if (b[c] && colorOf(b[c]) === them) {
            if ((c >> 3) === promoRow) pushPromos(moves, sq, c, p, b[c], us);
            else moves.push(mk(sq, c, p, b[c]));
          } else if (c === this.ep && !b[c]) {
            var capSq = c - dir;
            var expected = us === 'w' ? 'p' : 'P';
            if (b[capSq] === expected) moves.push(mk(sq, c, p, expected, { ep: true }));
          }
        }
      } else if (t === 'n' || t === 'k') {
        var targets = t === 'n' ? KNIGHT[sq] : KING[sq];
        for (i = 0; i < targets.length; i++) {
          to = targets[i]; q = b[to];
          if (!q) { if (!capturesOnly) moves.push(mk(sq, to, p)); }
          else if (colorOf(q) === them) moves.push(mk(sq, to, p, q));
        }
        if (t === 'k' && !capturesOnly) this._castles(sq, us, moves);
      } else {
        var sets = t === 'b' ? [DIAG] : t === 'r' ? [ORTHO] : [DIAG, ORTHO];
        for (var s = 0; s < sets.length; s++) {
          var rays = sets[s][sq];
          for (var d = 0; d < 4; d++) {
            var ray = rays[d];
            for (i = 0; i < ray.length; i++) {
              to = ray[i]; q = b[to];
              if (!q) { if (!capturesOnly) moves.push(mk(sq, to, p)); }
              else { if (colorOf(q) === them) moves.push(mk(sq, to, p, q)); break; }
            }
          }
        }
      }
    }
    return moves;
  };

  function pushPromos(moves, from, to, piece, captured, us) {
    var list = us === 'w' ? ['Q', 'R', 'B', 'N'] : ['q', 'r', 'b', 'n'];
    for (var i = 0; i < 4; i++) moves.push(mk(from, to, piece, captured, { promotion: list[i] }));
  }

  Chess.prototype._castles = function (sq, us, moves) {
    var b = this.board, them = opposite(us);
    if (us === 'w' && sq === E1) {
      if ((this.castling & WK) && b[H1] === 'R' && !b[61] && !b[62] &&
          !this.isAttacked(E1, them) && !this.isAttacked(61, them) && !this.isAttacked(62, them))
        moves.push(mk(E1, 62, 'K', null, { castle: 'k' }));
      if ((this.castling & WQ) && b[A1] === 'R' && !b[59] && !b[58] && !b[57] &&
          !this.isAttacked(E1, them) && !this.isAttacked(59, them) && !this.isAttacked(58, them))
        moves.push(mk(E1, 58, 'K', null, { castle: 'q' }));
    } else if (us === 'b' && sq === E8) {
      if ((this.castling & BK) && b[H8] === 'r' && !b[5] && !b[6] &&
          !this.isAttacked(E8, them) && !this.isAttacked(5, them) && !this.isAttacked(6, them))
        moves.push(mk(E8, 6, 'k', null, { castle: 'k' }));
      if ((this.castling & BQ) && b[A8] === 'r' && !b[3] && !b[2] && !b[1] &&
          !this.isAttacked(E8, them) && !this.isAttacked(3, them) && !this.isAttacked(2, them))
        moves.push(mk(E8, 2, 'k', null, { castle: 'q' }));
    }
  };

  /** Jalankan langkah tanpa pengecekan (dipakai juga oleh AI). */
  Chess.prototype._make = function (m) {
    var b = this.board, us = this.turn;
    this.stack.push({ castling: this.castling, ep: this.ep, halfmove: this.halfmove, fullmove: this.fullmove });
    b[m.from] = null;
    b[m.to] = m.promotion || m.piece;
    if (m.ep) b[m.to + (us === 'w' ? 8 : -8)] = null;
    if (m.castle) {
      if (us === 'w') {
        if (m.castle === 'k') { b[H1] = null; b[61] = 'R'; } else { b[A1] = null; b[59] = 'R'; }
      } else {
        if (m.castle === 'k') { b[H8] = null; b[5] = 'r'; } else { b[A8] = null; b[3] = 'r'; }
      }
    }
    var t = typeOf(m.piece);
    if (t === 'k') {
      this.kingSq[us] = m.to;
      this.castling &= us === 'w' ? ~(WK | WQ) : ~(BK | BQ);
    }
    // Benteng bergerak atau dimakan → hak rokade hilang
    if (m.from === H1 || m.to === H1) this.castling &= ~WK;
    if (m.from === A1 || m.to === A1) this.castling &= ~WQ;
    if (m.from === H8 || m.to === H8) this.castling &= ~BK;
    if (m.from === A8 || m.to === A8) this.castling &= ~BQ;
    this.ep = m.double ? (m.from + m.to) / 2 : -1;
    this.halfmove = (t === 'p' || m.captured) ? 0 : this.halfmove + 1;
    if (us === 'b') this.fullmove++;
    this.turn = opposite(us);
  };

  Chess.prototype._unmake = function (m) {
    var b = this.board, st = this.stack.pop();
    this.turn = opposite(this.turn);
    var us = this.turn;
    this.castling = st.castling; this.ep = st.ep; this.halfmove = st.halfmove; this.fullmove = st.fullmove;
    b[m.from] = m.piece;
    b[m.to] = null;
    if (m.ep) b[m.to + (us === 'w' ? 8 : -8)] = m.captured;
    else if (m.captured) b[m.to] = m.captured;
    if (m.castle) {
      if (us === 'w') {
        if (m.castle === 'k') { b[61] = null; b[H1] = 'R'; } else { b[59] = null; b[A1] = 'R'; }
      } else {
        if (m.castle === 'k') { b[5] = null; b[H8] = 'r'; } else { b[3] = null; b[A8] = 'r'; }
      }
    }
    if (typeOf(m.piece) === 'k') this.kingSq[us] = m.from;
  };

  /** Langkah sah: langkah semu yang tidak membuat raja sendiri terkena skak. */
  Chess.prototype._legal = function (capturesOnly) {
    var us = this.turn, them = opposite(us);
    var pseudo = this._pseudo(capturesOnly), out = [];
    for (var i = 0; i < pseudo.length; i++) {
      var m = pseudo[i];
      this._make(m);
      var k = this.kingSq[us];
      if (k < 0 || !this.isAttacked(k, them)) out.push(m);
      this._unmake(m);
    }
    return out;
  };

  /**
   * Daftar langkah sah. opts.square (mis. 'e2' atau indeks) membatasi ke satu kotak asal.
   * Setiap langkah berisi from/to (indeks), piece, captured, promotion, dll.
   */
  Chess.prototype.moves = function (opts) {
    var list = this._legal();
    if (opts && opts.square !== undefined) {
      var s = sqIndex(opts.square);
      list = list.filter(function (m) { return m.from === s; });
    }
    return list;
  };

  // ---------- Notasi SAN ----------
  var LETTER = { n: 'N', b: 'B', r: 'R', q: 'Q', k: 'K' };

  Chess.prototype._san = function (m, legal) {
    var san;
    if (m.castle) san = m.castle === 'k' ? 'O-O' : 'O-O-O';
    else {
      var t = typeOf(m.piece);
      if (t === 'p') {
        san = m.captured ? sqName(m.from).charAt(0) + 'x' : '';
        san += sqName(m.to);
        if (m.promotion) san += '=' + m.promotion.toUpperCase();
      } else {
        san = LETTER[t];
        var others = legal.filter(function (o) {
          return o.piece === m.piece && o.to === m.to && o.from !== m.from;
        });
        if (others.length) {
          var sameFile = others.some(function (o) { return fileOf(o.from) === fileOf(m.from); });
          var sameRank = others.some(function (o) { return rankRow(o.from) === rankRow(m.from); });
          if (!sameFile) san += sqName(m.from).charAt(0);
          else if (!sameRank) san += sqName(m.from).charAt(1);
          else san += sqName(m.from);
        }
        if (m.captured) san += 'x';
        san += sqName(m.to);
      }
    }
    this._make(m);
    if (this.inCheck()) san += this._legal().length === 0 ? '#' : '+';
    this._unmake(m);
    return san;
  };

  function cleanSan(s) { return String(s).replace(/[+#?!]/g, '').replace(/0/g, 'O'); }

  /**
   * Jalankan langkah. Input: {from:'e2', to:'e4', promotion:'q'} atau string SAN ('Nf3', 'O-O')
   * atau UCI ('e2e4', 'e7e8q'). Mengembalikan objek langkah (dengan .san) atau null bila tidak sah.
   */
  Chess.prototype.move = function (input) {
    var legal = this._legal(), m = null, i;
    if (typeof input === 'string') {
      var uci = input.match(/^([a-h][1-8])([a-h][1-8])([qrbn])?$/);
      if (uci) input = { from: uci[1], to: uci[2], promotion: uci[3] };
    }
    if (typeof input === 'string') {
      var target = cleanSan(input);
      for (i = 0; i < legal.length; i++) {
        if (cleanSan(this._san(legal[i], legal)) === target) { m = legal[i]; break; }
      }
    } else if (input) {
      var from = sqIndex(input.from), to = sqIndex(input.to);
      var promo = input.promotion ? String(input.promotion).toLowerCase() : null;
      for (i = 0; i < legal.length; i++) {
        var l = legal[i];
        if (l.from !== from || l.to !== to) continue;
        if (l.promotion) {
          if ((promo || 'q') === typeOf(l.promotion)) { m = l; break; }
        } else { m = l; break; }
      }
    }
    if (!m) return null;
    m.san = this._san(m, legal);
    m.color = this.turn;
    m.fenBefore = this.fen();
    this._make(m);
    this.moveList.push(m);
    this.posKeys.push(this.positionKey());
    return m;
  };

  Chess.prototype.undo = function () {
    var m = this.moveList.pop();
    if (!m) return null;
    this._unmake(m);
    this.posKeys.pop();
    return m;
  };

  Chess.prototype.history = function () {
    return this.moveList.map(function (m) { return m.san; });
  };

  Chess.prototype.lastMove = function () {
    return this.moveList.length ? this.moveList[this.moveList.length - 1] : null;
  };

  // ---------- Status permainan ----------
  Chess.prototype.isCheckmate = function () { return this.inCheck() && this._legal().length === 0; };
  Chess.prototype.isStalemate = function () { return !this.inCheck() && this._legal().length === 0; };
  Chess.prototype.isFiftyMove = function () { return this.halfmove >= 100; };

  Chess.prototype.repetitionCount = function () {
    var key = this.posKeys[this.posKeys.length - 1], n = 0;
    for (var i = 0; i < this.posKeys.length; i++) if (this.posKeys[i] === key) n++;
    return n;
  };
  Chess.prototype.isThreefold = function () { return this.repetitionCount() >= 3; };

  /** Bidak tidak cukup untuk skakmat (posisi mati). */
  Chess.prototype.isInsufficientMaterial = function () {
    var minors = [], bishopsColors = [], knights = 0;
    for (var sq = 0; sq < 64; sq++) {
      var p = this.board[sq];
      if (!p) continue;
      var t = typeOf(p);
      if (t === 'k') continue;
      if (t === 'p' || t === 'r' || t === 'q') return false;
      minors.push(t);
      if (t === 'b') bishopsColors.push(isLightSquare(sq));
      else knights++;
    }
    if (minors.length === 0) return true;          // Raja vs Raja
    if (minors.length === 1) return true;          // Raja + 1 bidak ringan vs Raja
    if (knights === 0) {                            // Semua gajah di warna kotak yang sama
      return bishopsColors.every(function (c) { return c === bishopsColors[0]; });
    }
    return false;
  };

  /** Apakah warna `color` masih punya bahan untuk men-skakmat (dipakai saat waktu habis). */
  Chess.prototype.hasMatingMaterial = function (color) {
    var minors = 0, bishopsColors = [], knights = 0;
    for (var sq = 0; sq < 64; sq++) {
      var p = this.board[sq];
      if (!p || colorOf(p) !== color) continue;
      var t = typeOf(p);
      if (t === 'p' || t === 'r' || t === 'q') return true;
      if (t === 'n') { knights++; minors++; }
      if (t === 'b') { bishopsColors.push(isLightSquare(sq)); minors++; }
    }
    if (minors < 2) return false;
    if (knights === 0) return !bishopsColors.every(function (c) { return c === bishopsColors[0]; });
    return true;
  };

  /**
   * Status permainan: {over, result, reason, winner}
   * reason: 'checkmate' | 'stalemate' | 'threefold' | 'fifty' | 'insufficient'
   */
  Chess.prototype.status = function () {
    var legal = this._legal();
    var check = this.inCheck();
    if (legal.length === 0) {
      if (check) {
        var winner = opposite(this.turn);
        return { over: true, reason: 'checkmate', winner: winner, result: winner === 'w' ? '1-0' : '0-1', check: true };
      }
      return { over: true, reason: 'stalemate', winner: null, result: '1/2-1/2', check: false };
    }
    if (this.isInsufficientMaterial()) return { over: true, reason: 'insufficient', winner: null, result: '1/2-1/2', check: check };
    if (this.isThreefold()) return { over: true, reason: 'threefold', winner: null, result: '1/2-1/2', check: check };
    if (this.isFiftyMove()) return { over: true, reason: 'fifty', winner: null, result: '1/2-1/2', check: check };
    return { over: false, reason: null, winner: null, result: '*', check: check };
  };

  /** Nilai materi sederhana (pion = 1). */
  Chess.VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  Chess.prototype.material = function (color) {
    var sum = 0;
    for (var sq = 0; sq < 64; sq++) {
      var p = this.board[sq];
      if (p && colorOf(p) === color) sum += Chess.VALUE[typeOf(p)];
    }
    return sum;
  };

  /** Ubah huruf bidak SAN internasional ke notasi Indonesia (R=Raja, M=Menteri, B=Benteng, G=Gajah, K=Kuda). */
  Chess.localizeSan = function (san, style) {
    if (style !== 'id') return san;
    var map = { K: 'R', Q: 'M', R: 'B', B: 'G', N: 'K' };
    return san.replace(/[KQRBN]/g, function (c) { return map[c]; });
  };

  /** Hitung jumlah simpul (untuk pengujian kebenaran generator langkah). */
  Chess.prototype.perft = function (depth) {
    if (depth === 0) return 1;
    var moves = this._legal(), n = 0;
    if (depth === 1) return moves.length;
    for (var i = 0; i < moves.length; i++) {
      this._make(moves[i]);
      n += this.perft(depth - 1);
      this._unmake(moves[i]);
    }
    return n;
  };

  global.Chess = Chess;
  if (typeof module !== 'undefined' && module.exports) module.exports = Chess;
})(typeof window !== 'undefined' ? window : globalThis);
