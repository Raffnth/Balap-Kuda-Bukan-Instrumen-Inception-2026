import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { voiceKey, splitSentences, normalizeSentence } from '../src/lib/voice-core.js';
import {
  allSpokenTexts,
  guideText,
  ktpGuideText,
  extraText,
  eventText,
  EVENTS,
  PHRASES,
  ADVICE,
  RESULT_SENTENCES,
} from '../src/lib/messages.js';

const catalog = new Set(allSpokenTexts().flatMap((t) => splitSentences(t)).map(voiceKey));
const covered = (text) => splitSentences(text).every((s) => catalog.has(voiceKey(s)));

test('kunci suara stabil dan tidak peka spasi', () => {
  assert.equal(voiceKey('Tahan.'), voiceKey('  Tahan. '));
  assert.notEqual(voiceKey('Kiri.'), voiceKey('Kanan.'));
  assert.match(voiceKey('Tahan.'), /^[0-9a-f]{8}$/);
});

test('pemecah kalimat', () => {
  assert.deepEqual(splitSentences('Kelewatan. Geser ponsel ke kiri.'), ['Kelewatan.', 'Geser ponsel ke kiri.']);
  assert.deepEqual(splitSentences('Ulangi swafoto? Ketuk sekali lagi untuk melanjutkan.'), [
    'Ulangi swafoto?',
    'Ketuk sekali lagi untuk melanjutkan.',
  ]);
  assert.deepEqual(splitSentences(''), []);
  assert.equal(normalizeSentence(' a  b '), 'a b');
});

test('tidak ada dua kalimat berbeda dengan kunci sama', () => {
  const seen = new Map();
  for (const s of allSpokenTexts().flatMap((t) => splitSentences(t))) {
    const k = voiceKey(s);
    if (seen.has(k)) assert.equal(seen.get(k), normalizeSentence(s));
    seen.set(k, normalizeSentence(s));
  }
});

test('semua instruksi panduan punya rekaman (semua level, kamera, dan variasi)', () => {
  const levels = ['lengkap', 'ringkas'];
  const keys = ['cari_ktp', 'cari_wajah', 'gelap', 'silau', 'dekatkan', 'jauhkan', 'kiri', 'kanan', 'atas', 'bawah',
    'luruskan', 'tegakkan', 'hadap', 'buram', 'tahan', 'putar_kanan', 'putar_kiri', 'putar_tegak'];
  for (const lvl of levels) {
    for (const k of keys) {
      const g = guideText(k, lvl);
      if (g) assert.ok(covered(g), g);
      for (const cam of ['rear', 'front']) {
        for (const small of [false, true]) {
          for (const again of [false, true]) {
            for (const upright of [false, true]) {
              const t = ktpGuideText(k, lvl, cam, { small, again, upright });
              if (!t) continue;
              assert.ok(covered(t), t);
              assert.ok(covered(`${extraText('kelewatan', lvl)} ${t}`));
            }
          }
        }
      }
    }
    assert.ok(covered(extraText('terus', lvl)));
  }
});

test('semua kalimat peristiwa, saran, dan layar hasil punya rekaman', () => {
  for (const k of Object.keys(EVENTS)) for (const lvl of ['lengkap', 'ringkas', 'nada']) assert.ok(covered(eventText(k, lvl)));
  for (const a of Object.values(ADVICE)) assert.ok(covered(`${a} ${eventText('retry', 'lengkap')}`), a);
  for (const p of Object.values(PHRASES)) assert.ok(covered(`${p} ${PHRASES.confirmSuffix}`), p);
  assert.ok(covered(`${PHRASES.resultAllOk} ${Object.values(RESULT_SENTENCES).join(' ')} ${PHRASES.resultHowNv}`));
  assert.ok(covered(`${eventText('helpOffer', 'lengkap')} ${PHRASES.helpHowNv}`));
  assert.ok(covered(`${eventText('sent', 'lengkap')} ${PHRASES.providerHowNv}`));
});

test('kode sumber tidak mengucapkan kalimat di luar katalog', () => {
  // Pemanggilan feedback.say dengan teks tertulis langsung (tanda kutip) tidak boleh ada di komponen.
  for (const f of ['Guide.jsx', 'Result.jsx', 'Provider.jsx', 'Help.jsx', 'Home.jsx']) {
    const src = readFileSync(new URL(`../src/components/${f}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /feedback\.say\(\s*['"]/, `${f} memakai teks langsung`);
    assert.doesNotMatch(src, /feedback\.say\(\s*`[^$`]*[A-Za-z]{3}/, `${f} memakai teks langsung`);
  }
});

test('rekaman suara lengkap (bila sudah dibuat dengan npm run voice)', (t) => {
  const path = new URL('../public/voice/manifest.json', import.meta.url);
  if (!existsSync(path)) {
    t.skip('public/voice belum dibuat');
    return;
  }
  const { items } = JSON.parse(readFileSync(path, 'utf8'));
  for (const k of catalog) {
    assert.ok(items[k], `rekaman tidak ada untuk kunci ${k}`);
    assert.ok(existsSync(new URL(`../public/voice/${items[k].f}`, import.meta.url)), items[k].f);
  }
});
