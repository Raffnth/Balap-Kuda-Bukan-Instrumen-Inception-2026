import { useEffect, useRef } from 'react';
import { feedback } from '../lib/feedback.js';
import { eventText } from '../lib/messages.js';
import { useConfirmTap } from '../lib/useConfirmTap.js';
import { PROVIDER_NAME } from './Result.jsx';
import { IconCheck } from './Icons.jsx';

// Simulasi aplikasi penyedia eKYC (merek fiktif) yang memasang komponen SonarID.
// Tidak ada data yang dikirim ke server: laporan ini hanya ditampilkan di perangkat.
export default function Provider({ settings, ktp, selfie, onFinish }) {
  const headingRef = useRef(null);
  const confirmTap = useConfirmTap(settings.nonVisual);

  useEffect(() => {
    headingRef.current?.focus();
    feedback.success();
    const how = settings.nonVisual ? ' Ketuk layar untuk kembali ke awal.' : '';
    feedback.say(`${eventText('sent', settings.detail)}${how}`, { interrupt: true });
    return () => feedback.stopSpeech();
  }, [settings.detail, settings.nonVisual]);

  const report = {
    komponen: 'SonarID',
    ktp: Object.fromEntries(ktp.checks.map((c) => [c.id, c.ok ? 'lulus' : 'gagal'])),
    swafoto: Object.fromEntries(selfie.checks.map((c) => [c.id, c.ok ? 'lulus' : 'gagal'])),
    percobaan: { ktp: ktp.attempts, swafoto: selfie.attempts },
    catatan: 'Keputusan verifikasi akhir tetap milik penyedia.',
  };

  const finish = confirmTap('finish', 'Kembali ke awal?', onFinish);

  return (
    <main className={`screen provider ${settings.nonVisual ? 'nv-layout' : ''}`} aria-labelledby="provider-title">
      <div className="provider-bar" aria-hidden="true">
        <span className="provider-logo">BCN</span>
        <span>{PROVIDER_NAME}</span>
        <span className="demo-tag">Simulasi</span>
      </div>
      <div className="provider-ok">
        <IconCheck className="ico-ok big" />
        <h1 id="provider-title" ref={headingRef} tabIndex={-1}>
          Foto diterima
        </h1>
        <p className="lead">Verifikasi identitas Anda sedang diproses oleh {PROVIDER_NAME}.</p>
      </div>

      <section className="card">
        <h2>Laporan kualitas yang diterima penyedia</h2>
        <pre className="report" aria-label="Laporan kualitas dalam format data">
          {JSON.stringify(report, null, 2)}
        </pre>
        <p className="muted">
          Ini adalah simulasi integrasi. Pada pemakaian nyata, aplikasi penyedia menerima foto dan laporan ini melalui
          komponen SonarID, lalu menjalankan pemeriksaan keaslian sendiri.
        </p>
      </section>

      <button type="button" className="btn btn-primary btn-xl finish" onClick={finish}>
        Selesai
      </button>
    </main>
  );
}
