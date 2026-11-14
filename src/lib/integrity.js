// Sidik integritas foto (SHA-256) dengan Web Crypto bawaan browser.
// Sidik dihitung saat foto lulus Quality Check dan ikut dalam laporan ke penyedia, sehingga penyedia
// dapat memastikan foto yang diterima sama persis dengan foto yang diperiksa (tidak diubah di tengah jalan).

export function dataUrlBytes(dataUrl) {
  const i = String(dataUrl || '').indexOf(',');
  if (i < 0) return new Uint8Array(0);
  const bin = atob(dataUrl.slice(i + 1));
  const out = new Uint8Array(bin.length);
  for (let k = 0; k < bin.length; k++) out[k] = bin.charCodeAt(k);
  return out;
}

export function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Hasil: 64 karakter heksadesimal, atau null bila Web Crypto tidak tersedia (misalnya bukan HTTPS).
export async function sha256OfDataUrl(dataUrl) {
  try {
    const subtle = globalThis.crypto && globalThis.crypto.subtle;
    if (!subtle) return null;
    return toHex(await subtle.digest('SHA-256', dataUrlBytes(dataUrl)));
  } catch {
    return null;
  }
}
