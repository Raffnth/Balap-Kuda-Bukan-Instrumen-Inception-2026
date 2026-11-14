import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, TARGETS } from '../src/lib/engine.js';
import { arrowFor } from '../src/lib/direction.js';

const card = (o = {}) => ({
  found: true,
  cx: 0.5,
  cy: 0.5,
  size: 0.5,
  px: 500,
  angle: 0,
  light: 150,
  glare: 0,
  bbox: { x: 0.25, y: 0.35, w: 0.5, h: 0.3 },
  ...o,
});

test('KTP 35% lebar tampilan sudah boleh difoto (lebih mudah)', () => {
  assert.ok(TARGETS.ktp.sizeMin <= 0.35);
  const d = decide('ktp', card({ size: 0.35, px: 380, bbox: { x: 0.325, y: 0.4, w: 0.35, h: 0.22 } }));
  assert.equal(d.key, 'tahan');
  assert.equal(d.ok, true);
});

test('KTP terlalu kecil diminta mendekat', () => {
  assert.equal(decide('ktp', card({ size: 0.25, px: 270, bbox: { x: 0.375, y: 0.4, w: 0.25, h: 0.16 } })).key, 'dekatkan');
});

test('digit NIK terlalu kecil (piksel kamera) tetap diminta mendekat', () => {
  assert.equal(decide('ktp', card({ size: 0.4, px: 200 })).key, 'dekatkan');
});

test('kartu terpotong tepi kiri diminta geser ke kiri', () => {
  assert.equal(decide('ktp', card({ cx: 0.2, bbox: { x: 0, y: 0.35, w: 0.45, h: 0.3 } })).key, 'kiri');
});

test('tanpa kartu di ruang gelap: gelap; di ruang terang: cari', () => {
  assert.equal(decide('ktp', { found: false, frameP95: 20 }).key, 'gelap');
  assert.equal(decide('ktp', { found: false, frameP95: 200 }).key, 'cari_ktp');
});

test('panah layar sesuai arti kalimat', () => {
  assert.equal(arrowFor('kiri', true, 'rear'), 'left');
  assert.equal(arrowFor('atas', true, 'rear'), 'up'); // "Geser ponsel ke depan"
  assert.equal(arrowFor('atas', true, 'front'), 'down'); // "Turunkan KTP"
  assert.equal(arrowFor('bawah', true, 'front'), 'up'); // "Naikkan KTP"
  assert.equal(arrowFor('atas', false, 'front'), 'up'); // swafoto "Naikkan ponsel"
  assert.equal(arrowFor('dekatkan', true, 'rear'), 'in');
  assert.equal(arrowFor('tahan', true, 'rear'), null);
});
