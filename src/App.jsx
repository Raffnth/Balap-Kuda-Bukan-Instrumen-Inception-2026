import { useCallback, useEffect, useRef, useState } from 'react';
import Home from './components/Home.jsx';
import Guide from './components/Guide.jsx';
import Result from './components/Result.jsx';
import Provider from './components/Provider.jsx';
import Help from './components/Help.jsx';
import Kinerja from './components/Kinerja.jsx';
import { feedback } from './lib/feedback.js';
import { newSession, saveSession } from './lib/metrics.js';

const SETTINGS_KEY = 'sonarid.settings.v1';
const DEFAULT_SETTINGS = { detail: 'lengkap', nonVisual: false };

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (saved && ['lengkap', 'ringkas', 'nada'].includes(saved.detail)) {
      return { ...DEFAULT_SETTINGS, ...saved, nonVisual: !!saved.nonVisual };
    }
  } catch {
    /* abaikan */
  }
  return DEFAULT_SETTINGS;
}

const initialScreen = () => (typeof window !== 'undefined' && window.location.hash === '#kinerja' ? 'kinerja' : 'home');

export default function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [screen, setScreen] = useState(initialScreen);
  const [session, setSession] = useState(null);
  const [photos, setPhotos] = useState({ ktp: null, selfie: null });
  const [helpStep, setHelpStep] = useState('ktp');
  const photosRef = useRef(photos);
  photosRef.current = photos;

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* abaikan */
    }
    feedback.setLevel(settings.detail);
  }, [settings]);

  useEffect(() => {
    const onHash = () => setScreen(window.location.hash === '#kinerja' ? 'kinerja' : 'home');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const goHome = useCallback(() => {
    feedback.stopAll();
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
    setScreen('home');
  }, []);

  const start = () => {
    feedback.unlock(); // wajib dari ketukan pengguna agar suara dan nada boleh diputar
    setSession(newSession(settings));
    setPhotos({ ktp: null, selfie: null });
    setScreen('ktp');
  };

  const onKtpDone = useCallback((result) => {
    const hasSelfie = !!photosRef.current.selfie;
    setPhotos((p) => ({ ...p, ktp: result }));
    setScreen(hasSelfie ? 'result' : 'selfie');
  }, []);

  const onSelfieDone = useCallback((result) => {
    setPhotos((p) => ({ ...p, selfie: result }));
    setScreen('result');
  }, []);

  const onHelp = useCallback((step) => {
    setHelpStep(step);
    setScreen('help');
  }, []);

  const onSend = () => {
    if (session) {
      session.completed = true;
      saveSession(session);
    }
    setScreen('provider');
  };

  const onRetake = (step) => {
    setPhotos((p) => ({ ...p, [step]: null }));
    setScreen(step);
  };

  const exitGuide = () => {
    if (session) saveSession(session);
    goHome();
  };

  const nvActive = settings.nonVisual && screen !== 'home' && screen !== 'kinerja';

  return (
    <div className={`app ${nvActive ? 'nv' : ''}`}>
      {nvActive && (
        <button type="button" className="nv-exit" onClick={exitGuide}>
          Keluar dari mode uji
        </button>
      )}
      {screen === 'home' && (
        <Home
          settings={settings}
          onChange={setSettings}
          onStart={start}
          onOpenKinerja={() => {
            window.location.hash = 'kinerja';
          }}
        />
      )}
      {screen === 'ktp' && (
        <Guide key="ktp" mode="ktp" settings={settings} session={session} onDone={onKtpDone} onHelp={onHelp} onExit={exitGuide} />
      )}
      {screen === 'selfie' && (
        <Guide
          key="selfie"
          mode="selfie"
          settings={settings}
          session={session}
          onDone={onSelfieDone}
          onHelp={onHelp}
          onExit={exitGuide}
        />
      )}
      {screen === 'result' && photos.ktp && photos.selfie && (
        <Result settings={settings} ktp={photos.ktp} selfie={photos.selfie} onSend={onSend} onRetake={onRetake} />
      )}
      {screen === 'provider' && photos.ktp && photos.selfie && (
        <Provider settings={settings} ktp={photos.ktp} selfie={photos.selfie} onFinish={goHome} />
      )}
      {screen === 'help' && (
        <Help settings={settings} step={helpStep} onRetry={() => setScreen(helpStep)} onHome={exitGuide} />
      )}
      {screen === 'kinerja' && <Kinerja onBack={goHome} />}
    </div>
  );
}
