import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { sha256OfDataUrl, dataUrlBytes } from '../src/lib/integrity.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('sidik SHA-256 foto sama dengan perhitungan Node', async () => {
  const bytes = Buffer.from('foto-uji-fiktif-SonarID');
  const url = `data:image/jpeg;base64,${bytes.toString('base64')}`;
  assert.deepEqual(Buffer.from(dataUrlBytes(url)), bytes);
  assert.equal(await sha256OfDataUrl(url), createHash('sha256').update(bytes).digest('hex'));
});

test('header keamanan server lengkap', () => {
  const h = read('public/.htaccess');
  for (const name of [
    'Content-Security-Policy',
    'Strict-Transport-Security',
    'Permissions-Policy',
    'X-Content-Type-Options',
    'Referrer-Policy',
    'X-Frame-Options',
    'Cross-Origin-Opener-Policy',
  ]) {
    assert.match(h, new RegExp(`Header always set ${name} `), name);
  }
  assert.match(h, /object-src 'none'/);
  assert.match(h, /frame-ancestors 'none'/);
  assert.match(h, /camera=\(self\)/);
  assert.match(h, /microphone=\(\)/);
  assert.doesNotMatch(h, /script-src[^;]*'unsafe-inline'/, 'skrip sebaris tidak boleh diizinkan');
});

test('halaman tidak memakai skrip sebaris (sesuai CSP)', () => {
  for (const f of ['index.html', 'public/kartu-uji.html']) {
    const html = read(f);
    assert.doesNotMatch(html, /\son[a-z]+\s*=/i, `${f}: atribut onclick/onload`);
    for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      assert.match(m[1], /\bsrc=/, `${f}: skrip sebaris`);
      assert.equal(m[2].trim(), '', `${f}: skrip sebaris`);
    }
  }
});

test('isi KTP tidak pernah diucapkan dan NIK tidak disimpan', () => {
  const ocr = read('src/lib/vision/ocr.js');
  // readNik hanya mengembalikan status keterbacaan, bukan angka NIK.
  assert.match(ocr, /return \{ readable: true, upsideDown: c\.upsideDown \}/);
  const guide = read('src/components/Guide.jsx');
  assert.doesNotMatch(guide, /localStorage|sessionStorage|indexedDB/);
});
