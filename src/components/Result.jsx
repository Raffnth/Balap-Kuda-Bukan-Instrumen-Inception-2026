import { useEffect, useRef } from 'react';
import { feedback } from '../lib/feedback.js';
import { PHRASES, PROVIDER_NAME, RESULT_SENTENCES } from '../lib/messages.js';
import { useConfirmTap } from '../lib/useConfirmTap.js';
import { IconCheck, IconCross, IconWarn } from './Icons.jsx';

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

// Ringkasan yang dibacakan, disusun dari kalimat tetap di messages.js (setiap kalimat punya rekaman suara).
// Isi KTP tidak pernah dibacakan; yang disebut hanya status pemeriksaan.
export function summarize(ktp) {
  const get = (id) => ktp.checks.find((c) => c.id === id);
  const parts = [];
  const nik = get('nik');
  if (nik) parts.push(nik.warn ? RESULT_SENTENCES.nikSkipped : RESULT_SENTENCES.nikOk);
  const sharp = get('sharp');
  if (sharp) parts.push(sharp.warn ? RESULT_SENTENCES.ktpSharpEnough : RESULT_SENTENCES.ktpSharp);
  if (ktp.checks.some((c) => c.warn && c.id !== 'nik' && c.id !== 'sharp')) parts.push(RESULT_SENTENCES.ktpNote);
  parts.push(RESULT_SENTENCES.selfieOk);
  return parts.join(' ');
}

export default function Result({ settings, ktp, selfie, onSend, onRetake }) {
  const nv = settings.nonVisual;
  const confirmTap = useConfirmTap(nv);
  const headingRef = useRef(null);

  useEffect(() => {
    headingRef.current?.focus();
    const how = nv ? PHRASES.resultHowNv : PHRASES.resultHow;
    feedback.say(`${PHRASES.resultAllOk} ${summarize(ktp)} ${how}`, { interrupt: true });
    return () => feedback.stopSpeech();
  }, [ktp, selfie, nv]);

  const send = confirmTap('send', PHRASES.confirmSend, onSend);
  const retakeSelfie = confirmTap('selfie', PHRASES.confirmRetakeSelfie, () => onRetake('selfie'));
  const retakeKtp = confirmTap('ktp', PHRASES.confirmRetakeKtp, () => onRetake('ktp'));

  return (
    <main className={`screen result ${nv ? 'nv-layout' : ''}`} aria-labelledby="result-title">
      <h1 id="result-title" ref={headingRef} tabIndex={-1}>
        Hasil pemeriksaan
      </h1>
      {/* Tanpa role="status": ringkasan sudah diucapkan SonarID, agar tidak terdengar dua kali bersama TalkBack. */}
      <p className="lead">{PHRASES.resultAllOk}</p>

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
