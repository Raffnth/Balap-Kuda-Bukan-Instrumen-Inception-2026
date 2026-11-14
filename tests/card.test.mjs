import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectCard } from '../src/lib/vision/card.js';
import { scene } from './helpers/scene.mjs';

const CARD = { cx: 0.5, cy: 0.5, w: 0.6, angle: 0 };

test('kartu di permukaan gelap terdeteksi (jalur kecerahan)', () => {
  const m = detectCard(scene({ surface: 'dark', card: CARD }));
  assert.equal(m.found, true);
  assert.ok(Math.abs(m.size - 0.6) < 0.06, `ukuran ${m.size}`);
  assert.ok(Math.abs(m.cx - 0.5) < 0.03 && Math.abs(m.cy - 0.5) < 0.03);
});

for (const surface of ['white', 'gray', 'wood', 'lightwood']) {
  test(`kartu di meja ${surface} terdeteksi`, () => {
    const m = detectCard(scene({ surface, card: CARD }));
    assert.equal(m.found, true, `tidak terdeteksi di ${surface}`);
    assert.ok(Math.abs(m.size - 0.6) < 0.08, `ukuran ${m.size}`);
    assert.ok(!m.partial);
  });
}

test('kartu di meja putih dengan lampu kuning tetap terdeteksi', () => {
  const m = detectCard(scene({ surface: 'white', card: CARD, warm: 18 }));
  assert.equal(m.found, true);
});

test('kartu miring 20 derajat di meja putih: sudut terbaca', () => {
  const m = detectCard(scene({ surface: 'white', card: { ...CARD, w: 0.55, angle: 20 } }));
  assert.equal(m.found, true);
  assert.ok(Math.abs(Math.abs(m.angle) - 20) < 6, `sudut ${m.angle}`);
});

test('kartu kecil (35% lebar) di meja kayu terdeteksi', () => {
  const m = detectCard(scene({ surface: 'wood', card: { ...CARD, w: 0.35, cx: 0.4 } }));
  assert.equal(m.found, true);
  assert.ok(Math.abs(m.size - 0.35) < 0.06, `ukuran ${m.size}`);
});

for (const surface of ['white', 'wood', 'dark', 'gray']) {
  test(`meja ${surface} tanpa kartu tidak dianggap kartu`, () => {
    assert.equal(detectCard(scene({ surface })).found, false);
  });
}

test('kertas biru polos tanpa teks tidak dianggap KTP', () => {
  const m = detectCard(scene({ surface: 'white', card: { ...CARD, text: false } }));
  assert.equal(m.found, false);
});
