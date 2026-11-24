/*
 * app.js — Pengendali permainan & antarmuka
 * ------------------------------------------------------------
 * Mode: lawan komputer / dua pemain, jam catur, petunjuk, undo,
 * riwayat langkah, bidak yang dimakan, peringatan bidak gratis,
 * pengaturan (tema, mode gelap, suara), dan simpan otomatis.
 */
(function () {
  'use strict';

  var Chess = window.Chess, AI = window.CaturAI, Pieces = window.Pieces, Sound = window.Sound;
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  // ---------- Penyimpanan (localStorage) ----------
  var Store = {
    get: function (k, def) {
      try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; }
    },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* penuh / diblokir */ } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* abaikan */ } }
  };
  var KEY_GAME = 'catur.game.v1', KEY_SETTINGS = 'catur.settings.v1';

  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  var settings = Object.assign(
    { board: 'wood', dark: prefersDark, sound: true, warn: true, autoFlip: true, notation: 'intl' },
    Store.get(KEY_SETTINGS, {})
  );

  var COLOR_NAME = { w: 'Putih', b: 'Hitam' };
  var LEVEL_NAME = { 1: 'Pemula', 2: 'Menengah', 3: 'Sulit' };

  // ---------- Utilitas antarmuka ----------
  var toastTimer = null;
  function toast(msg, ms) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, ms || 2600);
  }

  function openModal(id) { $(id).hidden = false; }
  function closeModal(id) { $(id).hidden = true; }

  /** Dialog umum. buttons: [{label, value, primary}] → Promise(value) */
  var dialogResolve = null;
  function dialog(opts) {
    $('#dlgTitle').textContent = opts.title || '';
    $('#dlgBody').innerHTML = opts.html || '';
    var act = $('#dlgActions');
    act.innerHTML = '';
    return new Promise(function (resolve) {
      dialogResolve = resolve;
      (opts.buttons || [{ label: 'OK', value: true, primary: true }]).forEach(function (b) {
        var btn = document.createElement('button');
        btn.className = 'btn' + (b.primary ? ' primary' : '');
        btn.textContent = b.label;
        btn.addEventListener('click', function () {
          closeModal('#modalDialog');
          dialogResolve = null;
          resolve(b.value);
        });
        act.appendChild(btn);
      });
      openModal('#modalDialog');
      var primary = act.querySelector('.primary') || act.querySelector('button');
      if (primary) primary.focus();
    });
  }

  /** Pilih bidak promosi → Promise('q'|'r'|'b'|'n'|null) */
  var promoResolve = null;
  function askPromotion(color) {
    var grid = $('#promoGrid');
    grid.innerHTML = '';
    return new Promise(function (resolve) {
      promoResolve = resolve;
      ['q', 'r', 'b', 'n'].forEach(function (t) {
        var p = color === 'w' ? t.toUpperCase() : t;
        var btn = document.createElement('button');
        btn.innerHTML = Pieces.svg(p) + '<span>' + Pieces.name(p) + '</span>';
        btn.addEventListener('click', function () { closeModal('#modalPromo'); promoResolve = null; resolve(t); });
        grid.appendChild(btn);
      });
      openModal('#modalPromo');
    });
  }
  $('#modalPromo').addEventListener('click', function (e) {
    var cancel = e.target.closest('[data-promo]');
    if (e.target === this || cancel) {
      closeModal('#modalPromo');
      if (promoResolve) { var r = promoResolve; promoResolve = null; r(null); }
    }
  });

  function fmtTime(ms) {
    ms = Math.max(0, ms);
    if (ms < 10000) {
      var s = Math.floor(ms / 1000), t = Math.floor((ms % 1000) / 100);
      return '0:0' + s + '.' + t;
    }
    var total = Math.ceil(ms / 1000);
    var m = Math.floor(total / 60), sec = total % 60;
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  // ---------- Pengaturan ----------
  function applySettings() {
    var root = document.documentElement;
    root.dataset.theme = settings.dark ? 'dark' : 'light';
    root.dataset.board = settings.board;
    Sound.setEnabled(settings.sound);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', settings.dark ? '#1f2228' : '#2f7d4f');
    Store.set(KEY_SETTINGS, settings);
  }

  function syncSettingsForm() {
    setSeg('#modalSettings [data-name="board"]', settings.board);
    setSeg('#modalSettings [data-name="notation"]', settings.notation);
    $('#optDark').checked = settings.dark;
    $('#optSound').checked = settings.sound;
    $('#optWarn').checked = settings.warn;
    $('#optFlip').checked = settings.autoFlip;
  }

  function setSeg(sel, value) {
    $$(sel + ' button').forEach(function (b) { b.classList.toggle('on', b.dataset.value === String(value)); });
  }
  function getSeg(sel) {
    var b = $(sel + ' button.on');
    return b ? b.dataset.value : null;
  }
  $$('.seg').forEach(function (seg) {
    seg.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      seg.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
      seg.dispatchEvent(new CustomEvent('segchange', { detail: b.dataset.value }));
    });
  });

  // ---------- Status permainan ----------
  var game = {
    chess: new Chess(),
    mode: 'ai',          // 'ai' | 'two'
    level: 2,
    human: 'w',
    clockMin: 0,
    clock: null,         // {w, b, last}
    over: null,          // objek status bila selesai
    aiThinking: false,
    aiToken: 0,
    note: null,          // {text, kind}
    hint: null
  };

  var board = new window.BoardView($('#board'), {
    onMove: function (from, to, info) { onUserMove(from, to, info); },
    canMove: function (color) {
      if (game.over || game.aiThinking) return false;
      return game.mode === 'two' || color === game.human;
    },
    onSelect: function () { Sound.unlock(); }
  });

  function cfgSnapshot() {
    return { mode: game.mode, level: game.level, humanChoice: game.humanChoice || game.human, clockMin: game.clockMin };
  }

  function newGame(cfg) {
    cfg = cfg || cfgSnapshot();
    game.aiToken++;
    game.aiThinking = false;
    game.mode = cfg.mode;
    game.level = +cfg.level;
    game.humanChoice = cfg.humanChoice;
    game.human = cfg.humanChoice === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : (cfg.humanChoice || 'w');
    if (game.mode === 'two') game.human = 'w';
    game.clockMin = +cfg.clockMin;
    game.clock = game.clockMin > 0 ? { w: game.clockMin * 60000, b: game.clockMin * 60000, last: Date.now() } : null;
    game.chess = new Chess();
    game.over = null;
    game.note = null;
    game.hint = null;
    board.hint = null;
    board.orientation = game.mode === 'ai' ? game.human : 'w';
    board.setPosition(game.chess, { lastMove: null });
    save();
    updateUI();
    maybeComputerMove();
  }

  // ---------- Jam catur ----------
  function commitClock() {
    var c = game.clock;
    if (!c || !c.last || game.over) return;
    var now = Date.now();
    c[game.chess.turn] -= now - c.last;
    c.last = now;
  }
  function clockRemaining(color) {
    var c = game.clock;
    if (!c) return 0;
    var v = c[color];
    if (c.last && !game.over && color === game.chess.turn) v -= Date.now() - c.last;
    return v;
  }
  function tick() {
    if (!game.clock || game.over) return;
    var turn = game.chess.turn;
    if (clockRemaining(turn) <= 0) { onTimeout(turn); return; }
    renderClocks();
  }
  function onTimeout(color) {
    commitClock();
    game.clock[color] = 0;
    game.aiToken++;
    game.aiThinking = false;
    var winner = color === 'w' ? 'b' : 'w';
    if (game.chess.hasMatingMaterial(winner)) {
      game.over = { over: true, reason: 'timeout', winner: winner, loser: color, result: winner === 'w' ? '1-0' : '0-1' };
    } else {
      game.over = { over: true, reason: 'timeout-draw', winner: null, loser: color, result: '1/2-1/2' };
    }
    board.deselect();
    Sound.play('end');
    save();
    updateUI();
    showGameOver();
  }
  setInterval(tick, 200);

  // ---------- Langkah ----------
  function onUserMove(from, to, info) {
    if (game.over || game.aiThinking) return;
    var chess = game.chess;
    var cands = chess.moves({ square: from }).filter(function (m) { return m.to === to; });
    if (!cands.length) return;
    var token = game.aiToken, ply = chess.moveList.length;
    var stillValid = function () { return token === game.aiToken && ply === game.chess.moveList.length && !game.over; };

    var promoP = cands[0].promotion ? askPromotion(chess.turn) : Promise.resolve(null);
    promoP.then(function (promo) {
      if (!stillValid()) return;
      if (cands[0].promotion && !promo) { board.render(); return; }
      var move = { from: from, to: to, promotion: promo };
      var warning = settings.warn ? AI.blunderCheck(chess, move) : null;
      if (!warning) return doMove(move, info);
      Sound.play('warn');
      board.setHint(-1);
      var name = Pieces.name(warning.piece).toLowerCase();
      var gratis = warning.gain >= AIValue(warning.piece) - 5;
      var html = '<p><b>' + capital(name) + ' Anda di ' + Chess.sqName(warning.sq) + '</b> ' +
        (gratis ? 'bisa dimakan lawan secara gratis (tidak ada yang melindungi).'
                : 'bisa dimakan oleh bidak lawan yang nilainya lebih rendah, sehingga Anda rugi materi.') + '</p>' +
        '<p class="muted">Peringatan ini bisa dimatikan di Pengaturan.</p>';
      dialog({
        title: 'Hati-hati!',
        html: html,
        buttons: [{ label: 'Batalkan langkah', value: false }, { label: 'Tetap jalankan', value: true, primary: true }]
      }).then(function (ok) {
        if (!stillValid()) return;
        if (ok) doMove(move, info);
        else board.render();
      });
    });
  }

  function AIValue(p) { return { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 }[p.toLowerCase()]; }
  function capital(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function doMove(move, info) {
    commitClock();
    var m = game.chess.move({ from: move.from, to: move.to, promotion: move.promotion });
    if (!m) return null;
    game.hint = null;
    board.hint = null;
    var st = game.chess.status();
    if (st.over) game.over = st;
    if (game.mode === 'two' && settings.autoFlip && !game.over) board.orientation = game.chess.turn;
    var anim = (info && info.dragged) ? Object.assign({}, m, { dragged: true }) : m;
    board.setPosition(game.chess, { animate: anim });
    Sound.forMove(m, st);
    if (!(info && info.byAI)) game.note = null;
    save();
    updateUI();
    if (game.over) setTimeout(showGameOver, 650);
    else maybeComputerMove();
    return m;
  }

  function maybeComputerMove() {
    if (game.mode !== 'ai' || game.over || game.chess.turn === game.human) return;
    game.aiThinking = true;
    updateUI();
    var token = ++game.aiToken;
    // Jeda singkat agar animasi langkah pemain selesai & teks "berpikir" tampil
    setTimeout(function () {
      if (token !== game.aiToken || game.over) return;
      var res = AI.findBestMove(game.chess, game.level);
      if (token !== game.aiToken || game.over) return;
      game.aiThinking = false;
      if (!res) { updateUI(); return; }
      var text = AI.explainMove(game.chess, res.move, 'Komputer', 'Anda');
      game.note = { text: text, kind: 'ai' };
      doMove({ from: res.move.from, to: res.move.to, promotion: res.move.promotion ? res.move.promotion.toLowerCase() : null }, { byAI: true });
    }, 420);
  }

  // ---------- Tombol ----------
  function undo() {
    var chess = game.chess;
    if (game.over && /timeout/.test(game.over.reason)) { toast('Waktu sudah habis — silakan mulai permainan baru.'); return; }
    if (game.mode === 'ai') {
      var humanMoves = chess.moveList.filter(function (m) { return m.color === game.human; }).length;
      if (!humanMoves) { toast('Belum ada langkah Anda untuk dibatalkan.'); return; }
    } else if (!chess.moveList.length) { toast('Belum ada langkah untuk dibatalkan.'); return; }
    if (!game.over) commitClock();
    game.aiToken++;
    game.aiThinking = false;
    chess.undo();
    if (game.mode === 'ai') {
      while (chess.turn !== game.human && chess.moveList.length) chess.undo();
    }
    game.over = null;
    if (game.clock) game.clock.last = Date.now();
    game.note = null;
    game.hint = null;
    board.hint = null;
    if (game.mode === 'two' && settings.autoFlip) board.orientation = chess.turn;
    board.setPosition(chess);
    save();
    updateUI();
    toast('Langkah dibatalkan');
  }

  function showHint() {
    if (game.over || game.aiThinking) return;
    if (game.mode === 'ai' && game.chess.turn !== game.human) return;
    var token = game.aiToken, ply = game.chess.moveList.length;
    $('#status').innerHTML = '<span class="spinner"></span>Mencari langkah terbaik…';
    $('#btnHint').disabled = true;
    setTimeout(function () {
      $('#btnHint').disabled = false;
      if (token !== game.aiToken || ply !== game.chess.moveList.length || game.over) { updateUI(); return; }
      var res = AI.findBestMove(game.chess, 'hint');
      if (!res) { updateUI(); return; }
      var m = res.move;
      var san = game.chess._san(m, game.chess._legal());
      game.hint = m;
      board.setHint(m.from, m.to);
      var text = 'Petunjuk: gerakkan ' + Pieces.name(m.piece).toLowerCase() + ' dari ' + Chess.sqName(m.from) +
        ' ke ' + Chess.sqName(m.to) + ' (' + Chess.localizeSan(san, settings.notation) + ').';
      if (m.castle) text = 'Petunjuk: lakukan rokade ' + (m.castle === 'k' ? 'pendek' : 'panjang') + ' (' + san + ').';
      if (res.score >= AI.MATE - 100) text += ' Langkah ini mengarah ke skakmat!';
      game.note = { text: text, kind: 'hint' };
      updateUI();
    }, 60);
  }

  function restart() {
    dialog({
      title: 'Mulai ulang?',
      html: '<p>Permainan saat ini akan dihapus dan dimulai dari awal dengan pengaturan yang sama.</p>',
      buttons: [{ label: 'Batal', value: false }, { label: 'Mulai ulang', value: true, primary: true }]
    }).then(function (ok) { if (ok) { newGame(); toast('Permainan dimulai ulang'); } });
  }

  // ---------- Tampilan ----------
  function overText(o) {
    var vsAI = game.mode === 'ai';
    var who = function (c) { return vsAI ? (c === game.human ? 'Anda' : 'Komputer') : COLOR_NAME[c]; };
    switch (o.reason) {
      case 'checkmate':
        return { title: vsAI ? (o.winner === game.human ? 'Anda menang! 🎉' : 'Komputer menang') : COLOR_NAME[o.winner] + ' menang!',
                 detail: 'Skakmat! Raja ' + COLOR_NAME[o.winner === 'w' ? 'b' : 'w'] + ' terkena skak dan tidak bisa lolos.' };
      case 'stalemate':
        return { title: 'Remis (pat)', detail: 'Pemain yang mendapat giliran tidak punya langkah sah, tetapi rajanya tidak sedang diskak.' };
      case 'threefold':
        return { title: 'Remis', detail: 'Posisi yang sama sudah terulang 3 kali.' };
      case 'fifty':
        return { title: 'Remis', detail: 'Aturan 50 langkah: 50 langkah berturut-turut tanpa memakan bidak atau menggerakkan pion.' };
      case 'insufficient':
        return { title: 'Remis', detail: 'Bidak yang tersisa tidak cukup untuk melakukan skakmat.' };
      case 'timeout':
        return { title: vsAI ? (o.winner === game.human ? 'Anda menang! 🎉' : 'Komputer menang') : COLOR_NAME[o.winner] + ' menang!',
                 detail: 'Waktu ' + (vsAI ? who(o.loser) : COLOR_NAME[o.loser]) + ' habis.' };
      case 'timeout-draw':
        return { title: 'Remis', detail: 'Waktu ' + COLOR_NAME[o.loser] + ' habis, tetapi lawan tidak punya cukup bidak untuk skakmat.' };
    }
    return { title: 'Permainan selesai', detail: '' };
  }

  function showGameOver() {
    if (!game.over) return;
    var t = overText(game.over);
    dialog({
      title: t.title,
      html: '<p>' + t.detail + '</p><p class="muted">Hasil: ' + game.over.result.replace('1/2-1/2', '½–½') + ' · ' + game.chess.moveList.length + ' langkah (ply)</p>',
      buttons: [{ label: 'Lihat papan', value: false }, { label: 'Main lagi', value: true, primary: true }]
    }).then(function (again) { if (again) openNewGame(); });
  }

  function updateUI() {
    var chess = game.chess;
    // Status
    var st = $('#status');
    st.className = 'status';
    if (game.over) {
      var t = overText(game.over);
      st.textContent = t.title + ' — ' + t.detail;
      st.classList.add('over');
    } else if (game.aiThinking) {
      st.innerHTML = '<span class="spinner"></span>Komputer sedang berpikir…';
    } else {
      var check = chess.inCheck();
      var whose = game.mode === 'ai'
        ? (chess.turn === game.human ? 'Giliran Anda (' + COLOR_NAME[chess.turn] + ')' : 'Giliran Komputer')
        : 'Giliran ' + COLOR_NAME[chess.turn];
      st.textContent = (check ? 'Skak! ' : '') + whose;
      if (check) st.classList.add('check');
    }
    // Catatan komputer / petunjuk
    var note = $('#aiNote');
    if (game.note) {
      note.hidden = false;
      note.textContent = game.note.text;
      note.className = 'note' + (game.note.kind === 'hint' ? ' hint' : '');
    } else note.hidden = true;

    // Tombol
    var humanTurn = game.mode === 'two' || chess.turn === game.human;
    $('#btnHint').disabled = !!game.over || game.aiThinking || !humanTurn;
    $('#btnUndo').disabled = chess.moveList.length === 0;

    // Info permainan
    var info = game.mode === 'ai' ? 'Lawan Komputer · ' + LEVEL_NAME[game.level] : 'Dua Pemain';
    if (game.clockMin) info += ' · ' + game.clockMin + ' mnt';
    $('#gameInfo').textContent = info;

    renderBars();
    renderHistory();
    renderClocks();
  }

  function renderBars() {
    var chess = game.chess;
    var bottom = board.orientation, top = bottom === 'w' ? 'b' : 'w';
    var captured = { w: [], b: [] };   // bidak yang dimakan OLEH warna tsb
    chess.moveList.forEach(function (m) { if (m.captured) captured[m.color].push(m.captured); });
    var diff = chess.material('w') - chess.material('b');
    var order = { q: 0, r: 1, b: 2, n: 3, p: 4 };
    [['#barTop', top], ['#barBottom', bottom]].forEach(function (pair) {
      var bar = $(pair[0]), color = pair[1];
      var name;
      if (game.mode === 'ai') name = color === game.human ? 'Anda' : 'Komputer (' + LEVEL_NAME[game.level] + ')';
      else name = COLOR_NAME[color];
      bar.querySelector('.pl-name').textContent = name;
      bar.querySelector('.pl-dot').className = 'pl-dot ' + color;
      bar.classList.toggle('active', !game.over && chess.turn === color);
      var list = captured[color].slice().sort(function (a, b) { return order[a.toLowerCase()] - order[b.toLowerCase()]; });
      var html = '', prev = null;
      list.forEach(function (p) {
        if (prev && prev.toLowerCase() !== p.toLowerCase()) html += '<span class="gap"></span>';
        html += '<span class="cap" title="' + Pieces.name(p) + '">' + Pieces.svg(p) + '</span>';
        prev = p;
      });
      var adv = color === 'w' ? diff : -diff;
      if (adv > 0) html += '<span class="diff" title="Selisih nilai materi">+' + adv + '</span>';
      bar.querySelector('.pl-captured').innerHTML = html;
      bar.dataset.color = color;
    });
  }

  function renderClocks() {
    [['#barTop'], ['#barBottom']].forEach(function (pair) {
      var bar = $(pair[0]);
      var el = bar.querySelector('.pl-clock');
      if (!game.clock) { el.hidden = true; return; }
      el.hidden = false;
      var color = bar.dataset.color;
      var ms = clockRemaining(color);
      el.textContent = fmtTime(ms);
      var running = !game.over && game.chess.turn === color;
      el.classList.toggle('running', running && ms >= 20000);
      el.classList.toggle('low', ms < 20000);
    });
  }

  var lastHistoryLen = -1, lastNotation = null;
  function renderHistory() {
    var list = game.chess.moveList;
    if (list.length === lastHistoryLen && lastNotation === settings.notation) return;
    lastHistoryLen = list.length; lastNotation = settings.notation;
    var el = $('#moveList');
    if (!list.length) { el.innerHTML = '<div class="empty">Belum ada langkah. Putih melangkah lebih dulu.</div>'; return; }
    var html = '';
    var startBlack = list[0].color === 'b';
    var moveNo = 1, i = 0;
    if (startBlack) { html += '<div class="num">1.</div><div class="mv">…</div>'; }
    for (i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.color === 'w') html += '<div class="num">' + moveNo + '.</div>';
      html += '<div class="mv' + (i === list.length - 1 ? ' current' : '') + '">' + Chess.localizeSan(m.san, settings.notation) + '</div>';
      if (m.color === 'b') moveNo++;
    }
    el.innerHTML = html;
    el.scrollTop = el.scrollHeight;
  }

  // ---------- Simpan otomatis ----------
  function save() {
    var data = {
      mode: game.mode, level: game.level, human: game.human, humanChoice: game.humanChoice,
      clockMin: game.clockMin,
      clock: game.clock ? { w: clockRemaining('w'), b: clockRemaining('b') } : null,
      startFen: game.chess.startFen,
      moves: game.chess.moveList.map(function (m) {
        return Chess.sqName(m.from) + Chess.sqName(m.to) + (m.promotion ? m.promotion.toLowerCase() : '');
      }),
      over: game.over && /timeout/.test(game.over.reason) ? game.over : null,
      orientation: board.orientation,
      note: game.note && game.note.kind === 'ai' ? game.note : null,
      savedAt: Date.now()
    };
    Store.set(KEY_GAME, data);
  }

  function load() {
    var d = Store.get(KEY_GAME, null);
    if (!d || !Array.isArray(d.moves)) return false;
    var chess = new Chess(d.startFen || Chess.START_FEN);
    for (var i = 0; i < d.moves.length; i++) {
      if (!chess.move(d.moves[i])) return false;
    }
    game.chess = chess;
    game.mode = d.mode === 'two' ? 'two' : 'ai';
    game.level = [1, 2, 3].indexOf(+d.level) >= 0 ? +d.level : 2;
    game.human = d.human === 'b' ? 'b' : 'w';
    game.humanChoice = d.humanChoice || game.human;
    game.clockMin = +d.clockMin || 0;
    game.clock = d.clock && game.clockMin ? { w: d.clock.w, b: d.clock.b, last: Date.now() } : null;
    var st = chess.status();
    game.over = d.over || (st.over ? st : null);
    game.note = d.note || null;
    board.orientation = d.orientation === 'b' ? 'b' : 'w';
    board.setPosition(chess);
    return true;
  }

  document.addEventListener('visibilitychange', function () { if (document.hidden) save(); });
  window.addEventListener('pagehide', save);

  // ---------- Jendela Permainan Baru ----------
  function openNewGame() {
    setSeg('#modalNew [data-name="mode"]', game.mode);
    setSeg('#modalNew [data-name="level"]', game.level);
    setSeg('#modalNew [data-name="color"]', game.humanChoice || game.human);
    setSeg('#modalNew [data-name="clock"]', game.clockMin);
    toggleAiFields();
    openModal('#modalNew');
  }
  function toggleAiFields() {
    var ai = getSeg('#modalNew [data-name="mode"]') === 'ai';
    $$('#modalNew .ai-only').forEach(function (f) { f.hidden = !ai; });
  }
  $('#modalNew [data-name="mode"]').addEventListener('segchange', toggleAiFields);
  $('#btnStart').addEventListener('click', function () {
    Sound.unlock();
    closeModal('#modalNew');
    switchView('play');
    newGame({
      mode: getSeg('#modalNew [data-name="mode"]') || 'ai',
      level: getSeg('#modalNew [data-name="level"]') || 2,
      humanChoice: getSeg('#modalNew [data-name="color"]') || 'w',
      clockMin: getSeg('#modalNew [data-name="clock"]') || 0
    });
  });

  // Tutup jendela (tombol [data-close] atau klik latar)
  $$('.modal').forEach(function (m) {
    if (m.id === 'modalDialog' || m.id === 'modalPromo') return;
    m.addEventListener('click', function (e) {
      if (e.target === m || e.target.closest('[data-close]')) closeModal('#' + m.id);
    });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    ['#modalNew', '#modalSettings'].forEach(function (id) { if (!$(id).hidden) closeModal(id); });
    if (!$('#modalPromo').hidden) $('#modalPromo [data-promo]').click();
  });

  // ---------- Jendela Pengaturan ----------
  $('#btnSettings').addEventListener('click', function () { syncSettingsForm(); openModal('#modalSettings'); });
  $('#modalSettings [data-name="board"]').addEventListener('segchange', function (e) { settings.board = e.detail; applySettings(); });
  $('#modalSettings [data-name="notation"]').addEventListener('segchange', function (e) { settings.notation = e.detail; applySettings(); updateUI(); });
  $('#optDark').addEventListener('change', function () { settings.dark = this.checked; applySettings(); });
  $('#optSound').addEventListener('change', function () { settings.sound = this.checked; applySettings(); if (this.checked) Sound.play('move'); });
  $('#optWarn').addEventListener('change', function () { settings.warn = this.checked; applySettings(); });
  $('#optFlip').addEventListener('change', function () {
    settings.autoFlip = this.checked; applySettings();
    if (game.mode === 'two' && settings.autoFlip && !game.over) { board.setOrientation(game.chess.turn); updateUI(); }
  });

  // ---------- Tombol permainan ----------
  $('#btnNew').addEventListener('click', openNewGame);
  $('#btnUndo').addEventListener('click', undo);
  $('#btnRestart').addEventListener('click', restart);
  $('#btnHint').addEventListener('click', showHint);
  $('#btnFlip').addEventListener('click', function () { board.flip(); updateUI(); save(); });

  // ---------- Tab Bermain / Belajar ----------
  var currentView = 'play';
  function switchView(view) {
    if (view === currentView) return;
    // Jam berhenti selama berada di mode belajar
    if (view === 'learn') { commitClock(); if (game.clock) game.clock.last = null; save(); }
    else if (game.clock) game.clock.last = Date.now();
    currentView = view;
    $$('.tab').forEach(function (t) {
      var on = t.dataset.view === view;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $('#playView').hidden = view !== 'play';
    $('#learnView').hidden = view !== 'learn';
    if (view === 'learn') window.Tutorial.open();
    else { board.render(); updateUI(); }
    window.scrollTo(0, 0);
  }
  $$('.tab').forEach(function (t) { t.addEventListener('click', function () { Sound.unlock(); switchView(t.dataset.view); }); });

  // ---------- Mulai ----------
  $('#brandLogo').innerHTML = Pieces.svg('N');
  applySettings();
  window.Tutorial.init({ dialog: dialog, toast: toast, askPromotion: askPromotion, settings: settings });

  if (load()) {
    updateUI();
    if (game.chess.moveList.length && !game.over) toast('Permainan sebelumnya dilanjutkan');
    maybeComputerMove();
  } else {
    newGame({ mode: 'ai', level: 2, humanChoice: 'w', clockMin: 0 });
    openNewGame();
  }

  // Untuk pengujian / debugging dari konsol
  window.CaturApp = { game: game, board: board, newGame: newGame, undo: undo, settings: settings, doMove: doMove };
})();
