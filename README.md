# Catur Indonesia ♞

Game catur berbasis web yang lengkap dan berbahasa Indonesia. Bisa dimainkan di HP maupun laptop, **tanpa instalasi dan tanpa internet**.

## Cara membuka

1. Unduh/clone folder ini.
2. Klik dua kali **`index.html`**, dan game langsung terbuka di browser (Chrome, Edge, Firefox, Safari).
   - Di HP: salin folder ke HP lalu buka `index.html` dengan browser, atau unggah ke hosting statis (misalnya GitHub Pages) lalu buka alamatnya.

## Fitur

- **Aturan lengkap**: semua langkah sah, rokade pendek/panjang, en passant, promosi (menteri/benteng/gajah/kuda), skak, skakmat, dan remis (pat, pengulangan 3 kali, aturan 50 langkah, bidak tidak cukup).
- **Lawan komputer**: Pemula, Menengah, dan Sulit (minimax + alpha-beta pruning, tanpa library luar), lengkap dengan penjelasan setiap langkah komputer.
- **Dua pemain** di satu perangkat, dengan papan yang bisa berputar otomatis.
- **Mode Belajar**: 12 pelajaran bertahap dengan latihan interaktif, ditambah teka-teki skakmat 1 dan 2 langkah.
- Petunjuk langkah terbaik, Undo, Mulai ulang, riwayat langkah (notasi internasional atau Indonesia), bidak yang dimakan beserta selisih materi, jam catur 5/10/15 menit, peringatan bidak yang bisa dimakan gratis, efek suara, simpan otomatis, tema papan (kayu/hijau/biru), dan mode gelap.

## Struktur kode

| File | Isi |
|---|---|
| `js/engine.js` | Logika aturan catur (tanpa DOM) |
| `js/ai.js` | AI komputer, penjelasan langkah, deteksi bidak tergantung, pemecah teka-teki |
| `js/pieces.js` | Gambar bidak SVG buatan sendiri |
| `js/board.js` | Tampilan papan interaktif (ketuk/seret, sorotan, animasi) |
| `js/sound.js` | Efek suara dari Web Audio API (tanpa file audio) |
| `js/tutorial.js` | Mode Belajar: pelajaran & teka-teki |
| `js/app.js` | Pengendali permainan, pengaturan, dan simpan otomatis |
| `css/style.css` | Tampilan responsif & tema |
| `tests/test-engine.js` | Uji otomatis |

## Menjalankan uji

```bash
node tests/test-engine.js
```

Uji ini mencakup perft (penghitungan posisi standar untuk membuktikan generator langkah benar), rokade, en passant, promosi, skakmat, semua jenis remis, notasi SAN, AI, serta validasi seluruh latihan dan teka-teki.
