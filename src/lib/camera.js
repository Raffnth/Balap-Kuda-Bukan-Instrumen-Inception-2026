// Membuka dan menutup kamera. Kamera hanya bisa diakses di HTTPS atau localhost.

export function cameraAvailable() {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}

// facing: 'environment' (kamera belakang, untuk KTP) atau 'user' (kamera depan, untuk swafoto).
export async function openCamera(facing) {
  if (!cameraAvailable()) {
    const err = new Error('Kamera tidak didukung atau halaman tidak dibuka melalui HTTPS.');
    err.name = 'NotSupportedError';
    throw err;
  }
  // Foto KTP memakai resolusi lebih tinggi agar digit NIK cukup besar untuk dibaca.
  const hi = facing === 'environment';
  const attempts = [
    {
      video: {
        facingMode: { ideal: facing },
        width: { ideal: hi ? 1920 : 1280 },
        height: { ideal: hi ? 1080 : 720 },
        frameRate: { ideal: 30 },
      },
      audio: false,
    },
    { video: { facingMode: facing }, audio: false },
    { video: true, audio: false }, // laptop dengan satu webcam
  ];
  let lastError = null;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      lastError = err;
      // Izin ditolak: jangan coba ulang dengan pengaturan lain.
      if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) throw err;
    }
  }
  throw lastError || new Error('Kamera tidak dapat dibuka.');
}

// Minta fokus otomatis terus-menerus bila kamera mendukung (membantu saat kartu didekatkan).
export async function improveFocus(stream) {
  try {
    const track = stream && stream.getVideoTracks()[0];
    const caps = track && track.getCapabilities ? track.getCapabilities() : null;
    if (caps && Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
      await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
    }
  } catch {
    /* tidak didukung: abaikan */
  }
}

// Senter (lampu kilat) kamera belakang. Dipakai otomatis saat ruangan terlalu gelap.
export function torchSupported(stream) {
  try {
    const track = stream && stream.getVideoTracks()[0];
    const caps = track && track.getCapabilities ? track.getCapabilities() : null;
    return !!(caps && caps.torch);
  } catch {
    return false;
  }
}

export async function setTorch(stream, on) {
  try {
    const track = stream && stream.getVideoTracks()[0];
    if (!track) return false;
    await track.applyConstraints({ advanced: [{ torch: !!on }] });
    return true;
  } catch {
    return false;
  }
}

export function stopCamera(stream) {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      /* abaikan */
    }
  }
}

// Menunggu video siap diputar dan memiliki ukuran frame.
export function waitForVideo(video, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 2 && video.videoWidth > 0) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Video kamera tidak merespons.'));
    }, timeoutMs);
    const onReady = () => {
      if (video.videoWidth > 0) {
        cleanup();
        resolve();
      }
    };
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('loadedmetadata', onReady);
      video.removeEventListener('playing', onReady);
    };
    video.addEventListener('loadeddata', onReady);
    video.addEventListener('loadedmetadata', onReady);
    video.addEventListener('playing', onReady);
  });
}
