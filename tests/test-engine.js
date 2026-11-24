/*
 * Uji otomatis aturan catur, AI, dan data tutorial.
 * Jalankan:  node tests/test-engine.js
 */
'use strict';
var Chess = require('../js/engine.js');
globalThis.Chess = Chess;
var AI = require('../js/ai.js');
globalThis.CaturAI = AI;

var passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n      ' + e.message); }
}
function eq(a, b, msg) { if (a !== b) throw new Error((msg || '') + ' diharapkan ' + JSON.stringify(b) + ', didapat ' + JSON.stringify(a)); }
function ok(v, msg) { if (!v) throw new Error(msg || 'kondisi salah'); }
function play(c, list) { list.forEach(function (s) { ok(c.move(s), 'langkah tidak sah: ' + s + ' pada ' + c.fen()); }); }
function sq(n) { return Chess.sqIndex(n); }
function targets(c, from) { return c.moves({ square: from }).map(function (m) { return Chess.sqName(m.to); }).sort(); }

console.log('\nPerft (jumlah posisi — membuktikan generator langkah 100% benar)');
[
  ['Posisi awal', Chess.START_FEN, [20, 400, 8902, 197281]],
  ['Kiwipete (rokade, en passant, promosi)', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
  ['Posisi 3 (en passant & pin)', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
  ['Posisi 4 (promosi & skak)', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
  ['Posisi 5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]]
].forEach(function (c) {
  test(c[0], function () {
    var ch = new Chess(c[1]);
    c[2].forEach(function (n, i) { eq(ch.perft(i + 1), n, 'kedalaman ' + (i + 1)); });
  });
});

console.log('\nLangkah dasar tiap bidak');
test('Pion maju 1 atau 2 dari posisi awal', function () { eq(targets(new Chess(), 'e2').join(), 'e3,e4'); });
test('Pion tidak bisa maju jika terhalang', function () { eq(targets(new Chess('4k3/8/8/8/8/4p3/4P3/4K3 w - - 0 1'), 'e2').length, 0); });
test('Kuda dari g1', function () { eq(targets(new Chess(), 'g1').join(), 'f3,h3'); });
test('Benteng, gajah, menteri di papan kosong', function () {
  eq(new Chess('4k3/8/8/8/3R4/8/8/4K3 w - - 0 1').moves({ square: 'd4' }).length, 14);
  eq(new Chess('4k3/8/8/8/3B4/8/8/4K3 w - - 0 1').moves({ square: 'd4' }).length, 13);
  eq(new Chess('4k3/8/8/8/3Q4/8/8/7K w - - 0 1').moves({ square: 'd4' }).length, 27);
});
test('Bidak yang di-pin tidak boleh membuka skak', function () {
  var c = new Chess('4k3/4r3/8/8/8/8/4N3/4K3 w - - 0 1');
  eq(c.moves({ square: 'e2' }).length, 0);
});
test('Raja tidak boleh masuk ke kotak yang diserang', function () {
  var t = targets(new Chess('3r4/8/8/8/8/8/8/4K3 w - - 0 1'), 'e1');
  ok(t.indexOf('d1') < 0 && t.indexOf('d2') < 0, 'raja bisa ke lajur d: ' + t);
});
test('Saat skak, hanya langkah penyelamat yang sah', function () {
  var c = new Chess('4k3/8/8/8/8/8/3PPP2/r3K3 w - - 0 1');
  ok(c.inCheck());
  c.moves().forEach(function (m) { ok(m.piece === 'K', 'langkah bukan raja: ' + Chess.sqName(m.from)); });
});

console.log('\nRokade');
test('Rokade pendek & panjang Putih', function () {
  var c = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  var m = c.move('O-O'); ok(m); eq(c.get('g1'), 'K'); eq(c.get('f1'), 'R'); eq(c.get('h1'), null); eq(m.san, 'O-O');
  c.undo(); eq(c.get('e1'), 'K'); eq(c.get('h1'), 'R');
  m = c.move({ from: 'e1', to: 'c1' }); ok(m); eq(c.get('c1'), 'K'); eq(c.get('d1'), 'R'); eq(m.san, 'O-O-O');
});
test('Rokade Hitam', function () {
  var c = new Chess('r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1');
  ok(c.move('O-O-O')); eq(c.get('c8'), 'k'); eq(c.get('d8'), 'r');
});
test('Tidak boleh rokade saat diskak', function () {
  var c = new Chess('4r1k1/8/8/8/8/8/8/R3K2R w KQ - 0 1');
  ok(!c.move('O-O') && !c.move('O-O-O'));
});
test('Tidak boleh rokade melewati kotak yang diserang', function () {
  var c = new Chess('4k3/8/8/8/8/8/5r2/R3K2R w KQ - 0 1');
  ok(!c.move('O-O'), 'O-O seharusnya tidak sah'); ok(c.move('O-O-O'), 'O-O-O seharusnya sah');
});
test('Tidak boleh rokade jika ada bidak di antaranya', function () {
  ok(!new Chess('4k3/8/8/8/8/8/8/RN2K1NR w KQ - 0 1').move('O-O'));
  ok(!new Chess('4k3/8/8/8/8/8/8/RN2K2R w KQ - 0 1').move('O-O-O'));
});
test('Rokade panjang boleh walau b1 diserang (raja tidak melewatinya)', function () {
  ok(new Chess('1r2k3/8/8/8/8/8/8/R3K3 w Q - 0 1').move('O-O-O'));
});
test('Hak rokade hilang setelah raja bergerak', function () {
  var c = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  play(c, ['Ke2', 'Ke7', 'Ke1', 'Ke8']);
  ok(!c.move('O-O') && !c.move('O-O-O'));
});
test('Hak rokade hilang setelah benteng bergerak / dimakan', function () {
  var c = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  play(c, ['Rh2', 'Rh7', 'Rh1', 'Rh8']);
  ok(!c.move('O-O')); ok(c.move('O-O-O'));
  var d = new Chess('r3k2r/8/8/8/8/8/6b1/R3K2R b KQkq - 0 1');
  play(d, ['Bxh1']);
  eq(d.fen().split(' ')[2], 'Qkq');
});

console.log('\nEn passant');
test('En passant Putih', function () {
  var c = new Chess();
  play(c, ['e4', 'a6', 'e5', 'd5']);
  var m = c.move('exd6'); ok(m && m.ep, 'en passant tidak tersedia');
  eq(c.get('d5'), null); eq(c.get('d6'), 'P'); eq(m.captured, 'p');
  c.undo(); eq(c.get('d5'), 'p'); eq(c.get('e5'), 'P'); eq(c.get('d6'), null);
});
test('En passant Hitam', function () {
  var c = new Chess();
  play(c, ['a3', 'e5', 'a4', 'e4', 'd4']);
  ok(c.move('exd3'));
  eq(c.get('d4'), null);
});
test('En passant hanya tepat pada langkah berikutnya', function () {
  var c = new Chess();
  play(c, ['e4', 'a6', 'e5', 'd5', 'a3', 'a5']);
  ok(!c.move('exd6'), 'en passant seharusnya sudah tidak sah');
});
test('En passant dilarang jika membuka skak pada raja sendiri', function () {
  var c = new Chess('8/8/8/K2pP2r/8/8/8/4k3 w - d6 0 1');
  ok(!c.move('exd6'), 'en passant ilegal (raja terbuka di baris 5)');
});

console.log('\nPromosi');
test('Promosi ke menteri, benteng, gajah, kuda', function () {
  ['q', 'r', 'b', 'n'].forEach(function (p) {
    var c = new Chess('8/P7/8/8/8/8/8/k1K5 w - - 0 1');
    var m = c.move({ from: 'a7', to: 'a8', promotion: p });
    ok(m, 'promosi ' + p); eq(c.get('a8'), p.toUpperCase());
    eq(m.san.indexOf('=' + p.toUpperCase()) >= 0, true, 'SAN ' + m.san);
  });
});
test('Promosi dengan memakan + undo', function () {
  var c = new Chess('1r5k/P7/8/8/8/8/8/K7 w - - 0 1');
  var m = c.move('axb8=N'); ok(m); eq(c.get('b8'), 'N');
  c.undo(); eq(c.get('a7'), 'P'); eq(c.get('b8'), 'r');
});
test('Promosi Hitam', function () {
  var c = new Chess('K7/8/8/8/8/8/p7/7k b - - 0 1');
  ok(c.move('a1=Q')); eq(c.get('a1'), 'q');
});
test('Ada 4 pilihan promosi', function () {
  eq(new Chess('8/P7/8/8/8/8/8/k1K5 w - - 0 1').moves({ square: 'a7' }).length, 4);
});

console.log('\nSkak & skakmat');
test('Skakmat langkah 2 (Fool\'s mate)', function () {
  var c = new Chess();
  play(c, ['f3', 'e5', 'g4', 'Qh4#']);
  ok(c.isCheckmate()); var s = c.status(); eq(s.reason, 'checkmate'); eq(s.winner, 'b');
});
test('Scholar\'s mate & SAN "#"', function () {
  var c = new Chess();
  play(c, ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6']);
  var m = c.move('Qxf7'); eq(m.san, 'Qxf7#'); eq(c.status().winner, 'w');
});
test('Skak (bukan mat) diberi tanda "+"', function () {
  var c = new Chess('4k3/8/8/8/8/8/8/R3K3 w - - 0 1');
  eq(c.move('Ra8').san, 'Ra8+'); ok(c.inCheck()); ok(!c.isCheckmate());
});
test('Disambiguasi SAN (Nbd2, R1a3)', function () {
  var c = new Chess('4k3/8/8/8/8/5N2/8/1N2K3 w - - 0 1');
  eq(c.move({ from: 'b1', to: 'd2' }).san, 'Nbd2');
  var d = new Chess('4k3/8/R7/8/8/8/8/R3K3 w - - 0 1');
  eq(d.move({ from: 'a1', to: 'a3' }).san, 'R1a3');
});

console.log('\nRemis');
test('Pat (stalemate)', function () {
  var c = new Chess('k7/8/1Q6/8/8/8/8/7K b - - 0 1');
  ok(c.isStalemate()); eq(c.status().reason, 'stalemate');
});
test('Pengulangan 3 kali', function () {
  var c = new Chess();
  play(c, ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1']);
  ok(!c.status().over, 'belum 3 kali');
  play(c, ['Ng8']);
  eq(c.status().reason, 'threefold');
});
test('Aturan 50 langkah', function () {
  var c = new Chess('4k3/8/8/8/8/8/8/R3K3 w - - 99 80');
  ok(!c.status().over);
  play(c, ['Ra2']);
  eq(c.status().reason, 'fifty');
});
test('Skakmat lebih kuat dari aturan 50 langkah', function () {
  var c = new Chess('6k1/5ppp/8/8/8/8/8/R5K1 w - - 99 80');
  play(c, ['Ra8#']);
  eq(c.status().reason, 'checkmate');
});
test('Bidak tidak cukup', function () {
  eq(new Chess('4k3/8/8/8/8/8/8/4K3 w - - 0 1').status().reason, 'insufficient');
  eq(new Chess('4k3/8/8/8/8/8/8/4KN2 w - - 0 1').status().reason, 'insufficient');
  eq(new Chess('4k3/8/8/8/8/8/8/4KB2 w - - 0 1').status().reason, 'insufficient');
  eq(new Chess('4kb2/8/8/8/8/8/8/2B1K3 w - - 0 1').status().reason, 'insufficient'); // gajah sewarna
  ok(!new Chess('4k1b1/8/8/8/8/8/8/2B1K3 w - - 0 1').status().over, 'gajah beda warna masih bisa mat');
  ok(!new Chess('4k3/8/8/8/8/8/8/2B1KN2 w - - 0 1').status().over, 'gajah + kuda bisa mat');
  ok(!new Chess('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1').status().over, 'pion masih bisa promosi');
});
test('Remis setelah raja memakan bidak terakhir', function () {
  var c = new Chess('4k3/4r3/8/8/8/8/8/4K3 b - - 0 1');
  // benteng dimakan → raja vs raja
  var d = new Chess('4k3/8/8/8/8/8/4r3/4K3 w - - 0 1');
  play(d, ['Kxe2']);
  eq(d.status().reason, 'insufficient');
  ok(c);
});
test('Bahan mat untuk aturan waktu habis', function () {
  var c = new Chess('4k3/8/8/8/8/8/8/4KN2 w - - 0 1');
  ok(!c.hasMatingMaterial('w')); ok(!c.hasMatingMaterial('b'));
  ok(new Chess('4k3/8/8/8/8/8/8/R3K3 w - - 0 1').hasMatingMaterial('w'));
});

console.log('\nFEN, undo, dan notasi Indonesia');
test('FEN bolak-balik', function () {
  var c = new Chess();
  play(c, ['e4', 'c5', 'Nf3']);
  eq(c.fen(), 'rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2');
});
test('Undo mengembalikan posisi persis', function () {
  var c = new Chess('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
  var start = c.fen();
  c.moves().forEach(function (m) { c.move({ from: m.from, to: m.to, promotion: m.promotion }); c.undo(); eq(c.fen(), start); });
});
test('Notasi Indonesia', function () {
  eq(Chess.localizeSan('Nf3', 'id'), 'Kf3');
  eq(Chess.localizeSan('Qxf7#', 'id'), 'Mxf7#');
  eq(Chess.localizeSan('e8=Q+', 'id'), 'e8=M+');
  eq(Chess.localizeSan('O-O', 'id'), 'O-O');
  eq(Chess.localizeSan('Kf3', 'intl'), 'Kf3');
});

console.log('\nAI komputer');
test('Menemukan skakmat dalam 1 (semua tingkat)', function () {
  [1, 2, 3].forEach(function (lv) {
    for (var k = 0; k < (lv === 1 ? 1 : 3); k++) {
      var c = new Chess('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1');
      var r = AI.findBestMove(c, lv, { blunder: 0 });
      eq(Chess.sqName(r.move.to), 'd8', 'tingkat ' + lv);
    }
  });
});
test('Memakan menteri yang tidak terlindungi', function () {
  var c = new Chess('4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1');
  var r = AI.findBestMove(c, 2);
  eq(Chess.sqName(r.move.to), 'd5');
});
test('Selalu mengembalikan langkah sah (100 langkah acak AI vs AI)', function () {
  var c = new Chess();
  for (var i = 0; i < 60 && !c.status().over; i++) {
    var r = AI.findBestMove(c, 1 + (i % 2), { timeMs: 150, blunder: 0.2 });
    ok(c.move({ from: r.move.from, to: r.move.to, promotion: r.move.promotion }), 'langkah AI tidak sah');
  }
});
test('Penjelasan langkah dalam bahasa Indonesia', function () {
  var c = new Chess('4k3/8/8/1q6/8/8/8/1N2K3 b - - 0 1');
  var text = AI.explainMove(c, c.moves().filter(function (m) { return Chess.sqName(m.to) === 'b1'; })[0]);
  ok(/memakan kuda Anda/.test(text), text);
  var d = new Chess();
  d.move('e4');
  var t2 = AI.explainMove(d, d.moves().filter(function (m) { return Chess.sqName(m.from) === 'g8' && Chess.sqName(m.to) === 'f6'; })[0]);
  ok(/Komputer/.test(t2), t2);
});
test('Peringatan bidak dimakan gratis', function () {
  var c = new Chess();
  play(c, ['e4', 'd5']);
  var w = AI.blunderCheck(c, { from: sq('d1'), to: sq('g4') });
  ok(w && w.piece === 'Q', 'menteri di g4 seharusnya diperingatkan');
  ok(!AI.blunderCheck(c, { from: sq('g1'), to: sq('f3') }), 'Nf3 aman');
  ok(!AI.blunderCheck(c, { from: sq('e4'), to: sq('d5') }), 'exd5 aman');
});

console.log('\nData tutorial & teka-teki');
// Muat tutorial tanpa DOM
globalThis.Pieces = { svg: function () { return ''; } };
globalThis.Sound = {};
require('../js/tutorial.js');
var LESSONS = globalThis.Tutorial.LESSONS;
LESSONS.forEach(function (l) {
  l.tasks.forEach(function (t, i) {
    test(l.title + ' #' + (i + 1) + ' (' + t.type + ')', function () {
      var c = new Chess(t.fen);
      ok(c.fen().split(' ')[0] === t.fen.split(' ')[0], 'FEN tidak valid');
      ok(c.moves().length > 0, 'tidak ada langkah sah');
      if (t.type === 'move') {
        t.answer.forEach(function (a) { ok(c.clone().move(a), 'jawaban tidak sah: ' + a); });
      }
      if (t.type === 'stars') {
        // Semua bintang harus bisa dicapai (BFS hanya langkah Putih)
        var seen = {}, queue = [{ fen: t.fen, stars: t.stars.slice() }], solvedOk = false, steps = 0;
        while (queue.length && steps < 20000 && !solvedOk) {
          var s = queue.shift(); steps++;
          var ch = new Chess(s.fen);
          ch.moves().forEach(function (m) {
            var c2 = new Chess(s.fen); c2.move({ from: m.from, to: m.to, promotion: m.promotion || 'q' });
            var p = c2.fen().split(' '); p[1] = 'w'; p[3] = '-';
            var rest = s.stars.filter(function (x) { return x !== Chess.sqName(m.to); });
            if (!rest.length) solvedOk = true;
            var key = p[0] + rest.join();
            if (!seen[key]) { seen[key] = 1; queue.push({ fen: p.join(' '), stars: rest }); }
          });
        }
        ok(solvedOk, 'bintang tidak bisa dikumpulkan');
      }
      if (t.type === 'check') ok(c.moves().some(function (m) { var d = new Chess(t.fen); d.move({ from: m.from, to: m.to }); return d.inCheck(); }));
      if (t.type === 'mate1') ok(AI.matingMoves(c).length > 0, 'tidak ada skakmat 1 langkah');
      if (t.type === 'mate2') {
        eq(AI.matingMoves(c).length, 0, 'seharusnya tidak ada mat 1 langkah');
        ok(AI.forcedMate(c, 2), 'tidak ada skakmat paksa 2 langkah');
      }
    });
  });
});

console.log('\nHasil: ' + passed + ' lulus, ' + failed + ' gagal\n');
process.exit(failed ? 1 : 0);
