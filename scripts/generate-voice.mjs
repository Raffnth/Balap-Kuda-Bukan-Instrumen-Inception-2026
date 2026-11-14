#!/usr/bin/env node
// Pembuat suara pemandu SonarID (suara AI / TTS neural bahasa Indonesia).
//
// Setiap kalimat yang dapat diucapkan SonarID (src/lib/messages.js) diubah menjadi berkas MP3 di
// public/voice, beserta daftar public/voice/manifest.json. Aplikasi memutar berkas ini, sehingga suara
// sama di semua ponsel tanpa perlu memasang atau mengatur suara bahasa Indonesia di ponsel.
//
// Pemakaian:
//   npm run voice                          (mesin "auto": edge, lalu edge-py bila gagal)
//   npm run voice -- --engine azure        (Azure AI Speech resmi; perlu AZURE_SPEECH_KEY dan AZURE_SPEECH_REGION)
//   npm run voice -- --engine google       (Google Cloud Text-to-Speech; perlu GOOGLE_TTS_API_KEY)
//   npm run voice -- --voice id-ID-ArdiNeural   (suara pria; bawaan id-ID-GadisNeural, wanita)
//   npm run voice -- --rate +5%            (sedikit lebih cepat)
//   npm run voice -- --force               (buat ulang semua berkas)
//   npm run voice -- --check               (hanya periksa kelengkapan; keluar dengan kode 1 bila ada yang kurang)
//   npm run voice -- --list                (tampilkan semua kalimat)
//
// Mesin yang tersedia:
//   edge     paket npm "msedge-tts" (suara neural Microsoft Edge "Read Aloud", tanpa kunci API).
//            Pasang: npm i -D -E msedge-tts
//   edge-py  perintah Python "edge-tts" (pip install edge-tts), layanan yang sama dengan "edge".
//   azure    Azure AI Speech (layanan resmi berlisensi, ada kuota gratis bulanan).
//   google   Google Cloud Text-to-Speech (layanan resmi, ada kuota gratis bulanan).
//   dummy    nada uji dengan ffmpeg (hanya untuk menguji alur, bukan suara).

import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def;
};
const flag = (name) => args.includes(`--${name}`);

const ENGINE = opt('engine', process.env.SONARID_TTS_ENGINE || 'auto');
const VOICE = opt('voice', process.env.SONARID_TTS_VOICE || 'id-ID-GadisNeural');
const RATE = opt('rate', process.env.SONARID_TTS_RATE || '+0%');
const OUT = resolve(ROOT, opt('out', 'public/voice'));
const FORCE = flag('force');

// Ejaan khusus HANYA untuk pengucapan (kunci berkas tetap dari teks asli). Ubah bila pelafalan kurang pas.
const SPOKEN_FORMS = [[/SonarID/g, 'Sonar ID']];
const spokenForm = (s) => SPOKEN_FORMS.reduce((t, [re, to]) => t.replace(re, to), s);

const { splitSentences, voiceKey, normalizeSentence } = await import(pathToFileURL(join(ROOT, 'src/lib/voice-core.js')).href);
const { allSpokenTexts } = await import(pathToFileURL(join(ROOT, 'src/lib/messages.js')).href);

// 1) Kumpulkan kalimat unik.
const sentences = new Map();
for (const text of allSpokenTexts()) {
  for (const s of splitSentences(text)) {
    const k = voiceKey(s);
    if (sentences.has(k) && sentences.get(k) !== normalizeSentence(s)) {
      console.error(`Bentrok kunci ${k}: "${sentences.get(k)}" dan "${s}"`);
      process.exit(1);
    }
    sentences.set(k, normalizeSentence(s));
  }
}

if (flag('list')) {
  for (const [k, s] of sentences) console.log(`${k}  ${s}`);
  console.log(`\n${sentences.size} kalimat.`);
  process.exit(0);
}

const manifestPath = join(OUT, 'manifest.json');
const old = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
const oldItems = (old && old.items) || {};

if (flag('check')) {
  const missing = [...sentences].filter(([k]) => !oldItems[k] || !existsSync(join(OUT, oldItems[k].f)));
  if (missing.length) {
    console.error(`Rekaman suara belum lengkap: ${missing.length} dari ${sentences.size} kalimat.`);
    for (const [, s] of missing.slice(0, 20)) console.error(`  - ${s}`);
    console.error('Jalankan: npm run voice');
    process.exit(1);
  }
  console.log(`Rekaman suara lengkap: ${sentences.size} kalimat (${old.engine}, ${old.voice}).`);
  process.exit(0);
}

// 2) Mesin TTS. Masing-masing: async (text) => Buffer MP3.
const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ssml = (text) =>
  `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="id-ID">` +
  `<voice name="${VOICE}"><prosody rate="${RATE}">${xml(text)}</prosody></voice></speak>`;

async function engineEdge() {
  let mod;
  try {
    mod = await import('msedge-tts');
  } catch {
    throw new Error('Paket "msedge-tts" belum terpasang. Jalankan: npm i -D -E msedge-tts');
  }
  const { MsEdgeTTS, OUTPUT_FORMAT } = mod;
  let tts = null;
  const connect = async () => {
    tts = new MsEdgeTTS();
    await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  };
  await connect();
  return async (text) => {
    for (let attempt = 1; ; attempt++) {
      try {
        const r = await tts.toStream(text, RATE && RATE !== '+0%' ? { rate: RATE } : undefined);
        const stream = r && r.audioStream ? r.audioStream : r;
        const chunks = [];
        await new Promise((ok, fail) => {
          stream.on('data', (c) => chunks.push(c));
          stream.on('end', ok);
          stream.on('close', ok);
          stream.on('error', fail);
        });
        const buf = Buffer.concat(chunks);
        if (buf.length < 500) throw new Error('hasil suara kosong');
        return buf;
      } catch (err) {
        if (attempt >= 3) throw err;
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        await connect().catch(() => {});
      }
    }
  };
}

async function engineEdgePy() {
  const bin = process.env.EDGE_TTS_BIN || 'edge-tts';
  const probe = spawnSync(bin, ['--help'], { encoding: 'utf8' });
  if (probe.error) throw new Error('Perintah "edge-tts" tidak ditemukan. Pasang: pip install edge-tts');
  const dir = join(tmpdir(), `sonarid-voice-${process.pid}`);
  mkdirSync(dir, { recursive: true });
  let n = 0;
  return async (text) => {
    const file = join(dir, `${n++}.mp3`);
    for (let attempt = 1; ; attempt++) {
      const r = spawnSync(bin, ['--voice', VOICE, `--rate=${RATE}`, '--text', text, '--write-media', file], {
        encoding: 'utf8',
      });
      if (!r.error && r.status === 0 && existsSync(file)) {
        const buf = readFileSync(file);
        unlinkSync(file);
        return buf;
      }
      if (attempt >= 3) throw new Error(`edge-tts gagal: ${(r.stderr || r.error || '').toString().slice(0, 300)}`);
      await new Promise((ok) => setTimeout(ok, 1000 * attempt));
    }
  };
}

async function engineAzure() {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) throw new Error('Isi variabel AZURE_SPEECH_KEY dan AZURE_SPEECH_REGION (misalnya southeastasia).');
  return async (text) => {
    const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'SonarID-voice-generator',
      },
      body: ssml(text),
    });
    if (!res.ok) throw new Error(`Azure ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return Buffer.from(await res.arrayBuffer());
  };
}

async function engineGoogle() {
  const key = process.env.GOOGLE_TTS_API_KEY;
  if (!key) throw new Error('Isi variabel GOOGLE_TTS_API_KEY.');
  // Nama suara Google berbeda dengan Azure/Edge; bawaan: id-ID-Wavenet-A (wanita).
  const name = VOICE.startsWith('id-ID-') && !VOICE.endsWith('Neural') ? VOICE : 'id-ID-Wavenet-A';
  const pct = parseFloat(RATE) || 0;
  return async (text) => {
    const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: 'id-ID', name },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 1 + pct / 100, sampleRateHertz: 24000 },
      }),
    });
    if (!res.ok) throw new Error(`Google ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const { audioContent } = await res.json();
    return Buffer.from(audioContent, 'base64');
  };
}

async function engineDummy() {
  const dir = join(tmpdir(), `sonarid-voice-${process.pid}`);
  mkdirSync(dir, { recursive: true });
  let n = 0;
  return async (text) => {
    const file = join(dir, `${n++}.mp3`);
    const dur = Math.min(6, 0.25 + text.length * 0.055).toFixed(2);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `sine=frequency=520:duration=${dur}`, '-ac', '1', '-ar', '24000', '-b:a', '48k', file]);
    const buf = readFileSync(file);
    unlinkSync(file);
    return buf;
  };
}

const ENGINES = { edge: engineEdge, 'edge-py': engineEdgePy, azure: engineAzure, google: engineGoogle, dummy: engineDummy };

async function pickEngine() {
  const order = ENGINE === 'auto' ? ['edge', 'edge-py'] : [ENGINE];
  const errors = [];
  for (const name of order) {
    if (!ENGINES[name]) throw new Error(`Mesin tidak dikenal: ${name}`);
    try {
      const synth = await ENGINES[name]();
      // Uji satu kalimat pendek agar kegagalan diketahui sebelum memproses semuanya.
      await synth('Tes.');
      return { name, synth };
    } catch (err) {
      errors.push(`${name}: ${err.message}`);
    }
  }
  throw new Error(`Tidak ada mesin suara yang berhasil:\n  ${errors.join('\n  ')}`);
}

// 3) Buat berkas.
mkdirSync(OUT, { recursive: true });
let picked;
try {
  picked = await pickEngine();
} catch (err) {
  console.error(err.message);
  console.error('Lihat bagian "Suara pemandu" di README untuk pilihan mesin lain (azure, google, edge-py).');
  process.exit(1);
}
const { name: engineName, synth } = picked;
const sig = { engine: engineName, voice: VOICE, rate: RATE };
const sameSig = old && old.engine === sig.engine && old.voice === sig.voice && old.rate === sig.rate;
const items = {};
let made = 0;
let kept = 0;
const list = [...sentences];
let idx = 0;
const failures = [];

async function worker() {
  while (idx < list.length) {
    const [k, s] = list[idx++];
    const prev = oldItems[k];
    if (!FORCE && sameSig && prev && prev.t === s && existsSync(join(OUT, prev.f))) {
      items[k] = prev;
      kept++;
      continue;
    }
    try {
      const buf = await synth(spokenForm(s));
      const hash = createHash('sha256').update(buf).digest('hex').slice(0, 10);
      const f = `${k}-${hash}.mp3`;
      writeFileSync(join(OUT, f), buf);
      items[k] = { f, t: s };
      made++;
      process.stdout.write(`\r${made + kept}/${list.length} ${s.slice(0, 60).padEnd(60)}`);
    } catch (err) {
      failures.push(`${s} -> ${err.message}`);
    }
  }
}
await Promise.all(Array.from({ length: engineName === 'edge-py' || engineName === 'dummy' ? 1 : 3 }, worker));
process.stdout.write('\n');

if (failures.length) {
  console.error(`Gagal membuat ${failures.length} kalimat:`);
  for (const f of failures.slice(0, 10)) console.error(`  - ${f}`);
  process.exit(1);
}

// 4) Hapus berkas lama yang tidak dipakai lagi, lalu tulis daftar (urut kunci agar diff git rapi).
const used = new Set(Object.values(items).map((v) => v.f));
let removed = 0;
for (const f of readdirSync(OUT)) {
  if (/^[0-9a-f]{8}-[0-9a-f]{10}\.mp3$/.test(f) && !used.has(f)) {
    rmSync(join(OUT, f));
    removed++;
  }
}
const sorted = Object.fromEntries(Object.keys(items).sort().map((k) => [k, items[k]]));
const unchanged = old && sameSig && !made && !removed && Object.keys(oldItems).length === used.size;
if (unchanged) {
  console.log(`Tidak ada perubahan: ${used.size} rekaman sudah lengkap (${engineName}, ${VOICE}).`);
  process.exit(0);
}
writeFileSync(
  manifestPath,
  `${JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), ...sig, count: used.size, items: sorted }, null, 1)}\n`,
);
console.log(`Selesai: ${made} dibuat, ${kept} dipakai ulang, total ${used.size} rekaman (${engineName}, ${VOICE}).`);
