/*
 * tutorial.js — Mode Belajar
 * ------------------------------------------------------------
 * Pelajaran bertahap (cara jalan tiap bidak, nilai bidak, rokade, en passant,
 * promosi, skak & skakmat, remis) dan teka-teki skakmat 1 & 2 langkah.
 * Setiap latihan punya tipe:
 *   stars  — kumpulkan semua bintang (hanya Putih yang bergerak)
 *   move   — mainkan langkah yang benar (answer berisi daftar UCI)
 *   check  — beri skak
 *   mate1  — skakmat dalam 1 langkah
 *   mate2  — skakmat dalam 2 langkah (komputer menjawab di antaranya)
 */
(function (global) {
  'use strict';
  var Chess = global.Chess, AI = global.CaturAI, Pieces = global.Pieces, Sound = global.Sound;

  function ico(p) { return '<span class="ico">' + Pieces.svg(p) + '</span>'; }

  // ================= DATA PELAJARAN =================
  var LESSONS = [
    // ---------- Dasar ----------
    {
      id: 'pion', group: 'Cara Jalan Bidak', title: 'Pion', sub: 'Maju lurus, makan miring',
      text: '<p>' + ico('P') + ' <b>Pion</b> berjalan <b>maju satu kotak</b> lurus ke depan. Pada langkah pertamanya, pion boleh maju <b>dua kotak</b> sekaligus.</p>' +
        '<p>Pion tidak bisa mundur, dan tidak bisa maju jika kotak di depannya terisi. Pion <b>memakan secara miring</b> (diagonal) satu kotak ke depan.</p>',
      tasks: [
        { fen: '8/8/8/8/8/8/4P3/8 w - - 0 1', type: 'stars', stars: ['e4'],
          prompt: 'Ketuk pion lalu ketuk kotak tujuan. Bawa pion ke bintang di e4 — dari posisi awal ia boleh maju dua kotak!' },
        { fen: '8/8/8/3pp3/4P3/8/8/8 w - - 0 1', type: 'move', answer: ['e4d5'],
          prompt: 'Pion di e4 terhalang pion e5. Makan pion hitam di d5 secara miring!',
          success: 'Tepat! Pion memakan secara diagonal.' }
      ]
    },
    {
      id: 'benteng', group: 'Cara Jalan Bidak', title: 'Benteng', sub: 'Lurus mendatar & tegak',
      text: '<p>' + ico('R') + ' <b>Benteng</b> berjalan lurus <b>mendatar atau tegak</b>, sejauh apa pun, selama tidak terhalang bidak lain.</p>',
      tasks: [
        { fen: '8/8/8/8/8/8/8/R7 w - - 0 1', type: 'stars', stars: ['a6', 'f6', 'f2'],
          prompt: 'Kumpulkan ketiga bintang dengan benteng.' }
      ]
    },
    {
      id: 'gajah', group: 'Cara Jalan Bidak', title: 'Gajah', sub: 'Miring (diagonal)',
      text: '<p>' + ico('B') + ' <b>Gajah</b> berjalan <b>miring (diagonal)</b> sejauh apa pun. Karena itu gajah selalu tetap di warna kotak yang sama sepanjang permainan.</p>',
      tasks: [
        { fen: '8/8/8/8/8/8/8/2B5 w - - 0 1', type: 'stars', stars: ['f4', 'd6', 'b8'],
          prompt: 'Kumpulkan semua bintang dengan gajah.' }
      ]
    },
    {
      id: 'kuda', group: 'Cara Jalan Bidak', title: 'Kuda', sub: 'Lompatan huruf "L"',
      text: '<p>' + ico('N') + ' <b>Kuda</b> bergerak membentuk huruf <b>"L"</b>: dua kotak lurus lalu satu kotak menyamping. ' +
        'Kuda adalah satu-satunya bidak yang bisa <b>melompati</b> bidak lain.</p>',
      tasks: [
        { fen: '8/8/8/8/8/8/PPPP4/1N6 w - - 0 1', type: 'stars', stars: ['c3', 'e4', 'f6'],
          prompt: 'Kumpulkan semua bintang dengan kuda. Perhatikan: kuda bisa melompati pion!' }
      ]
    },
    {
      id: 'menteri', group: 'Cara Jalan Bidak', title: 'Menteri', sub: 'Bidak terkuat',
      text: '<p>' + ico('Q') + ' <b>Menteri</b> (ratu) adalah bidak terkuat: ia bisa berjalan seperti benteng <b>dan</b> gajah — lurus atau miring, sejauh apa pun.</p>',
      tasks: [
        { fen: '8/8/8/8/8/8/8/3Q4 w - - 0 1', type: 'stars', stars: ['d5', 'h5', 'e8'],
          prompt: 'Kumpulkan semua bintang dengan menteri dalam 3 langkah.' }
      ]
    },
    {
      id: 'raja', group: 'Cara Jalan Bidak', title: 'Raja', sub: 'Satu kotak ke segala arah',
      text: '<p>' + ico('K') + ' <b>Raja</b> berjalan <b>satu kotak</b> ke segala arah. Raja adalah bidak terpenting: jika raja terkena skakmat, permainan berakhir.</p>' +
        '<p>Raja <b>tidak boleh</b> melangkah ke kotak yang sedang diserang lawan.</p>',
      tasks: [
        { fen: '8/8/8/8/8/8/8/4K3 w - - 0 1', type: 'stars', stars: ['e2', 'f3', 'g4'],
          prompt: 'Bawa raja mengumpulkan semua bintang.' },
        { fen: '3r4/8/8/8/8/8/8/4K3 w - - 0 1', type: 'stars', stars: ['f2'],
          prompt: 'Benteng hitam menguasai lajur d — perhatikan raja tidak bisa ke d1 atau d2. Bawa raja ke bintang di f2.' }
      ]
    },
    // ---------- Aturan ----------
    {
      id: 'nilai', group: 'Aturan Penting', title: 'Nilai Bidak', sub: 'Mana yang lebih berharga?',
      text: '<p>Setiap bidak punya perkiraan nilai. Gunakan ini untuk menilai apakah sebuah pertukaran menguntungkan:</p>' +
        '<table>' +
        '<tr><td>' + ico('P') + ' Pion</td><td>1</td></tr>' +
        '<tr><td>' + ico('N') + ' Kuda</td><td>3</td></tr>' +
        '<tr><td>' + ico('B') + ' Gajah</td><td>3</td></tr>' +
        '<tr><td>' + ico('R') + ' Benteng</td><td>5</td></tr>' +
        '<tr><td>' + ico('Q') + ' Menteri</td><td>9</td></tr>' +
        '<tr><td>' + ico('K') + ' Raja</td><td>tak ternilai</td></tr>' +
        '</table>',
      tasks: [
        { fen: '8/8/2q1r3/1p3b2/3N4/8/8/8 w - - 0 1', type: 'move', answer: ['d4c6'],
          prompt: 'Kuda Anda bisa memakan beberapa bidak. Makan bidak yang paling bernilai!',
          wrong: 'Masih ada bidak yang lebih bernilai. Coba lagi!',
          success: 'Benar! Menteri bernilai 9 — tangkapan terbaik.' }
      ]
    },
    {
      id: 'rokade', group: 'Aturan Penting', title: 'Rokade', sub: 'Mengamankan raja',
      text: '<p><b>Rokade</b> adalah langkah khusus raja dan benteng sekaligus: raja bergeser <b>dua kotak</b> ke arah benteng, lalu benteng melompat ke sisi seberang raja.</p>' +
        '<ul><li><b>Rokade pendek</b> (O-O): ke arah benteng h.</li><li><b>Rokade panjang</b> (O-O-O): ke arah benteng a.</li></ul>' +
        '<p>Syarat: raja dan benteng itu belum pernah bergerak, tidak ada bidak di antaranya, raja tidak sedang diskak, dan raja tidak melewati atau mendarat di kotak yang diserang.</p>',
      tasks: [
        { fen: 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1', type: 'move', answer: ['e1g1'],
          prompt: 'Lakukan rokade pendek: ketuk raja, lalu ketuk kotak g1.', success: 'Rokade pendek berhasil! Benteng pindah ke f1.' },
        { fen: 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1', type: 'move', answer: ['e1c1'],
          prompt: 'Sekarang lakukan rokade panjang: ketuk raja, lalu ketuk kotak c1.', success: 'Rokade panjang berhasil! Benteng pindah ke d1.' },
        { fen: '4k3/8/8/8/8/8/5r2/R3K2R w KQ - 0 1', type: 'move', answer: ['e1c1'],
          prompt: 'Benteng hitam menyerang kotak f1, jadi rokade pendek dilarang. Lakukan rokade yang masih diperbolehkan!',
          wrong: 'Bukan itu. Ketuk raja: hanya rokade ke arah c1 yang masih ditandai.',
          success: 'Tepat! Raja tidak boleh melewati kotak yang diserang, jadi hanya rokade panjang yang sah.' }
      ]
    },
    {
      id: 'enpassant', group: 'Aturan Penting', title: 'En Passant', sub: 'Makan pion "sambil lewat"',
      text: '<p><b>En passant</b> ("sambil lewat"): jika pion lawan maju <b>dua kotak</b> dan mendarat tepat di sebelah pion Anda, pion Anda boleh memakannya seolah-olah pion itu hanya maju satu kotak.</p>' +
        '<p>Kesempatan ini hanya ada <b>tepat pada langkah berikutnya</b>. Jika dilewatkan, hak itu hilang.</p>',
      tasks: [
        { fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', type: 'move', answer: ['e5d6'], lastMove: ['d7', 'd5'],
          prompt: 'Hitam baru saja memajukan pion d7 ke d5 (dua kotak). Makan pion itu secara en passant: pion e5 ke d6!',
          success: 'Hebat! Pion d5 dimakan secara en passant.' }
      ]
    },
    {
      id: 'promosi', group: 'Aturan Penting', title: 'Promosi', sub: 'Pion menjadi bidak baru',
      text: '<p>Jika pion berhasil mencapai <b>baris terakhir</b> di sisi lawan, pion itu wajib <b>dipromosikan</b> menjadi menteri, benteng, gajah, atau kuda.</p>' +
        '<p>Biasanya pilihan terbaik adalah <b>menteri</b>, karena paling kuat.</p>',
      tasks: [
        { fen: '4k3/1P6/8/8/8/8/8/4K3 w - - 0 1', type: 'move', answer: ['b7b8'],
          prompt: 'Majukan pion ke b8 lalu pilih bidak promosinya.', success: 'Promosi berhasil!' }
      ]
    },
    {
      id: 'skak', group: 'Aturan Penting', title: 'Skak & Skakmat', sub: 'Tujuan permainan',
      text: '<p><b>Skak</b>: raja sedang diserang. Pemain yang diskak <b>wajib</b> menyelamatkan rajanya dengan salah satu cara: memindahkan raja, menghalangi serangan, atau memakan bidak penyerang.</p>' +
        '<p><b>Skakmat</b>: raja diskak dan <b>tidak ada cara</b> untuk lolos. Pemain yang men-skakmat menang!</p>',
      tasks: [
        { fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1', type: 'check',
          prompt: 'Beri skak pada raja hitam dengan benteng.' },
        { fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', type: 'mate1',
          prompt: 'Raja hitam terkurung pion-pionnya sendiri. Berikan skakmat dalam 1 langkah!' }
      ]
    },
    {
      id: 'remis', group: 'Aturan Penting', title: 'Remis', sub: 'Pat, pengulangan, 50 langkah',
      text: '<p>Permainan berakhir <b>remis</b> (seri) jika:</p>' +
        '<ul><li><b>Pat</b> (stalemate): pemain yang mendapat giliran tidak punya langkah sah, tetapi rajanya <b>tidak</b> sedang diskak.</li>' +
        '<li>Posisi yang sama <b>terulang 3 kali</b>.</li>' +
        '<li><b>Aturan 50 langkah</b>: 50 langkah berturut-turut tanpa memakan bidak atau menggerakkan pion.</li>' +
        '<li><b>Bidak tidak cukup</b> untuk skakmat, misalnya raja lawan raja, atau raja + kuda lawan raja.</li></ul>',
      tasks: [
        { fen: 'k7/8/1K6/8/8/8/8/7Q w - - 0 1', type: 'mate1',
          prompt: 'Awas jebakan pat! Berikan skakmat dalam 1 langkah — jangan sampai raja hitam tidak bisa bergerak tanpa diskak.' }
      ]
    },
    // ---------- Teka-teki ----------
    {
      id: 'mat1', group: 'Teka-teki', title: 'Skakmat 1 Langkah', sub: '5 soal', puzzle: true,
      text: '<p>Putih melangkah. Temukan langkah yang langsung <b>skakmat</b>!</p><p class="muted">Tekan "Petunjuk" jika buntu.</p>',
      tasks: [
        { fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', type: 'mate1', prompt: 'Soal 1: Mat di baris belakang.' },
        { fen: '7k/8/6K1/8/8/8/8/5Q2 w - - 0 1', type: 'mate1', prompt: 'Soal 2: Menteri dan raja bekerja sama.' },
        { fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', type: 'mate1', prompt: 'Soal 3: Raja hitam terkurung bidaknya sendiri…' },
        { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', type: 'mate1', prompt: 'Soal 4: Kotak f7 hanya dijaga raja.' },
        { fen: '5rk1/5ppp/8/8/8/8/1B6/1K4Q1 w - - 0 1', type: 'mate1', prompt: 'Soal 5: Menteri dan gajah bersatu.' }
      ]
    },
    {
      id: 'mat2', group: 'Teka-teki', title: 'Skakmat 2 Langkah', sub: '3 soal', puzzle: true,
      text: '<p>Putih melangkah dan men-skakmat dalam <b>2 langkah</b>. Setelah langkah pertama Anda, komputer akan menjawab dengan pertahanan terbaiknya.</p>',
      tasks: [
        { fen: '6k1/8/8/8/8/8/R7/1R4K1 w - - 0 1', type: 'mate2', prompt: 'Soal 1: Dua benteng bekerja seperti tangga.' },
        { fen: '5r1k/6pp/7N/3Q4/8/8/8/6K1 w - - 0 1', type: 'mate2', prompt: 'Soal 2: Korbankan sesuatu agar kuda bisa beraksi!' },
        { fen: '4kb1r/p2n1ppp/4q3/4p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 0 1', type: 'mate2', prompt: 'Soal 3: Pengorbanan menteri yang terkenal.' }
      ]
    }
  ];

  // ================= PENGENDALI =================
  var deps = null, board = null;
  var KEY = 'catur.learn.v1';
  var progress = {};
  var state = { lesson: -1, task: 0, chess: null, stars: [], solved: false, busy: false, phase: 0, token: 0 };

  function $(s) { return document.querySelector(s); }
  function loadProgress() { try { progress = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { progress = {}; } }
  function saveProgress() { try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch (e) { /* abaikan */ } }

  function init(d) {
    deps = d;
    loadProgress();
    board = new global.BoardView($('#lessonBoard'), {
      onMove: onMove,
      canMove: function (color) { return color === 'w' && !state.solved && !state.busy; }
    });
    $('#btnLessonBack').addEventListener('click', function () { showList(); });
    $('#btnTaskReset').addEventListener('click', function () { loadTask(state.task); });
    $('#btnTaskHint').addEventListener('click', hint);
    $('#btnTaskNext').addEventListener('click', next);
    renderList();
  }

  function open() {
    renderList();
    if (state.lesson < 0) {
      // Buka pelajaran pertama yang belum selesai (di layar lebar); di HP tampilkan daftar dulu
      var first = 0;
      for (var i = 0; i < LESSONS.length; i++) if (!progress[LESSONS[i].id]) { first = i; break; }
      openLesson(first, true);
      showList();
    } else if (board.chess) {
      board.render();
    }
  }

  function showList() {
    var l = $('#learnLayout');
    l.classList.add('show-list'); l.classList.remove('show-lesson');
  }
  function showLesson() {
    var l = $('#learnLayout');
    l.classList.add('show-lesson'); l.classList.remove('show-list');
  }

  function renderList() {
    var el = $('#lessonList');
    var done = LESSONS.filter(function (l) { return progress[l.id]; }).length;
    var html = '<div class="learn-intro"><h2>Belajar Catur</h2><p>Selesai ' + done + ' dari ' + LESSONS.length + ' pelajaran.</p></div>';
    var group = null;
    LESSONS.forEach(function (l, i) {
      if (l.group !== group) { group = l.group; html += '<div class="lesson-group">' + group + '</div>'; }
      html += '<button class="lesson-item' + (progress[l.id] ? ' done' : '') + (i === state.lesson ? ' active' : '') + '" data-i="' + i + '">' +
        '<span class="li-num">' + (progress[l.id] ? '✓' : (i + 1)) + '</span>' +
        '<span><span class="li-title">' + l.title + '</span><br><span class="li-sub">' + l.sub + '</span></span></button>';
    });
    el.innerHTML = html;
    Array.prototype.forEach.call(el.querySelectorAll('.lesson-item'), function (b) {
      b.addEventListener('click', function () { Sound.unlock(); openLesson(+b.dataset.i); });
    });
  }

  function openLesson(i, silent) {
    state.lesson = i;
    var l = LESSONS[i];
    $('#lessonTitle').textContent = l.title;
    $('#lessonText').innerHTML = l.text;
    loadTask(0);
    renderList();
    if (!silent) { showLesson(); window.scrollTo(0, 0); }
  }

  function currentTask() { return LESSONS[state.lesson].tasks[state.task]; }

  function loadTask(ti) {
    state.token++;
    state.task = ti;
    state.solved = false;
    state.busy = false;
    state.phase = 0;
    var t = currentTask(), l = LESSONS[state.lesson];
    state.chess = new Chess(t.fen);
    state.stars = (t.stars || []).map(Chess.sqIndex);
    board.hint = null;
    board.markers = state.stars.slice();
    board.orientation = 'w';
    board.setPosition(state.chess, { lastMove: t.lastMove ? { from: Chess.sqIndex(t.lastMove[0]), to: Chess.sqIndex(t.lastMove[1]) } : null });
    $('#lessonProgress').textContent = (l.puzzle ? 'Soal ' : 'Latihan ') + (ti + 1) + ' dari ' + l.tasks.length;
    $('#taskPrompt').textContent = t.prompt;
    feedback('', '');
    $('#btnTaskNext').hidden = true;
    $('#btnTaskHint').disabled = false;
  }

  function feedback(text, kind) {
    var f = $('#taskFeedback');
    f.textContent = text;
    f.className = 'task-feedback' + (kind ? ' ' + kind : '');
  }

  /** Jalankan langkah di papan latihan (dengan animasi & suara). */
  function play(move, opts) {
    var m = state.chess.move({ from: move.from, to: move.to, promotion: move.promotion });
    if (!m) return null;
    var anim = opts && opts.dragged ? Object.assign({}, m, { dragged: true }) : m;
    board.hint = null;
    board.setPosition(state.chess, { animate: anim });
    var st = state.chess.status();
    Sound.forMove(m, { check: st.check, over: false });
    return m;
  }

  function wrong(text) {
    var token = state.token;
    state.busy = true;
    Sound.play('error');
    feedback(text || 'Belum tepat. Coba lagi!', 'bad');
    setTimeout(function () {
      if (token !== state.token) return;
      var msg = $('#taskFeedback').textContent;
      loadTask(state.task);
      feedback(msg, 'bad');
    }, 1100);
  }

  function solved(text) {
    state.solved = true;
    var l = LESSONS[state.lesson];
    var last = state.task === l.tasks.length - 1;
    setTimeout(function () { Sound.play('success'); }, 250);
    feedback((text || 'Bagus sekali!') + (last ? ' Pelajaran selesai! 🎉' : ''), 'ok');
    var btn = $('#btnTaskNext');
    btn.hidden = false;
    if (last) {
      progress[l.id] = true;
      saveProgress();
      renderList();
      btn.textContent = state.lesson < LESSONS.length - 1 ? 'Pelajaran berikutnya →' : 'Kembali ke daftar';
    } else {
      btn.textContent = (l.puzzle ? 'Soal' : 'Latihan') + ' berikutnya →';
    }
    $('#btnTaskHint').disabled = true;
  }

  function next() {
    var l = LESSONS[state.lesson];
    if (state.task < l.tasks.length - 1) loadTask(state.task + 1);
    else if (state.lesson < LESSONS.length - 1) openLesson(state.lesson + 1);
    else showList();
  }

  function onMove(from, to, info) {
    if (state.solved || state.busy) return;
    var chess = state.chess;
    var cands = chess.moves({ square: from }).filter(function (m) { return m.to === to; });
    if (!cands.length) return;
    var token = state.token;
    var p = cands[0].promotion ? deps.askPromotion('w') : Promise.resolve(null);
    p.then(function (promo) {
      if (token !== state.token) return;
      if (cands[0].promotion && !promo) { board.render(); return; }
      handle({ from: from, to: to, promotion: promo }, info);
    });
  }

  function handle(move, info) {
    var t = currentTask(), chess = state.chess;
    var uci = Chess.sqName(move.from) + Chess.sqName(move.to);
    var m;
    switch (t.type) {
      case 'stars': {
        m = play(move, info);
        var k = state.stars.indexOf(move.to);
        if (k >= 0) state.stars.splice(k, 1);
        // Hanya Putih yang bergerak: kembalikan giliran ke Putih
        var parts = chess.fen().split(' ');
        parts[1] = 'w'; parts[3] = '-';
        var lm = { from: m.from, to: m.to };
        state.chess = new Chess(parts.join(' '));
        board.markers = state.stars.slice();
        board.chess = state.chess;
        board.lastMove = lm;
        setTimeout(function () { board.render(); }, 240);
        if (!state.stars.length) solved('Semua bintang terkumpul!');
        else feedback(k >= 0 ? 'Bintang didapat! Sisa ' + state.stars.length + '.' : 'Langkah sah, tapi belum mengenai bintang.', k >= 0 ? 'ok' : 'info');
        break;
      }
      case 'move': {
        var right = t.answer.some(function (a) { return a.slice(0, 4) === uci; });
        m = play(move, info);
        if (right) {
          var extra = '';
          if (m.promotion && m.promotion.toLowerCase() !== 'q') extra = ' (Tips: menteri biasanya pilihan paling kuat.)';
          solved((t.success || 'Tepat!') + extra);
        } else wrong(t.wrong);
        break;
      }
      case 'check':
        m = play(move, info);
        if (state.chess.inCheck()) solved('Skak! Raja hitam sedang diserang.');
        else wrong('Itu belum skak. Cari langkah yang menyerang raja hitam.');
        break;
      case 'mate1': {
        m = play(move, info);
        var st = state.chess.status();
        if (st.reason === 'checkmate') solved('Skakmat! ' + m.san);
        else if (st.reason === 'stalemate') wrong('Oh tidak, itu PAT (remis)! Raja hitam tidak bisa bergerak tetapi tidak sedang diskak.');
        else if (st.check) wrong('Skak, tetapi raja hitam masih bisa lolos. Coba lagi!');
        else wrong('Itu belum skakmat. Coba lagi!');
        break;
      }
      case 'mate2':
        if (state.phase === 0) {
          var forced = AI.mateAfter(cloneAfter(chess, move), 1);
          m = play(move, info);
          var s0 = state.chess.status();
          if (s0.reason === 'checkmate') { solved('Langsung skakmat! ' + m.san); break; }
          if (!forced) { wrong(s0.reason === 'stalemate' ? 'Itu pat (remis)! Coba lagi.' : 'Langkah itu memberi lawan jalan keluar. Coba lagi!'); break; }
          state.busy = true;
          feedback('Langkah bagus! Komputer menjawab…', 'info');
          var token = state.token;
          setTimeout(function () {
            if (token !== state.token) return;
            var reply = AI.findBestMove(state.chess, 3, { timeMs: 500, maxDepth: 3 });
            if (reply) play({ from: reply.move.from, to: reply.move.to, promotion: reply.move.promotion });
            state.phase = 1;
            state.busy = false;
            feedback('Sekarang berikan skakmat!', 'info');
          }, 650);
        } else {
          m = play(move, info);
          if (state.chess.status().reason === 'checkmate') solved('Skakmat dalam 2 langkah! ' + m.san);
          else wrong('Belum skakmat. Ulangi soal dari awal.');
        }
        break;
    }
  }

  function cloneAfter(chess, move) {
    var c = new Chess(chess.fen());
    c.move({ from: move.from, to: move.to, promotion: move.promotion });
    return c;
  }

  function hint() {
    if (state.solved || state.busy) return;
    var t = currentTask(), chess = state.chess, m = null;
    var legal = chess.moves();
    if (t.type === 'stars') {
      m = legal.filter(function (x) { return state.stars.indexOf(x.to) >= 0; })[0] || null;
      if (!m) {
        // Belum bisa langsung ke bintang: cari langkah yang membuat bintang terjangkau
        for (var i = 0; i < legal.length && !m; i++) {
          var c = cloneAfter(chess, legal[i]);
          var parts = c.fen().split(' '); parts[1] = 'w'; parts[3] = '-';
          c = new Chess(parts.join(' '));
          if (c.moves().some(function (x) { return state.stars.indexOf(x.to) >= 0; })) m = legal[i];
        }
      }
    } else if (t.type === 'move') {
      var a = t.answer[0];
      m = { from: Chess.sqIndex(a.slice(0, 2)), to: Chess.sqIndex(a.slice(2, 4)) };
    } else if (t.type === 'check') {
      m = legal.filter(function (x) { var c = cloneAfter(chess, x); return c.inCheck(); })[0];
    } else if (t.type === 'mate1' || (t.type === 'mate2' && state.phase === 1)) {
      m = AI.matingMoves(chess)[0];
    } else if (t.type === 'mate2') {
      m = AI.forcedMate(chess, 2);
    }
    if (m) {
      board.setHint(m.from, m.to);
      feedback('Petunjuk: lihat kotak bertanda biru — gerakkan bidak dari ' + Chess.sqName(m.from) + ' ke ' + Chess.sqName(m.to) + '.', 'info');
    }
  }

  global.Tutorial = { init: init, open: open, LESSONS: LESSONS };
})(typeof window !== 'undefined' ? window : globalThis);
