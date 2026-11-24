/*
 * pieces.js — Gambar bidak catur (SVG buatan sendiri, tanpa gambar dari luar)
 * Pieces.svg('N') → string SVG kuda putih, Pieces.svg('q') → menteri hitam.
 */
(function (global) {
  'use strict';

  var BASE = '<rect x="10" y="35" width="25" height="4.5" rx="1.6"/>';

  var SHAPES = {
    p: BASE +
      '<path d="M14 35C14 29.5 18 26.5 19.5 22.5H25.5C27 26.5 31 29.5 31 35Z"/>' +
      '<ellipse cx="22.5" cy="22" rx="6.2" ry="1.9"/>' +
      '<circle cx="22.5" cy="15" r="5.3"/>',
    r: BASE +
      '<rect x="12" y="31.5" width="21" height="3.5" rx="0.8"/>' +
      '<path d="M14.5 31.5L15.5 17.5H29.5L30.5 31.5Z"/>' +
      '<path d="M12 17.5V9H16V12.2H20.5V9H24.5V12.2H29V9H33V17.5Z"/>' +
      '<path class="d" d="M16 21.5H29M15.8 27H29.2" fill="none"/>',
    b: BASE +
      '<path d="M15 35C16 30.5 19 28.5 19.5 25.5H25.5C26 28.5 29 30.5 30 35Z"/>' +
      '<ellipse cx="22.5" cy="25" rx="6.3" ry="1.9"/>' +
      '<path d="M22.5 9C17 13.2 15.4 17.4 17 21.2C18 23.4 27 23.4 28 21.2C29.6 17.4 28 13.2 22.5 9Z"/>' +
      '<circle cx="22.5" cy="7.3" r="2.3"/>' +
      '<path class="d" d="M24.6 12.8L20.6 17.6" fill="none"/>',
    n: BASE +
      '<path d="M13 35H32C32.6 27 31 18.5 26.6 13.2C24.6 10.9 22.2 10.1 20.2 10L19.2 6.8L17.1 10.4C15.6 11.4 14.6 12.9 14 14.5L10.6 20.8C10 22.4 10.9 24 12.4 24.3L14.1 24.5C15.6 23.1 17.6 22.4 20.1 22C19.1 26.2 15.6 29.2 13 35Z"/>' +
      '<path class="d" d="M26.6 13.4C29.2 17.4 30.2 23.2 29.7 32" fill="none"/>' +
      '<circle class="df" cx="18.4" cy="15.2" r="1.3"/>' +
      '<circle class="df" cx="12.6" cy="21.6" r="0.75"/>',
    q: BASE +
      '<path d="M13.2 30.5L10 14.5L16.6 23.2L16.2 11.2L20.9 22L22.5 9.6L24.1 22L28.8 11.2L28.4 23.2L35 14.5L31.8 30.5Z"/>' +
      '<path d="M13.2 30.5Q22.5 33.2 31.8 30.5L31.2 35H13.8Z"/>' +
      '<circle cx="10" cy="13" r="2"/><circle cx="16.2" cy="9.6" r="2"/><circle cx="22.5" cy="8" r="2"/>' +
      '<circle cx="28.8" cy="9.6" r="2"/><circle cx="35" cy="13" r="2"/>' +
      '<path class="d" d="M14.6 27.4Q22.5 29.8 30.4 27.4" fill="none"/>',
    k: BASE +
      '<path d="M21 3.5H24V6.5H27V9.5H24V14H21V9.5H18V6.5H21Z"/>' +
      '<path d="M22.5 22.5C20.4 19.2 20 15.8 22.5 14.2C25 15.8 24.6 19.2 22.5 22.5Z"/>' +
      '<path d="M13 34.5C11 28.5 10 22.5 14 19.5C17.2 17.3 20.2 18.8 22.5 22.5C24.8 18.8 27.8 17.3 31 19.5C35 22.5 34 28.5 32 34.5Z"/>' +
      '<path class="d" d="M13.4 30Q22.5 33 31.6 30M22.5 22.5V31.2" fill="none"/>'
  };

  var COLORS = {
    w: { fill: '#fbfaf5', stroke: '#1c1c1c', detail: '#1c1c1c' },
    b: { fill: '#2b2b2e', stroke: '#0b0b0c', detail: '#e9e6dc' }
  };

  var cache = {};

  function svg(piece) {
    if (cache[piece]) return cache[piece];
    var color = piece < 'a' ? 'w' : 'b';
    var type = piece.toLowerCase();
    var c = COLORS[color];
    var out = '<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<style>.d{stroke:' + c.detail + ';stroke-width:1.2;stroke-linecap:round}.df{fill:' + c.detail + ';stroke:none}</style>' +
      '<g fill="' + c.fill + '" stroke="' + c.stroke + '" stroke-width="1.5" stroke-linejoin="round">' +
      SHAPES[type] + '</g></svg>';
    cache[piece] = out;
    return out;
  }

  var NAMES = { p: 'Pion', n: 'Kuda', b: 'Gajah', r: 'Benteng', q: 'Menteri', k: 'Raja' };

  global.Pieces = {
    svg: svg,
    name: function (piece) { return NAMES[piece.toLowerCase()]; },
    NAMES: NAMES
  };
})(typeof window !== 'undefined' ? window : globalThis);
