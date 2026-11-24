/*
 * ai.js — Kecerdasan buatan komputer
 * ------------------------------------------------------------
 * Negamax (bentuk ringkas minimax) dengan alpha-beta pruning,
 * iterative deepening, quiescence search, pengurutan langkah MVV-LVA
 * dan killer move. Evaluasi: materi + tabel posisi bidak.
 * Juga berisi: penjelasan langkah komputer, deteksi bidak "gratis",
 * dan pemecah teka-teki skakmat.
 */
(function (global) {
  'use strict';
  var Chess = global.Chess || (typeof require !== 'undefined' ? require('./engine.js') : null);

  var VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  var MATE = 100000;

  // Tabel posisi (sudut pandang Putih, indeks 0 = a8)
  var PST = {
    p: [0, 0, 0, 0, 0, 0, 0, 0,
      50, 50, 50, 50, 50, 50, 50, 50,
      10, 10, 20, 30, 30, 20, 10, 10,
      5, 5, 10, 25, 25, 10, 5, 5,
      0, 0, 0, 20, 20, 0, 0, 0,
      5, -5, -10, 0, 0, -10, -5, 5,
      5, 10, 10, -20, -20, 10, 10, 5,
      0, 0, 0, 0, 0, 0, 0, 0],
    n: [-50, -40, -30, -30, -30, -30, -40, -50,
      -40, -20, 0, 0, 0, 0, -20, -40,
      -30, 0, 10, 15, 15, 10, 0, -30,
      -30, 5, 15, 20, 20, 15, 5, -30,
      -30, 0, 15, 20, 20, 15, 0, -30,
      -30, 5, 10, 15, 15, 10, 5, -30,
      -40, -20, 0, 5, 5, 0, -20, -40,
      -50, -40, -30, -30, -30, -30, -40, -50],
    b: [-20, -10, -10, -10, -10, -10, -10, -20,
      -10, 0, 0, 0, 0, 0, 0, -10,
      -10, 0, 5, 10, 10, 5, 0, -10,
      -10, 5, 5, 10, 10, 5, 5, -10,
      -10, 0, 10, 10, 10, 10, 0, -10,
      -10, 10, 10, 10, 10, 10, 10, -10,
      -10, 5, 0, 0, 0, 0, 5, -10,
      -20, -10, -10, -10, -10, -10, -10, -20],
    r: [0, 0, 0, 0, 0, 0, 0, 0,
      5, 10, 10, 10, 10, 10, 10, 5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      0, 0, 0, 5, 5, 0, 0, 0],
    q: [-20, -10, -10, -5, -5, -10, -10, -20,
      -10, 0, 0, 0, 0, 0, 0, -10,
      -10, 0, 5, 5, 5, 5, 0, -10,
      -5, 0, 5, 5, 5, 5, 0, -5,
      0, 0, 5, 5, 5, 5, 0, -5,
      -10, 5, 5, 5, 5, 5, 0, -10,
      -10, 0, 5, 0, 0, 0, 0, -10,
      -20, -10, -10, -5, -5, -10, -10, -20],
    k: [-30, -40, -40, -50, -50, -40, -40, -30,
      -30, -40, -40, -50, -50, -40, -40, -30,
      -30, -40, -40, -50, -50, -40, -40, -30,
      -30, -40, -40, -50, -50, -40, -40, -30,
      -20, -30, -30, -40, -40, -30, -30, -20,
      -10, -20, -20, -20, -20, -20, -20, -10,
      20, 20, 0, 0, 0, 0, 20, 20,
      20, 30, 10, 0, 0, 10, 30, 20],
    kEnd: [-50, -40, -30, -20, -20, -30, -40, -50,
      -30, -20, -10, 0, 0, -10, -20, -30,
      -30, -10, 20, 30, 30, 20, -10, -30,
      -30, -10, 30, 40, 40, 30, -10, -30,
      -30, -10, 30, 40, 40, 30, -10, -30,
      -30, -10, 20, 30, 30, 20, -10, -30,
      -30, -30, 0, 0, 0, 0, -30, -30,
      -50, -30, -30, -30, -30, -30, -30, -50]
  };

  /** Evaluasi posisi dari sudut pandang pemain yang mendapat giliran. */
  function evaluate(chess) {
    var b = chess.board, score = 0, nonPawn = 0, sq, p;
    for (sq = 0; sq < 64; sq++) {
      p = b[sq];
      if (p && p !== 'k' && p !== 'K' && p !== 'p' && p !== 'P') nonPawn += VAL[p.toLowerCase()];
    }
    var endgame = nonPawn <= 2600;
    var wk = -1, bk = -1;
    for (sq = 0; sq < 64; sq++) {
      p = b[sq];
      if (!p) continue;
      var white = p < 'a', t = white ? p.toLowerCase() : p;
      var idx = white ? sq : (sq ^ 56);
      var table = (t === 'k' && endgame) ? PST.kEnd : PST[t];
      var v = VAL[t] + table[idx];
      if (white) score += v; else score -= v;
      if (p === 'K') wk = sq; else if (p === 'k') bk = sq;
    }
    // Di akhir permainan: dorong raja lawan ke pinggir dan dekatkan raja sendiri (membantu skakmat)
    if (endgame && wk >= 0 && bk >= 0) {
      var diff = score;
      if (Math.abs(diff) > 200) {
        var loser = diff > 0 ? bk : wk, winner = diff > 0 ? wk : bk;
        var lr = loser >> 3, lf = loser & 7;
        var edge = Math.max(3 - lr, lr - 4) + Math.max(3 - lf, lf - 4);
        var dist = Math.abs((winner >> 3) - lr) + Math.abs((winner & 7) - lf);
        var bonus = edge * 10 + (14 - dist) * 4;
        score += diff > 0 ? bonus : -bonus;
      }
    }
    return chess.turn === 'w' ? score : -score;
  }

  // ---------- Pencarian ----------
  function Searcher(chess, opts) {
    this.chess = chess;
    this.deadline = Date.now() + (opts.timeMs || 1000);
    this.nodes = 0;
    this.stopped = false;
    this.killers = [];
    this.history = {};
    // Posisi yang sudah pernah muncul di permainan (untuk menghindari / mengenali remis pengulangan)
    this.seen = {};
    var keys = chess.posKeys || [];
    for (var i = 0; i < keys.length; i++) this.seen[keys[i]] = (this.seen[keys[i]] || 0) + 1;
  }

  function moveKey(m) { return m.from * 64 + m.to; }

  Searcher.prototype.order = function (moves, ply, pvMove) {
    var killers = this.killers[ply] || [], hist = this.history;
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i], s = 0;
      if (pvMove && m.from === pvMove.from && m.to === pvMove.to && m.promotion === pvMove.promotion) s = 1e7;
      else if (m.captured) s = 1e6 + VAL[m.captured.toLowerCase()] * 10 - VAL[m.piece.toLowerCase()] / 10;
      else if (m.promotion) s = 9e5 + VAL[m.promotion.toLowerCase()];
      else if (killers[0] && killers[0] === moveKey(m)) s = 8e5;
      else if (killers[1] && killers[1] === moveKey(m)) s = 7e5;
      else s = hist[moveKey(m)] || 0;
      m._s = s;
    }
    moves.sort(function (a, b) { return b._s - a._s; });
    return moves;
  };

  Searcher.prototype.timeUp = function () {
    if ((++this.nodes & 1023) === 0 && Date.now() > this.deadline) this.stopped = true;
    return this.stopped;
  };

  Searcher.prototype.quiesce = function (alpha, beta, ply) {
    if (this.timeUp()) return 0;
    var c = this.chess;
    var stand = evaluate(c);
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    if (ply > 40) return stand;
    var us = c.turn, them = us === 'w' ? 'b' : 'w';
    var moves = this.order(c._pseudo(true), ply, null);
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i];
      // Delta pruning: tangkapan yang jelas tidak bisa memperbaiki alpha dilewati
      if (!m.promotion && stand + VAL[m.captured.toLowerCase()] + 200 < alpha) continue;
      c._make(m);
      if (c.kingSq[us] >= 0 && c.isAttacked(c.kingSq[us], them)) { c._unmake(m); continue; }
      var score = -this.quiesce(-beta, -alpha, ply + 1);
      c._unmake(m);
      if (this.stopped) return 0;
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  };

  Searcher.prototype.search = function (depth, alpha, beta, ply) {
    if (this.timeUp()) return 0;
    var c = this.chess;
    if (ply > 0 && c.halfmove >= 100) return 0;
    var us = c.turn, them = us === 'w' ? 'b' : 'w';
    var inCheck = c.kingSq[us] >= 0 && c.isAttacked(c.kingSq[us], them);
    if (inCheck && ply < 20) depth++;               // perpanjangan skak
    if (depth <= 0) return this.quiesce(alpha, beta, ply);

    var moves = this.order(c._pseudo(false), ply, null);
    var legal = 0, best = -MATE * 2;
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i];
      c._make(m);
      if (c.kingSq[us] >= 0 && c.isAttacked(c.kingSq[us], them)) { c._unmake(m); continue; }
      legal++;
      var score;
      if (ply < 2 && this.seen[c.positionKey()] >= 2) score = 0;   // akan jadi pengulangan 3x
      else score = -this.search(depth - 1, -beta, -alpha, ply + 1);
      c._unmake(m);
      if (this.stopped) return 0;
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) {
        if (!m.captured) {
          var k = this.killers[ply] || (this.killers[ply] = []);
          var key = moveKey(m);
          if (k[0] !== key) { k[1] = k[0]; k[0] = key; }
          this.history[key] = (this.history[key] || 0) + depth * depth;
        }
        break;
      }
    }
    if (legal === 0) return inCheck ? -MATE + ply : 0;
    return best;
  };

  /** Nilai semua langkah di akar pada kedalaman tertentu. */
  Searcher.prototype.rootScores = function (moves, depth) {
    var c = this.chess, results = [];
    var alpha = -MATE * 2;
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i];
      c._make(m);
      var score;
      if (this.seen[c.positionKey()] >= 2) score = 0;
      else score = -this.search(depth - 1, -MATE * 2, this.fullWindow ? MATE * 2 : -alpha, 1);
      c._unmake(m);
      if (this.stopped) return null;
      results.push({ move: m, score: score });
      if (!this.fullWindow && score > alpha) alpha = score;
    }
    return results;
  };

  var LEVELS = {
    1: { name: 'Pemula', maxDepth: 1, timeMs: 400, noise: 140, blunder: 0.12 },
    2: { name: 'Menengah', maxDepth: 3, timeMs: 900, noise: 25, blunder: 0 },
    3: { name: 'Sulit', maxDepth: 7, timeMs: 2500, noise: 0, blunder: 0 },
    hint: { name: 'Petunjuk', maxDepth: 6, timeMs: 1500, noise: 0, blunder: 0 }
  };

  /**
   * Cari langkah terbaik untuk pemain yang mendapat giliran.
   * level: 1 (Pemula), 2 (Menengah), 3 (Sulit), atau 'hint'.
   * Mengembalikan {move, score, depth} — move berisi from/to/promotion (indeks).
   */
  function findBestMove(chess, level, overrides) {
    var cfg = Object.assign({}, LEVELS[level] || LEVELS[2], overrides || {});
    var work = new Chess(chess.fen());
    work.posKeys = chess.posKeys.slice();
    var moves = work._legal();
    if (!moves.length) return null;
    if (moves.length === 1) return { move: moves[0], score: 0, depth: 0 };

    if (cfg.blunder && Math.random() < cfg.blunder) {
      return { move: moves[Math.floor(Math.random() * moves.length)], score: 0, depth: 0 };
    }

    var s = new Searcher(work, cfg);
    var best = null, bestDepth = 0, scored = null;
    var ordered = s.order(moves.slice(), 0, null);
    for (var depth = 1; depth <= cfg.maxDepth; depth++) {
      s.fullWindow = cfg.noise > 0;     // butuh nilai akurat semua langkah agar acak-terkendali adil
      var res = s.rootScores(ordered, depth);
      if (!res) break;                  // waktu habis: pakai hasil kedalaman sebelumnya
      scored = res;
      bestDepth = depth;
      res.sort(function (a, b) { return b.score - a.score; });
      ordered = res.map(function (r) { return r.move; });
      if (res[0].score >= MATE - 100) break;              // skakmat ditemukan
      if (Date.now() > s.deadline - (cfg.timeMs * 0.45)) break; // tidak cukup waktu utk kedalaman berikutnya
    }
    if (!scored) {
      scored = ordered.map(function (m) { return { move: m, score: 0 }; });
    }
    if (cfg.noise) {
      var top = scored[0].score;
      var pick = null, pickScore = -Infinity;
      for (var i = 0; i < scored.length; i++) {
        if (scored[i].score < top - cfg.noise * 3) continue;
        var noisy = scored[i].score + (Math.random() * 2 - 1) * cfg.noise;
        if (scored[i].score >= MATE - 100) noisy += 1e6;  // jangan lewatkan skakmat
        if (noisy > pickScore) { pickScore = noisy; pick = scored[i]; }
      }
      best = pick || scored[0];
    } else {
      best = scored[0];
    }
    return { move: best.move, score: best.score, depth: bestDepth, nodes: s.nodes };
  }

  // ---------- Bahasa Indonesia ----------
  var NAMES = { p: 'pion', n: 'kuda', b: 'gajah', r: 'benteng', q: 'menteri', k: 'raja' };
  function pname(p) { return NAMES[p.toLowerCase()]; }

  /** Apakah kotak sq dilindungi oleh warna color (abaikan bidak di kotak itu). */
  function defended(chess, sq, color) { return chess.isAttacked(sq, color); }

  /**
   * Buat kalimat penjelasan untuk langkah komputer.
   * chess = posisi SEBELUM langkah, move = objek langkah sah.
   * who = 'Komputer' (atau nama lain), victimOwner = 'Anda'.
   */
  function explainMove(chess, move, who, victimOwner) {
    who = who || 'Komputer';
    victimOwner = victimOwner || 'Anda';
    var c = new Chess(chess.fen());
    var us = c.turn, them = us === 'w' ? 'b' : 'w';
    var from = Chess.sqName(move.from), to = Chess.sqName(move.to);
    var piece = pname(move.piece);
    // Apakah bidak ini sedang diserang sebelum bergerak?
    var wasThreatened = c.attackersOf(move.from, them).length > 0 &&
      (!defended(c, move.from, us) || c.attackersOf(move.from, them).some(function (s) {
        return VAL[c.board[s].toLowerCase()] < VAL[move.piece.toLowerCase()];
      }));
    var legal = c._legal(), m = null;
    for (var i = 0; i < legal.length; i++) {
      if (legal[i].from === move.from && legal[i].to === move.to && legal[i].promotion === move.promotion) { m = legal[i]; break; }
    }
    if (!m) return who + ' melangkah.';
    c._make(m);
    var check = c.inCheck();
    var mate = check && c._legal().length === 0;
    var text;

    if (mate) {
      return 'Skakmat! ' + who + ' memindahkan ' + piece + ' ke ' + to + ' dan raja ' + victimOwner + ' tidak bisa lolos lagi.';
    }
    if (m.castle) {
      text = who + ' melakukan rokade ' + (m.castle === 'k' ? 'pendek' : 'panjang') + ' untuk mengamankan raja dan mengaktifkan benteng';
    } else if (m.promotion) {
      text = who + ' mempromosikan pion menjadi ' + pname(m.promotion) + (m.captured ? ' sambil memakan ' + pname(m.captured) + ' ' + victimOwner : '');
    } else if (m.ep) {
      text = who + ' memakan pion ' + victimOwner + ' secara en passant';
    } else if (m.captured) {
      var capDef = defended(c, m.to, them);
      text = who + ' memakan ' + pname(m.captured) + ' ' + victimOwner + ' di ' + to + ' dengan ' + piece;
      if (!capDef && VAL[m.captured.toLowerCase()] >= 300) text += ' — bidak itu tidak terlindungi';
      else if (VAL[m.captured.toLowerCase()] < VAL[m.piece.toLowerCase()] && capDef) text += ' (pertukaran)';
    } else {
      // Bidak lawan yang diserang dari kotak baru
      var targets = [];
      // Hitung serangan bidak yang baru bergerak: giliran dibalik sementara
      c.turn = us;
      var caps = c._pseudo(true).filter(function (x) { return x.from === m.to; });
      c.turn = them;
      for (var j = 0; j < caps.length; j++) {
        var victim = caps[j].captured, vsq = caps[j].to;
        if (victim.toLowerCase() === 'k') continue;
        var vDef = defended(c, vsq, them);
        if (!vDef || VAL[victim.toLowerCase()] > VAL[m.piece.toLowerCase()]) targets.push(victim);
      }
      targets.sort(function (a, b) { return VAL[b.toLowerCase()] - VAL[a.toLowerCase()]; });
      if (targets.length >= 2) {
        text = who + ' memindahkan ' + piece + ' ke ' + to + ' untuk menyerang ' + pname(targets[0]) + ' dan ' + pname(targets[1]) + ' ' + victimOwner + ' sekaligus';
      } else if (targets.length === 1) {
        text = who + ' memindahkan ' + piece + ' ke ' + to + ' untuk menyerang ' + pname(targets[0]) + ' ' + victimOwner;
      } else if (wasThreatened) {
        text = who + ' menyelamatkan ' + piece + ' dari serangan dengan memindahkannya ke ' + to;
      } else if ((m.piece.toLowerCase() === 'n' || m.piece.toLowerCase() === 'b') &&
                 ((us === 'w' && from.charAt(1) === '1') || (us === 'b' && from.charAt(1) === '8'))) {
        text = who + ' mengembangkan ' + piece + ' ke ' + to + ' agar lebih aktif';
      } else if (m.piece.toLowerCase() === 'p' && 'cdef'.indexOf(to.charAt(0)) >= 0 && c.fullmove <= 12) {
        text = who + ' memajukan pion ke ' + to + ' untuk menguasai pusat papan';
      } else if (m.piece.toLowerCase() === 'p') {
        text = who + ' memajukan pion ke ' + to;
      } else {
        text = who + ' memindahkan ' + piece + ' ke ' + to + ' untuk memperbaiki posisinya';
      }
    }
    if (check) text += ', sekaligus memberi skak!';
    else text += '.';
    return text;
  }

  // ---------- Bidak tergantung / dimakan gratis ----------
  /**
   * Cari bidak warna `color` yang bisa dimakan "gratis" (tidak dilindungi, atau penyerangnya lebih murah).
   * Posisi: giliran lawan dari `color`. Mengembalikan daftar {sq, piece, gain}.
   */
  function hangingPieces(chess, color) {
    var out = [], best = {};
    if (chess.turn === color) return out;
    var caps = chess._legal(true);
    for (var i = 0; i < caps.length; i++) {
      var m = caps[i];
      if (!m.captured || m.ep) continue;
      var v = VAL[m.captured.toLowerCase()];
      if (m.captured.toLowerCase() === 'k') continue;
      var attackerV = VAL[m.piece.toLowerCase()] || 10000;
      // Apakah kotak tujuan dilindungi bidak sendiri? Cek setelah tangkapan dilakukan
      chess._make(m);
      var prot = chess.isAttacked(m.to, color);
      chess._unmake(m);
      var gain = prot ? v - attackerV : v;
      if (gain > 50 && (!best[m.to] || best[m.to].gain < gain)) best[m.to] = { sq: m.to, piece: m.captured, gain: gain };
    }
    for (var k in best) out.push(best[k]);
    out.sort(function (a, b) { return b.gain - a.gain; });
    return out;
  }

  /**
   * Periksa apakah langkah `move` (posisi sebelum langkah = chess) membuat bidak sendiri bisa dimakan gratis.
   * Mengembalikan null bila aman, atau {sq, piece, gain} untuk peringatan.
   */
  function blunderCheck(chess, move) {
    var color = chess.turn, them = color === 'w' ? 'b' : 'w';
    var c = new Chess(chess.fen());
    // Bidak yang SUDAH tergantung sebelum langkah (dengan "langkah kosong")
    var before = {};
    if (!c.inCheck()) {
      var saveEp = c.ep;
      c.turn = them; c.ep = -1;
      hangingPieces(c, color).forEach(function (h) { before[h.sq] = h.gain; });
      c.turn = color; c.ep = saveEp;
    }
    var m = c.move({ from: move.from, to: move.to, promotion: move.promotion });
    if (!m) return null;
    if (c.isCheckmate()) return null;
    var gained = m.captured ? VAL[m.captured.toLowerCase()] : 0;
    var list = hangingPieces(c, color);
    for (var i = 0; i < list.length; i++) {
      var h = list[i];
      var isMoved = h.sq === move.to;
      var wasHanging = !isMoved && before[h.sq] !== undefined && before[h.sq] >= h.gain;
      if (wasHanging) continue;
      if (h.gain - gained > 50) return h;
    }
    return null;
  }

  // ---------- Pemecah teka-teki skakmat ----------
  /** Langkah-langkah yang langsung skakmat. */
  function matingMoves(chess) {
    var c = new Chess(chess.fen());
    return c._legal().filter(function (m) {
      c._make(m);
      var mate = c.inCheck() && c._legal().length === 0;
      c._unmake(m);
      return mate;
    });
  }

  /** Apakah pemain yang melangkah bisa memaksa skakmat dalam n langkah (n = 1 atau 2)? Mengembalikan langkah pertama atau null. */
  function forcedMate(chess, n) {
    var c = new Chess(chess.fen());
    var moves = c._legal();
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i];
      c._make(m);
      var ok = mateAfter(c, n - 1);
      c._unmake(m);
      if (ok) return m;
    }
    return null;
  }
  // Setelah langkah kita (giliran lawan): apakah skakmat paksa dengan sisa n langkah kita?
  function mateAfter(c, n) {
    var replies = c._legal();
    if (replies.length === 0) return c.inCheck();
    if (n <= 0) return false;
    for (var i = 0; i < replies.length; i++) {
      c._make(replies[i]);
      var found = false, ours = c._legal();
      for (var j = 0; j < ours.length && !found; j++) {
        c._make(ours[j]);
        if (mateAfter(c, n - 1)) found = true;
        c._unmake(ours[j]);
      }
      c._unmake(replies[i]);
      if (!found) return false;
    }
    return true;
  }

  var AI = {
    evaluate: evaluate,
    findBestMove: findBestMove,
    explainMove: explainMove,
    blunderCheck: blunderCheck,
    hangingPieces: hangingPieces,
    matingMoves: matingMoves,
    forcedMate: forcedMate,
    mateAfter: function (chess, n) { return mateAfter(new Chess(chess.fen()), n); },
    LEVELS: LEVELS,
    PIECE_NAMES: NAMES,
    MATE: MATE
  };
  global.CaturAI = AI;
  if (typeof module !== 'undefined' && module.exports) module.exports = AI;
})(typeof window !== 'undefined' ? window : globalThis);
