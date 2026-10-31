import { useEffect, useRef } from 'react';
import { feedback } from '../lib/feedback.js';
import { useConfirmTap } from '../lib/useConfirmTap.js';
import { IconCheck, IconCross, IconWarn } from './Icons.jsx';

export const PROVIDER_NAME = 'Bank Contoh Nusantara';

function StatusIcon({ check }) {
  if (check.warn) return <IconWarn className="ico-warn" />;
  return check.ok ? <IconCheck className="ico-ok" /> : <IconCross className="ico-bad" />;
}

function CheckCard({ title, photo, checks, mirror }) {
  return (
    <section className="card result-card" aria-label={title}>
      <div className="result-head">
        {photo && <img src={photo} alt="" className={mirror ? 'mirror' : ''} />}
        <h2>{title}</h2>
      </div>
      <ul className="checks">
        {checks.map((c) => (
          <li key={c.id}>
            <StatusIcon check={c} />
            <span className="check-label">{c.label}</span>
            <span className="check-detail">{c.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function summarize(ktp, selfie) {
  const detail = (r, id) => {
    const c = r.checks.find((x) => x.id === id);
    if (!c) return '';
    const d = c.detail;
    // Kecilkan huruf pertama kecuali singkatan seperti "NIK".
    return /^[A-Z][a-z]/.test(d) ? d.charAt(0).toLowerCase() + d.slice(1) : d;
  };
  return `KTP: ${detail(ktp, 'nik')}, ${detail(ktp, 'sharp')}. Swafoto: ${detail(selfie, 'pos')}, ${detail(selfie, 'light')}.`;
}

export default function Result({ settings, ktp, selfie, onSend, onRetake }) {
  const nv = settings.nonVisual;
  const confirmTap = useConfirmTap(nv);
  const headingRef = useRef(null);

  useEffect(() => {
    headingRef.current?.focus();
    const how = nv
      ? 'Ketuk bagian atas layar untuk mengirim, atau bagian bawah untuk mengulang swafoto.'
      : 'Tekan tombol Kirim ke Penyedia untuk mengirim.';
    feedback.say(`Semua foto layak dikirim. ${summarize(ktp, selfie)} ${how}`, { interrupt: true });
    return () => feedback.stopSpeech();
  }, [ktp, selfie, nv]);

  const send = confirmTap('send', `Kirim foto dan laporan ke ${PROVIDER_NAME}?`, onSend);
  const retakeSelfie = confirmTap('selfie', 'Ulangi swafoto?', () => onRetake('selfie'));
  const retakeKtp = confirmTap('ktp', 'Ulangi foto KTP?', () => onRetake('ktp'));

  return (
    <main className={`screen result ${nv ? 'nv-layout' : ''}`} aria-labelledby="result-title">
      <h1 id="result-title" ref={headingRef} tabIndex={-1}>
        Hasil pemeriksaan
      </h1>
      <p className="lead" role="status">
        Semua foto layak dikirim.
      </p>

      <CheckCard title="KTP" photo={ktp.dataUrl} checks={ktp.checks} />
      <CheckCard title="Swafoto" photo={selfie.dataUrl} checks={selfie.checks} mirror />

      <p className="muted consent">
        Dengan menekan Kirim, Anda menyetujui foto KTP, swafoto, dan laporan kualitas dibagikan kepada {PROVIDER_NAME}{' '}
        untuk verifikasi identitas.
      </p>

      <div className="stack actions">
        <button type="button" className="btn btn-primary btn-xl send" onClick={send}>
          Kirim ke Penyedia
        </button>
        <div className="row">
          <button type="button" className="btn btn-secondary retake-ktp" onClick={retakeKtp}>
            Ulangi foto KTP
          </button>
          <button type="button" className="btn btn-secondary retake-selfie" onClick={retakeSelfie}>
            Ulangi swafoto
          </button>
        </div>
      </div>
    </main>
  );
}
